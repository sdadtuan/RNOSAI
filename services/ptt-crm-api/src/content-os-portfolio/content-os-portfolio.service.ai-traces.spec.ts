import { NotFoundException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object = {}, items: object = {}) {
  return new ContentOsPortfolioService(repo as never, {} as never, marketingRepo as never, items as never);
}

const item = { id: 21, lifecycle_id: 4, title: 'Master', status: 'draft', production_json: {} };

describe('ContentOsPortfolioService.listAiTraces', () => {
  it('404 when the item is outside staff board scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([4]), listAiTraceJobs: jest.fn() };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ ...item, lifecycle_id: 9 }) };
    const svc = makeSvc(repo, marketingRepo);
    await expect(svc.listAiTraces({ staffId: 1, itemId: 21 })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.listAiTraceJobs).not.toHaveBeenCalled();
  });

  it('returns an empty list when the item has no jobs', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listAiTraceJobs: jest.fn().mockResolvedValue([]),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(item) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, marketingRepo, items);
    await expect(svc.listAiTraces({ staffId: 1, itemId: 21 })).resolves.toEqual({ items: [] });
  });

  it('maps jobs to safe traces and never leaks prompts or full json', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listAiTraceJobs: jest.fn().mockResolvedValue([
        {
          id: 55,
          job_type: 'draft_generate',
          status: 'succeeded',
          created_at: '2026-09-10T08:00:00.000Z',
          finished_at: '2026-09-10T08:01:00.000Z',
          ai_run_id: 'run-1',
          input_json: {
            prompt: 'RAW PROMPT',
            system_prompt: 'SYS',
            copilotSources: [{ id: 11, pattern: 'hook-pain', evidence: 'secret' }],
          },
          output_json: { markdown: 'full draft' },
          run: { id: 'run-1', input_json: { userPrompt: 'hidden' } },
        },
      ]),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(item) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, marketingRepo, items);
    const out = await svc.listAiTraces({ staffId: 1, itemId: 21, lifecycleHint: 4 });
    expect(out.items).toEqual([
      {
        at: '2026-09-10T08:01:00.000Z',
        intent: 'Draft generate',
        sources: [{ id: 11, pattern: 'hook-pain' }],
        job_id: 55,
        status: 'succeeded',
        run_id: 'run-1',
      },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/RAW PROMPT|SYS|full draft|userPrompt|input_json|output_json/);
  });

  it('returns job-only traces when the run join is missing', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listAiTraceJobs: jest.fn().mockResolvedValue([
        {
          id: 9,
          job_type: 'regenerate',
          status: 'failed',
          created_at: '2026-09-11T01:00:00.000Z',
          finished_at: null,
          ai_run_id: null,
          input_json: {},
        },
      ]),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(item) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, marketingRepo, items);
    const out = await svc.listAiTraces({ staffId: 1, itemId: 21 });
    expect(out.items).toEqual([
      {
        at: '2026-09-11T01:00:00.000Z',
        intent: 'Regenerate',
        sources: [],
        job_id: 9,
        status: 'failed',
      },
    ]);
  });

  it('does not report a non-optional DB error as an empty trace list', async () => {
    const boom = Object.assign(new Error('too many connections'), { code: '53300' });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listAiTraceJobs: jest.fn().mockRejectedValue(boom),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue(item) };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, marketingRepo, items);
    await expect(svc.listAiTraces({ staffId: 1, itemId: 21 })).rejects.toBe(boom);
  });
});
