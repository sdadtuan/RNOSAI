import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketResearchService } from './market-research.service';
import type { ResearchEvidenceRow, ResearchInsightRow, ResearchProjectRow } from './market-research.types';

const project: ResearchProjectRow = {
  id: 9,
  client_id: 'acme',
  client_name: 'Acme',
  lifecycle_id: null,
  title: 'Secret title must not leak',
  product_type: 'CAT_REVIEW',
  dv12_tier: 'CB',
  decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
  geo: ['VN'],
  languages: ['vi'],
  risk_class: 'low',
  status: 'intake',
  owner_user_id: null,
  data_residency: null,
  related_sales_market_id: null,
  created_by: 'am@ptt',
  updated_by: 'am@ptt',
  created_at: '2026-08-14',
  updated_at: '2026-08-14',
  rq_count: 0,
  verified_insight_count: 0,
};

describe('MarketResearchService', () => {
  const repo = {
    getProjectClientId: jest.fn(),
    getProject: jest.fn(),
    listProjects: jest.fn(),
    createProject: jest.fn(),
    listQuestions: jest.fn(),
    listSources: jest.fn(),
    listEvidence: jest.fn(),
    listInsights: jest.fn(),
    patchProject: jest.fn(),
    createSource: jest.fn(),
    getSource: jest.fn(),
    patchSourceKeep: jest.fn(),
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    patchEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
    supersedeEvidence: jest.fn(),
    getInsight: jest.fn(),
    countVerifiedEvidenceForInsight: jest.fn(),
    updateInsightStatus: jest.fn(),
    insertReview: jest.fn(),
    replaceInsightEvidence: jest.fn(),
    patchInsight: jest.fn(),
    getQuestion: jest.fn(),
    findInFlightDeskRun: jest.fn(),
    findInFlightDeepRun: jest.fn(),
    insertAiRun: jest.fn(),
    failAiRun: jest.fn(),
    succeedAiRun: jest.fn(),
    getAiRun: jest.fn(),
    listRecentAiRuns: jest.fn(),
    sumTavilyCredits: jest.fn(),
    createInsight: jest.fn(),
    createReportDraft: jest.fn(),
    insertReportVersion: jest.fn(),
    listReports: jest.fn(),
    getReport: jest.fn(),
    getReportVersion: jest.fn(),
  };
  const llm = {
    isConfigured: jest.fn(),
    completeJson: jest.fn(),
  };
  const clientScope = {
    allowedClientIdsForList: jest.fn(),
    assertListClientFilter: jest.fn(),
  };
  const jobQueue = {
    enqueueResearchDeskJob: jest.fn(),
    enqueueResearchDeepJob: jest.fn(),
  };
  const config = {
    researchDeepProvider: 'openai',
    maxTavilyCreditsPerResearch: 12,
  };

  let service: MarketResearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.researchDeepProvider = 'openai';
    config.maxTavilyCreditsPerResearch = 12;
    llm.isConfigured.mockReturnValue(true);
    service = new MarketResearchService(
      repo as never,
      clientScope as never,
      jobQueue as never,
      config as never,
      llm as never,
    );
  });

  function stubScopedProject(): void {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
  }

  it('createProject throws validation_error without hitting the repository', async () => {
    await expect(
      service.createProject({ restricted: false, allowedClientIds: [] }, {} as never, 'am@ptt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it('getProject toDetail uses config maxTavilyCreditsPerResearch', async () => {
    stubScopedProject();
    repo.listQuestions.mockResolvedValue([]);
    repo.listSources.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listInsights.mockResolvedValue([]);
    repo.listRecentAiRuns.mockResolvedValue([]);
    repo.sumTavilyCredits.mockResolvedValue(0);
    config.maxTavilyCreditsPerResearch = 6;

    const out = await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
    expect(out.tavily_credits_limit).toBe(6);
  });

  it('getProject outside scope is 403 without title in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('patchProject intake→designed with rqCount=0 is invalid_transition need_rq', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchProject(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { status: 'designed' },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({
        error: 'invalid_transition',
        reason: 'need_rq',
      });
    }
    expect(repo.patchProject).not.toHaveBeenCalled();
  });

  it('createEvidence with value_num but missing unit/base/period/geo is validation_error (BR-RES-02)', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.createEvidence(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          source_id: 1,
          locator: 'https://example.com#p3',
          value_num: 12.5,
        },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'validation_error',
        messages: expect.arrayContaining(['unit is required', 'value_base is required', 'period_note is required', 'geography is required']),
      });
    }
    expect(repo.createEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence content when verified is 409 evidence_immutable', async () => {
    const verified: ResearchEvidenceRow = {
      id: 3,
      project_id: 9,
      source_id: 1,
      study_id: null,
      question_id: null,
      locator: 'https://example.com#p3',
      excerpt: 'locked excerpt',
      value_num: null,
      unit: null,
      value_base: null,
      period_note: null,
      geography: null,
      captured_at: '2026-08-14',
      pii_class: 'none',
      qc_status: 'verified',
      checksum: 'abc',
      created_by: 'am@ptt',
      superseded_by: null,
      created_at: '2026-08-14',
    };
    repo.getEvidence.mockResolvedValue(verified);
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence locator-only keeps existing pii_class', async () => {
    const existing = evidenceRow({
      pii_class: 'pii_restricted',
      excerpt: 'public market size excerpt',
      qc_status: 'pending',
    });
    repo.getEvidence.mockResolvedValue(existing);
    stubScopedProject();
    repo.patchEvidence.mockImplementation(async (_id, input) => ({
      ...existing,
      locator: input.locator ?? existing.locator,
      pii_class: input.pii_class ?? existing.pii_class,
    }));

    const out = await service.patchEvidence(
      3,
      { restricted: true, allowedClientIds: ['acme'] },
      { locator: 'new' },
    );

    expect(out.pii_class).toBe('pii_restricted');
    expect(repo.patchEvidence).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ locator: 'new', pii_class: 'pii_restricted' }),
    );
  });

  it('patchEvidence when superseded is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }));
    stubScopedProject();

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('verifyEvidence when rejected is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'rejected' }));
    stubScopedProject();

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.verifyEvidence).not.toHaveBeenCalled();
  });

  it('supersede identical 6-tuple then verify successor does not throw', async () => {
    const verified = evidenceRow({ qc_status: 'verified', checksum: 'abc' });
    const successor = evidenceRow({
      id: 4,
      qc_status: 'pending',
      checksum: null,
      superseded_by: null,
    });
    const verifiedSuccessor = evidenceRow({
      id: 4,
      qc_status: 'verified',
      checksum: 'abc',
    });
    stubScopedProject();
    repo.getSource.mockResolvedValue({ id: 1, project_id: 9 });
    repo.getEvidence.mockResolvedValueOnce(verified).mockResolvedValueOnce(successor);
    repo.supersedeEvidence.mockResolvedValue({
      old: evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }),
      evidence: successor,
    });
    repo.verifyEvidence.mockResolvedValue(verifiedSuccessor);

    const body = {
      source_id: 1,
      locator: verified.locator,
      excerpt: verified.excerpt,
      value_num: verified.value_num,
      unit: verified.unit,
      value_base: verified.value_base,
      period_note: verified.period_note,
      geography: verified.geography,
    };
    await expect(
      service.supersedeEvidence(3, { restricted: true, allowedClientIds: ['acme'] }, body, 'am@ptt'),
    ).resolves.toMatchObject({ evidence: { id: 4, qc_status: 'pending' } });
    await expect(
      service.verifyEvidence(4, { restricted: true, allowedClientIds: ['acme'] }),
    ).resolves.toMatchObject({ id: 4, qc_status: 'verified' });
  });

  it('verifyEvidence maps PG unique violation 23505 to 409 evidence_duplicate_checksum', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'pending' }));
    stubScopedProject();
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    repo.verifyEvidence.mockRejectedValue(pgErr);

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_duplicate_checksum' });
    }
  });

  it('submitReview with 0 verified evidence is 400 insight_gate', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ confidence_rationale: 'Method OK', status: 'draft' }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(0);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected insight_gate');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insight_gate',
        messages: ['missing_verified_evidence'],
      });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('submitReview from approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        status: 'approved_internal',
        confidence_rationale: 'Method OK',
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('attachEvidence [] on approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.attachEvidence(7, { restricted: true, allowedClientIds: ['acme'] }, []);
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.replaceInsightEvidence).not.toHaveBeenCalled();
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('approveInsight by creator is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        created_by: 'analyst@ptt',
        status: 'analyst_verified',
        confidence_rationale: 'Method OK',
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_internal', comments: 'ok' },
        'analyst@ptt',
      );
      throw new Error('expected cannot_self_approve');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'cannot_self_approve' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
    expect(repo.insertReview).not.toHaveBeenCalled();
  });

  it('approveInsight happy path writes approved_internal and a review', async () => {
    stubScopedProject();
    const current = insightRow({
      created_by: 'analyst@ptt',
      status: 'analyst_verified',
      confidence_rationale: 'Nguồn verified, sample 2025',
    });
    const approved = insightRow({
      ...current,
      status: 'approved_internal',
    });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.updateInsightStatus.mockResolvedValue(approved);
    repo.insertReview.mockResolvedValue({ id: 1 });

    const out = await service.approveInsight(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { target_status: 'approved_internal', comments: 'Method OK' },
      'lead@ptt',
    );

    expect(out.status).toBe('approved_internal');
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(7, 'approved_internal');
    expect(repo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 9,
        object_type: 'insight',
        object_id: 7,
        reviewer: 'lead@ptt',
        decision: 'approve',
        comments: 'Method OK',
      }),
    );
  });

  it('runDesk throws job_in_flight when a pending run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue({ id: 55, status: 'pending' });

    try {
      await service.runDesk(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeskJob).not.toHaveBeenCalled();
  });

  it('runDesk marks the run failed jobs_disabled when enqueue returns null', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    repo.failAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'failed',
      credits_used: 0,
      error_message: 'jobs_disabled',
      created_at: '2026-08-14',
      finished_at: '2026-08-14',
    });
    jobQueue.enqueueResearchDeskJob.mockResolvedValue(null);

    const out = await service.runDesk(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({
      ok: true,
      run_id: 77,
      status: 'failed',
      note: 'jobs_disabled',
    });
    expect(repo.failAiRun).toHaveBeenCalledWith(77, 'jobs_disabled');
  });

  it('runDeep throws deep_research_disabled when provider is off', async () => {
    config.researchDeepProvider = 'off';
    stubScopedProject();

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'deep_research_disabled' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('runDeep throws job_in_flight when a pending deep run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeepRun.mockResolvedValue({ id: 88, status: 'running' });

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('health exposes deep_provider for FE hide/show', () => {
    expect(service.health()).toEqual({
      ok: true,
      enabled: true,
      deep_provider: 'openai',
    });
    config.researchDeepProvider = 'off';
    expect(service.health().deep_provider).toBe('off');
  });

  it('insightCopilot with 0 evidence is 400 and does not call the LLM', async () => {
    stubScopedProject();

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
  });

  it('insightCopilot is llm_unconfigured when Anthropic is missing', async () => {
    stubScopedProject();
    llm.isConfigured.mockReturnValue(false);
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, qc_status: 'verified' }));
    repo.insertAiRun.mockResolvedValue({ id: 91, status: 'pending' });

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [3] },
        'am@ptt',
      );
      throw new Error('expected unconfigured');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as ServiceUnavailableException).getResponse()).toEqual({
        error: 'llm_unconfigured',
      });
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.failAiRun).toHaveBeenCalledWith(91, 'llm_unconfigured');
  });

  it('createReport snapshot has evidence_index when insight has EV', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', evidence_ids: [3] }),
    );
    repo.listQuestions.mockResolvedValue([
      { id: 21, project_id: 9, sort_order: 1, question_vi: 'Quy mô?', question_en: null, analysis_frame: null, created_at: '2026-08-14' },
    ]);
    repo.listEvidence.mockResolvedValue([
      evidenceRow({ id: 3, locator: 'https://example.com#p3', question_id: 21 }),
    ]);
    repo.listReports.mockResolvedValue([]);
    repo.insertReportVersion.mockImplementation(async (input: { contentSnapshot: Record<string, unknown> }) => ({
      report_id: 1,
      version_id: 10,
      version: 1,
      content_snapshot: input.contentSnapshot,
      content_hash: 'abc',
    }));

    const out = await service.createReport(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { insight_ids: [7] },
      'am@ptt',
    );

    const index = out.content_snapshot.evidence_index as unknown[];
    expect(index.length).toBeGreaterThanOrEqual(1);
    expect(out.version).toBe(1);
    expect(repo.insertReportVersion).toHaveBeenCalled();
  });

  it('createReport rejects insights below approved_internal', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft', evidence_ids: [3] }));

    await expect(
      service.createReport(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [7] },
        'am@ptt',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertReportVersion).not.toHaveBeenCalled();
  });

  it('reportCopilot with 0 insights is 400', async () => {
    stubScopedProject();

    try {
      await service.reportCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createReportDraft).not.toHaveBeenCalled();
  });
});

function evidenceRow(overrides: Partial<ResearchEvidenceRow> = {}): ResearchEvidenceRow {
  return {
    id: 3,
    project_id: 9,
    source_id: 1,
    study_id: null,
    question_id: null,
    locator: 'https://example.com#p3',
    excerpt: 'locked excerpt',
    value_num: null,
    unit: null,
    value_base: null,
    period_note: null,
    geography: null,
    captured_at: '2026-08-14',
    pii_class: 'none',
    qc_status: 'pending',
    checksum: null,
    created_by: 'am@ptt',
    superseded_by: null,
    created_at: '2026-08-14',
    ...overrides,
  };
}

function insightRow(overrides: Partial<ResearchInsightRow> = {}): ResearchInsightRow {
  return {
    id: 7,
    project_id: 9,
    statement: 'Premium SKU tăng share ở MT HCM',
    observation: null,
    interpretation: null,
    implication: null,
    recommendation: null,
    audience: null,
    status: 'draft',
    confidence_rationale: null,
    confidence_json: null,
    ai_generated: false,
    created_by: 'analyst@ptt',
    valid_from: null,
    valid_to: null,
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    evidence_ids: [],
    ...overrides,
  };
}
