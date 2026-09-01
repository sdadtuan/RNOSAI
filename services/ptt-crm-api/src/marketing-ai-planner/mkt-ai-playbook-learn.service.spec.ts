import { ConflictException, NotFoundException } from '@nestjs/common';
import { readPlaybookFile } from './marketing-ai-playbook.util';
import { MktAiPlaybookLearnService } from './mkt-ai-playbook-learn.service';
import type { CorpusLifecycleInput } from './mkt-ai-playbook-corpus.util';
import type {
  MktAiPlaybookLearnJobRow,
  MktAiPlaybookVersionRow,
} from './mkt-ai-playbook-versions.repository';

const SLUG = 'meta-lead-gen';
const ACTOR = 'mkt-lead@test.vn';

function candidate(id: number, overrides: Partial<CorpusLifecycleInput> = {}): CorpusLifecycleInput {
  return {
    lifecycleId: id,
    serviceSlug: SLUG,
    applied: true,
    qualityScore: 75,
    humanEditedAfterGenerate: true,
    isUatSeed: false,
    stage: 'deliver',
    closedLoopWin: id <= 3,
    hasTier3Artifact: id <= 3,
    ...overrides,
  };
}

function fiveCandidates(): CorpusLifecycleInput[] {
  return [1, 2, 3, 4, 5].map((id) => candidate(id));
}

function cleanLearnedDoc(): Record<string, unknown> {
  const pb = readPlaybookFile('meta-lead-gen');
  const doc = JSON.parse(JSON.stringify(pb)) as Record<string, unknown>;
  doc.slug = SLUG;
  doc.service_slugs = [SLUG];
  const defaults = (doc.brief_defaults ?? {}) as Record<string, unknown>;
  delete defaults.brand_name;
  doc.brief_defaults = defaults;
  doc.anonymized = true;
  return doc;
}

describe('MktAiPlaybookLearnService', () => {
  const config = { mktAiPlaybookLearnEnabled: true };
  const versionsRepo = {
    hasSucceededWithinDays: jest.fn().mockResolvedValue(false),
    hasInProgressJob: jest.fn().mockResolvedValue(false),
    insertLearnJob: jest.fn(),
    claimLearnJob: jest.fn(),
    finishLearnJob: jest.fn(),
    getNextVersionNo: jest.fn().mockResolvedValue(2),
    insertVersion: jest.fn(),
  };
  const orchestrator = {
    modelName: 'gpt-4o-mini',
    generateLearnedPlaybook: jest.fn(),
  };
  const agentRuns = {
    tableReady: jest.fn().mockResolvedValue(false),
    insertRun: jest.fn(),
    updateRun: jest.fn(),
  };

  let service: MktAiPlaybookLearnService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MktAiPlaybookLearnService(
      config as never,
      versionsRepo as never,
      orchestrator as never,
      agentRuns as never,
    );
    jest.spyOn(service, 'loadCorpusRows').mockResolvedValue(fiveCandidates());
    versionsRepo.insertLearnJob.mockResolvedValue({
      id: 101,
      service_slug: SLUG,
      status: 'queued',
      actor: ACTOR,
      error: null,
      output_version_id: null,
      created_at: new Date().toISOString(),
      finished_at: null,
    } satisfies MktAiPlaybookLearnJobRow);
    versionsRepo.claimLearnJob.mockImplementation(async (jobId: number) => ({
      id: jobId,
      service_slug: SLUG,
      status: 'running',
      actor: ACTOR,
      error: null,
      output_version_id: null,
      created_at: new Date().toISOString(),
      finished_at: null,
    }));
    versionsRepo.insertVersion.mockImplementation(
      async (input: {
        status: string;
        documentJson: Record<string, unknown>;
      }): Promise<MktAiPlaybookVersionRow> => ({
        id: 501,
        service_slug: SLUG,
        version_no: 2,
        status: input.status as MktAiPlaybookVersionRow['status'],
        depth: 'deep',
        document_json: input.documentJson,
        source: 'learn',
        learn_job_id: 101,
        corpus_json: {},
        created_by: ACTOR,
        created_at: new Date().toISOString(),
      }),
    );
    orchestrator.generateLearnedPlaybook.mockResolvedValue(cleanLearnedDoc());
  });

  it('404 when PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=0', async () => {
    const off = new MktAiPlaybookLearnService(
      { mktAiPlaybookLearnEnabled: false } as never,
      versionsRepo as never,
      orchestrator as never,
      agentRuns as never,
    );
    await expect(off.enqueueLearn(SLUG, ACTOR, [])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 playbook_learn_need_more when only 4 candidates', async () => {
    jest.spyOn(service, 'loadCorpusRows').mockResolvedValue([1, 2, 3, 4].map((id) => candidate(id)));
    try {
      await service.enqueueLearn(SLUG, ACTOR, []);
      throw new Error('expected ConflictException');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        error: 'playbook_learn_need_more',
        remaining: 1,
      });
    }
    expect(versionsRepo.insertLearnJob).not.toHaveBeenCalled();
  });

  it('409 playbook_learn_cooldown when succeeded within 7 days', async () => {
    versionsRepo.hasSucceededWithinDays.mockResolvedValueOnce(true);
    try {
      await service.enqueueLearn(SLUG, ACTOR, []);
      throw new Error('expected ConflictException');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        error: 'playbook_learn_cooldown',
      });
    }
  });

  it('409 playbook_learn_in_progress when queued/running exists', async () => {
    versionsRepo.hasInProgressJob.mockResolvedValueOnce(true);
    try {
      await service.enqueueLearn(SLUG, ACTOR, []);
      throw new Error('expected ConflictException');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        error: 'playbook_learn_in_progress',
      });
    }
  });

  it('enqueueLearn returns job_id and triggers run', async () => {
    const runSpy = jest.spyOn(service, 'runJob').mockResolvedValue(undefined);
    const result = await service.enqueueLearn(SLUG, ACTOR, []);
    expect(result).toEqual({ job_id: 101, status: 'queued' });
    expect(versionsRepo.insertLearnJob).toHaveBeenCalledWith(SLUG, ACTOR);
    expect(runSpy).toHaveBeenCalledWith(101);
  });

  it('runJob writes draft when AI output passes validation', async () => {
    await service.runJob(101);
    expect(orchestrator.generateLearnedPlaybook).toHaveBeenCalled();
    expect(versionsRepo.insertVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        source: 'learn',
        createdBy: ACTOR,
      }),
    );
    expect(versionsRepo.finishLearnJob).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ status: 'succeeded', outputVersionId: 501 }),
    );
  });

  it('runJob writes rejected_auto when brand_name leaks', async () => {
    const bad = cleanLearnedDoc();
    (bad.brief_defaults as Record<string, unknown>).brand_name = 'ACME Corp';
    orchestrator.generateLearnedPlaybook.mockResolvedValueOnce(bad);
    await service.runJob(101);
    expect(versionsRepo.insertVersion).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected_auto' }),
    );
    expect(versionsRepo.finishLearnJob).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        status: 'succeeded',
        error: expect.stringContaining('brand_name must be empty'),
      }),
    );
  });

  it('never inserts active status from learn job', async () => {
    await service.runJob(101);
    const insertArg = versionsRepo.insertVersion.mock.calls[0][0];
    expect(insertArg.status).not.toBe('active');
  });
});
