import { CMKT_SLA_TICK_MS } from '../content-os-portfolio/production-sla.util';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';

describe('ContentJobWorkerService', () => {
  const config = { mktAiModel: 'gpt-4o-mini', contentMarketingVideoProvider: 'stub' };
  const aiConfig = { llmApiKey: '', llmModel: 'gpt-4o-mini' };
  const llm = {
    completeJson: jest.fn().mockResolvedValue({
      parsed: { markdown: '# Draft\n\nBody text.' },
      tokenUsage: {},
      modelName: 'gpt-4o-mini',
      stubMode: true,
    }),
  };
  const agentRuns = { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() };
  const repo = {
    claimContentJob: jest.fn(),
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn().mockResolvedValue(2),
    finishContentJob: jest.fn(),
    listItemsWithProductionTasks: jest.fn(),
    insertSlaAudit: jest.fn().mockResolvedValue({ id: 1 }),
    listSlaAudits: jest.fn().mockResolvedValue([]),
    patchSlaFired: jest.fn(),
  };
  const brandContext = {
    resolveForLifecycle: jest.fn().mockResolvedValue({ brand_name: 'Acme' }),
  };

  const mediaImages = {
    providerName: 'stub',
    generateImages: jest.fn().mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          url: 'https://cdn.pttads.vn/cmkt/1/5/asset-1.webp',
          ai_generated: true,
          provider: 'stub',
          selected: true,
          draft_watermark: true,
          clean_storage_key: '1/5/asset-1-clean.webp',
          prompt_hash: 'abc',
          storage_key: '1/5/asset-1.webp',
          visual_qa_score: 84,
          ocr_confidence: 0.8,
          brand_delta_e: 6,
        },
      ],
      qa: {
        score: 84,
        checks: { assets_present: true, dimensions_ok: true, brand_delta_e_ok: true, ocr_confidence_ok: true },
        blocked: false,
        brand_delta_e_max: 6,
        ocr_confidence: 0.8,
      },
    }),
  };
  const mediaVideo = {
    generateShortVideo: jest.fn(),
  };
  const visualQa = {
    scoreAssets: jest.fn().mockReturnValue({
      score: 84,
      checks: { assets_present: true, dimensions_ok: true },
      blocked: false,
    }),
  };
  const social = {
    executeStoryboard: jest.fn(),
    executeRender: jest.fn(),
    executeTranscode: jest.fn(),
    executeQa: jest.fn(),
  };

  let worker: ContentJobWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ContentJobWorkerService(
      config as never,
      aiConfig as never,
      llm as never,
      agentRuns as never,
      repo as never,
      brandContext as never,
      mediaImages as never,
      mediaVideo as never,
      visualQa as never,
      social as never,
    );
  });

  it('processJob draft_generate updates item body', async () => {
    repo.claimContentJob.mockResolvedValue({
      id: 10,
      lifecycle_id: 1,
      item_id: 5,
      job_type: 'draft_generate',
      input_json: { tone: 'professional_friendly' },
      created_by: 'w@test.vn',
    });
    repo.getItemById.mockResolvedValue({
      id: 5,
      channel: 'facebook',
      format: 'social_post',
      title: 'Post',
      funnel_goal: 'engagement',
      brief_json: {},
      body_json: { markdown: '', variants: [] },
    });
    repo.finishContentJob.mockImplementation((_id, patch) => ({ id: 10, status: patch.status, output_json: patch.output_json }));

    const out = await worker.processJob(10);
    expect(repo.patchItem).toHaveBeenCalled();
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ markdown: expect.stringContaining('Draft') }),
      'w@test.vn',
      'ai_generate',
      null,
    );
    expect(out?.status).toBe('succeeded');
  });

  it('does not reject visual_status when social_transcode fails after master exists', async () => {
    repo.claimContentJob.mockResolvedValue({
      id: 20,
      lifecycle_id: 1,
      item_id: 5,
      job_type: 'social_transcode',
      input_json: {},
      created_by: 'w@test.vn',
    });
    repo.getItemById.mockResolvedValue({
      id: 5,
      channel: 'short_video',
      format: 'video_script',
      title: 'Hook',
      body_json: { markdown: 'hook' },
      media_json: { video_short: { url: 'https://cdn.pttads.vn/cmkt/1/5/master.mp4' } },
    });
    social.executeTranscode.mockRejectedValue(new Error('ffmpeg_missing'));
    repo.finishContentJob.mockImplementation((_id, patch) => ({
      id: 20,
      status: patch.status,
      error_text: patch.error_text,
    }));

    const out = await worker.processJob(20);
    expect(out?.status).toBe('failed');
    expect(repo.patchItem).not.toHaveBeenCalledWith(
      1,
      5,
      expect.objectContaining({ visual_status: 'rejected' }),
    );
  });

  const slaNow = new Date('2026-09-11T08:00:00.000Z');

  function slaItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 5,
      lifecycle_id: 1,
      assignee_sp: 3,
      assigned_am: 11,
      production_json: {
        tasks: [
          {
            id: 'copy',
            title: 'Copy',
            assignee_id: null,
            raci: { r: 'sp', a: 'am' },
            depends_on: [],
            sla_h: 10,
            effort_h: 4,
            status: 'doing',
            started_at: '2026-09-11T00:00:00.000Z',
          },
        ],
      },
      ...overrides,
    };
  }

  it('tickProductionSla writes a reminder audit at 80% and persists sla_fired', async () => {
    repo.listItemsWithProductionTasks.mockResolvedValue([slaItem()]);
    await worker.tickProductionSla(slaNow);
    expect(repo.insertSlaAudit).toHaveBeenCalledTimes(1);
    expect(repo.insertSlaAudit).toHaveBeenCalledWith({
      item_id: 5,
      task_id: 'copy',
      threshold: 75,
      action: 'reminder',
      am_staff_id: null,
    });
    expect(repo.patchSlaFired).toHaveBeenCalledWith(5, ['copy:75']);
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('tickProductionSla does not re-emit a fired threshold', async () => {
    repo.listItemsWithProductionTasks.mockResolvedValue([
      slaItem({
        production_json: {
          sla_fired: ['copy:75'],
          tasks: [
            {
              id: 'copy',
              sla_h: 10,
              status: 'doing',
              started_at: '2026-09-11T00:00:00.000Z',
            },
          ],
        },
      }),
    ]);
    await worker.tickProductionSla(slaNow);
    expect(repo.insertSlaAudit).not.toHaveBeenCalled();
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('tickProductionSla breaches over 100% with null AM when only assignee_sp exists', async () => {
    repo.listItemsWithProductionTasks.mockResolvedValue([
      slaItem({ assigned_am: null, assignee_sp: 3 }),
    ]);
    await worker.tickProductionSla(new Date('2026-09-11T10:06:00.000Z'));
    expect(repo.insertSlaAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        task_id: 'copy',
        threshold: 100,
        action: 'breached',
        am_staff_id: null,
      }),
    );
  });

  it('onModuleInit starts a 5-minute SLA timer outside test and onModuleDestroy clears it', () => {
    const prevNode = process.env.NODE_ENV;
    const prevJest = process.env.JEST_WORKER_ID;
    jest.useFakeTimers();
    const tick = jest.spyOn(worker, 'tickProductionSla').mockResolvedValue({ emitted: 0 });
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'development';
    try {
      worker.onModuleInit();
      jest.advanceTimersByTime(CMKT_SLA_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      worker.onModuleDestroy();
      tick.mockClear();
      jest.advanceTimersByTime(CMKT_SLA_TICK_MS);
      expect(tick).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevJest === undefined) delete process.env.JEST_WORKER_ID;
      else process.env.JEST_WORKER_ID = prevJest;
      jest.useRealTimers();
    }
  });

  it('onModuleInit does not start the SLA timer under Jest or NODE_ENV=test', () => {
    jest.useFakeTimers();
    const before = jest.getTimerCount();
    worker.onModuleInit();
    expect(jest.getTimerCount()).toBe(before);
    jest.useRealTimers();
  });

  it('does not treat a unique-conflict insert as a new emit', async () => {
    repo.listItemsWithProductionTasks.mockResolvedValue([slaItem()]);
    repo.insertSlaAudit.mockResolvedValue(null);
    const out = await worker.tickProductionSla(slaNow);
    expect(out).toEqual({ emitted: 0 });
    expect(repo.patchSlaFired).not.toHaveBeenCalled();
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('reminder and at_risk stay in audit but are excluded from AM inbox', async () => {
    const slaRepo = new ContentMarketingRepository({ databaseUrl: 'postgres://unused' } as never);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(false);
    jest.spyOn(slaRepo, 'listItemsWithProductionTasks').mockResolvedValue([
      slaItem({ assigned_am: 11 }),
    ] as never);
    const slaWorker = new ContentJobWorkerService(
      config as never,
      aiConfig as never,
      llm as never,
      agentRuns as never,
      slaRepo,
      brandContext as never,
      mediaImages as never,
      mediaVideo as never,
      visualQa as never,
      social as never,
    );
    await slaWorker.tickProductionSla(new Date('2026-09-11T10:06:00.000Z'));
    const all = await slaRepo.listSlaAudits();
    expect(all.map((row) => row.action)).toEqual(['reminder', 'at_risk', 'breached']);
    expect(all.filter((row) => row.action !== 'breached').every((row) => row.am_staff_id == null)).toBe(true);
    const inbox = await slaRepo.listSlaAudits({ am_staff_id: 11 });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ action: 'breached', am_staff_id: 11, task_id: 'copy' });
  });

  it('breach → listSlaAudits({ am_staff_id: AM }) returns exactly one breached row', async () => {
    const slaRepo = new ContentMarketingRepository({ databaseUrl: 'postgres://unused' } as never);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(false);
    jest.spyOn(slaRepo, 'listItemsWithProductionTasks').mockResolvedValue([
      slaItem({
        assigned_am: 11,
        production_json: {
          sla_fired: ['copy:75', 'copy:90'],
          tasks: [
            {
              id: 'copy',
              sla_h: 10,
              status: 'doing',
              started_at: '2026-09-11T00:00:00.000Z',
            },
          ],
        },
      }),
    ] as never);
    const slaWorker = new ContentJobWorkerService(
      config as never,
      aiConfig as never,
      llm as never,
      agentRuns as never,
      slaRepo,
      brandContext as never,
      mediaImages as never,
      mediaVideo as never,
      visualQa as never,
      social as never,
    );
    await slaWorker.tickProductionSla(new Date('2026-09-11T10:06:00.000Z'));
    const inbox = await slaRepo.listSlaAudits({ am_staff_id: 11 });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ action: 'breached', am_staff_id: 11, task_id: 'copy' });
    expect(await slaRepo.listSlaAudits({ am_staff_id: 99 })).toEqual([]);
  });

  it('insertSlaAudit throws when PG is ready instead of writing memory', async () => {
    const slaRepo = new ContentMarketingRepository({ databaseUrl: 'postgres://unused' } as never);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(true);
    Object.defineProperty(slaRepo, 'pool', {
      configurable: true,
      value: {
        query: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('relation "cmkt_sla_events" does not exist'), { code: '42P01' }),
          ),
      },
    });
    await expect(
      slaRepo.insertSlaAudit({
        item_id: 5,
        task_id: 'copy',
        threshold: 100,
        action: 'breached',
        am_staff_id: 11,
      }),
    ).rejects.toThrow(/cmkt_sla_events/);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(false);
    expect(await slaRepo.listSlaAudits()).toEqual([]);
  });

  it('insertSlaAudit returns null when ON CONFLICT yields no row', async () => {
    const slaRepo = new ContentMarketingRepository({ databaseUrl: 'postgres://unused' } as never);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(true);
    const query = jest.fn().mockResolvedValue({ rows: [] });
    Object.defineProperty(slaRepo, 'pool', { configurable: true, value: { query } });
    const row = await slaRepo.insertSlaAudit({
      item_id: 5,
      task_id: 'copy',
      threshold: 75,
      action: 'reminder',
      am_staff_id: 11,
    });
    expect(row).toBeNull();
    expect(String(query.mock.calls[0][0])).toMatch(/ON CONFLICT/i);
  });

  it('tickProductionSla skips tasks without started_at', async () => {
    repo.listItemsWithProductionTasks.mockResolvedValue([
      slaItem({
        production_json: {
          tasks: [{ id: 'copy', sla_h: 10, status: 'doing' }],
        },
      }),
    ]);
    await worker.tickProductionSla(slaNow);
    expect(repo.insertSlaAudit).not.toHaveBeenCalled();
  });
});
