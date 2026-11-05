import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';
import type { CmktInsightRow } from './copilot-insights.util';

function makeSvc(repo: object) {
  return new ContentOsPortfolioService(repo as never, {} as never, {} as never, {} as never);
}

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

describe('ContentOsPortfolioService.listInsights', () => {
  it('lists Draft and Approved insights in staff portfolio scope', async () => {
    const draft = insight({ id: 1, status: 'Draft' });
    const approved = insight({ id: 2, status: 'Approved', lifecycle_id: 7 });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listInsights: jest.fn().mockResolvedValue([draft, approved]),
    };
    const svc = makeSvc(repo);
    const out = await svc.listInsights({ staffId: 9 });
    expect(repo.listInsights).toHaveBeenCalledWith([4, 7], ['Draft', 'Approved']);
    expect(out.items).toEqual([draft, approved]);
  });

  it('filters to lifecycle hint when that id is in scope', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listInsights: jest.fn().mockResolvedValue([insight({ id: 1, status: 'Draft' })]),
    };
    const svc = makeSvc(repo);
    await svc.listInsights({ staffId: 9, lifecycleHint: 4 });
    expect(repo.listInsights).toHaveBeenCalledWith([4], ['Draft', 'Approved']);
  });

  it('returns empty when staff has no scoped lifecycles', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), listInsights: jest.fn() };
    const svc = makeSvc(repo);
    await expect(svc.listInsights({ staffId: 9 })).resolves.toEqual({ items: [] });
    expect(repo.listInsights).not.toHaveBeenCalled();
  });

  it('does not report a query error as an empty insight list', async () => {
    const boom = Object.assign(new Error('too many connections'), { code: '53300' });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listInsights: jest.fn().mockRejectedValue(boom),
    };
    const svc = makeSvc(repo);
    await expect(svc.listInsights({ staffId: 9 })).rejects.toBe(boom);
  });
});

describe('ContentOsPortfolioService.approveInsight', () => {
  it('approves a Draft insight in scope (human only)', async () => {
    const draft = insight({ id: 11, status: 'Draft' });
    const approved = { ...draft, status: 'Approved' as const };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(draft),
      updateInsightStatus: jest.fn().mockResolvedValue(approved),
    };
    const svc = makeSvc(repo);
    const out = await svc.approveInsight({ staffId: 9, insightId: 11 });
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(11, 'Approved');
    expect(out.status).toBe('Approved');
  });

  it('returns 409 when insight is not Draft', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(insight({ id: 11, status: 'Approved' })),
      updateInsightStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveInsight({ staffId: 9, insightId: 11 })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when insight lifecycle is outside staff scope', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(insight({ id: 11, status: 'Draft', lifecycle_id: 99 })),
      updateInsightStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveInsight({ staffId: 9, insightId: 11 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when insight is missing', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(null),
      updateInsightStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveInsight({ staffId: 9, insightId: 404 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when a race flips Draft after the pre-check', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(insight({ id: 11, status: 'Draft' })),
      updateInsightStatus: jest.fn().mockRejectedValue(new Error('insight_not_draft:11')),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveInsight({ staffId: 9, insightId: 11 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 when a race deletes the insight after the pre-check', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getInsightById: jest.fn().mockResolvedValue(insight({ id: 11, status: 'Draft' })),
      updateInsightStatus: jest.fn().mockRejectedValue(new Error('insight_not_found:11')),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveInsight({ staffId: 9, insightId: 11 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
