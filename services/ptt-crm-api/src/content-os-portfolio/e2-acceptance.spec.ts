import { ContentJobWorkerService } from '../content-marketing/content-job-worker.service';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import {
  formatCopilotSourcesPromptSection,
  selectCopilotSources,
  type CmktInsightRow,
} from './copilot-insights.util';
import { computeCapacity } from './production-capacity.util';
import { evaluateProductionSla } from './production-sla.util';

function insight(partial: Partial<CmktInsightRow> & Pick<CmktInsightRow, 'id' | 'status'>): CmktInsightRow {
  return {
    lifecycle_id: 4,
    pattern: `pattern-${partial.id}`,
    evidence: `evidence-${partial.id}`,
    confidence: 0.8,
    scope_json: {},
    expires_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

function workerStubs() {
  return {
    config: { mktAiModel: 'gpt-4o-mini', contentMarketingVideoProvider: 'stub' },
    aiConfig: { llmApiKey: '', llmModel: 'gpt-4o-mini' },
    llm: { completeJson: jest.fn() },
    agentRuns: { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() },
    brandContext: { resolveForLifecycle: jest.fn() },
    mediaImages: { generateImages: jest.fn() },
    mediaVideo: { generateShortVideo: jest.fn() },
    visualQa: { scoreAssets: jest.fn() },
    social: {
      executeStoryboard: jest.fn(),
      executeRender: jest.fn(),
      executeTranscode: jest.fn(),
      executeQa: jest.fn(),
    },
  };
}

describe('E2 control room acceptance', () => {
  const now = new Date('2026-09-11T03:00:00.000Z');

  it('does not put a Draft insight into copilotSources generate context', () => {
    const draft = insight({
      id: 1,
      status: 'Draft',
      pattern: 'draft-secret',
      evidence: 'should-not-ground',
    });
    const approved = insight({
      id: 2,
      status: 'Approved',
      pattern: 'reel-hook',
      evidence: '3s hook lifts watch',
    });

    const sources = selectCopilotSources([draft, approved], now);
    expect(sources.map((row) => row.id)).toEqual([2]);
    expect(sources.map((row) => row.pattern)).not.toContain('draft-secret');

    const section = formatCopilotSourcesPromptSection(sources);
    expect(section).toContain('Approved insights (copilot whitelist)');
    expect(section).toContain('reel-hook');
    expect(section).not.toContain('draft-secret');
    expect(section).not.toContain('should-not-ground');
  });

  it('keeps capacity_pct null instead of a fake 78%', () => {
    const empty = computeCapacity([]);
    const noEffort = computeCapacity([{ assignee_sp: 1, production_json: {} }]);
    const noAssignee = computeCapacity([{ assignee_sp: null, production_json: { effort_h: 20 } }]);

    expect(empty).toEqual({ capacity_pct: null, capacity_band: null });
    expect(noEffort.capacity_pct).toBeNull();
    expect(noAssignee.capacity_pct).toBeNull();
    expect(empty.capacity_pct).not.toBe(78);
    expect(noEffort.capacity_pct).not.toBe(78);
    expect(noAssignee.capacity_pct).not.toBe(78);
  });

  it('SLA escalation writes an audit readable via listSlaAudits', async () => {
    const slaRepo = new ContentMarketingRepository({ databaseUrl: 'postgres://unused' } as never);
    jest.spyOn(slaRepo, 'ensurePgReady').mockResolvedValue(false);

    const created = await slaRepo.createItem(1, {
      title: 'Reel',
      channel: 'facebook',
      format: 'social_post',
      funnel_goal: 'engagement',
      idea_id: null,
      brief_json: {},
      body_json: { markdown: '', variants: [] },
      created_by: 'am@test.vn',
    });
    const production = {
      tasks: [
        {
          id: 'copy',
          sla_h: 10,
          status: 'doing',
          started_at: '2026-09-11T00:00:00.000Z',
        },
      ],
    };
    await slaRepo.patchItem(1, created.id, { production_json: production });

    const tickAt = new Date('2026-09-11T10:06:00.000Z');
    const evaluated = evaluateProductionSla({ production_json: production }, tickAt);
    expect(evaluated.events.map((ev) => ev.action)).toEqual(['reminder', 'at_risk', 'breached']);

    const stubs = workerStubs();
    const worker = new ContentJobWorkerService(
      stubs.config as never,
      stubs.aiConfig as never,
      stubs.llm as never,
      stubs.agentRuns as never,
      slaRepo,
      stubs.brandContext as never,
      stubs.mediaImages as never,
      stubs.mediaVideo as never,
      stubs.visualQa as never,
      stubs.social as never,
    );

    const tick = await worker.tickProductionSla(tickAt);
    expect(tick.emitted).toBe(3);

    const audits = await slaRepo.listSlaAudits();
    expect(audits).toHaveLength(3);
    expect(audits.map((row) => row.action)).toEqual(['reminder', 'at_risk', 'breached']);
    expect(audits.every((row) => row.item_id === created.id && row.task_id === 'copy')).toBe(true);
  });

  it('SLA inbox listSlaEvents only returns events for in-scope items', async () => {
    const { ContentOsPortfolioService } = await import('./content-os-portfolio.service');
    const inScope = {
      id: 1,
      item_id: 21,
      task_id: 'copy',
      threshold: 100,
      action: 'breached',
      am_staff_id: 11,
      created_at: '2026-09-11T10:06:00.000Z',
    };
    const leaked = { ...inScope, id: 2, item_id: 99, am_staff_id: 22 };
    const svc = new ContentOsPortfolioService(
      { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]) } as never,
      {} as never,
      {
        listSlaAudits: jest.fn().mockResolvedValue([inScope, leaked]),
        findItemById: jest.fn(async (id: number) =>
          id === 21 ? { id: 21, lifecycle_id: 4 } : { id: 99, lifecycle_id: 88 },
        ),
      } as never,
      {} as never,
    );
    const out = await svc.listSlaEvents({ staffId: 9 });
    expect(out.items).toEqual([inScope]);
    expect(out.items.map((row) => row.item_id)).not.toContain(99);
  });
});

