import { RevopsPipelineRepository } from './revops-pipeline.repository';
import { RevopsPipelineService } from './revops-pipeline.service';

describe('RevopsPipelineService', () => {
  const actor = { staffId: 9, caps: [{ section: 'crm_revops', action: 'view_all' }] };

  it('aggregates kanban columns and counts stale deals from close_date', async () => {
    const repo = {
      listDeals: jest.fn().mockResolvedValue([
        {
          leadId: 1,
          name: 'Deal A',
          product: 'meta-lead-gen',
          amountVnd: 100_000_000,
          closeDate: '2026-08-01',
          ownerName: 'Lan',
          presalesStage: 'consult',
          hasProposal: false,
          contractApprovalPending: false,
          leadStatus: 'dang_tu_van',
          stageEnteredAt: '2026-08-20T00:00:00.000Z',
          lastActivityAt: '2026-08-25T00:00:00.000Z',
        },
        {
          leadId: 2,
          name: 'Deal B',
          product: 'seo',
          amountVnd: 50_000_000,
          closeDate: '2026-10-01',
          ownerName: 'Huy',
          presalesStage: 'proposal',
          hasProposal: true,
          contractApprovalPending: false,
          leadStatus: 'bao_gia',
          stageEnteredAt: '2026-09-01T00:00:00.000Z',
          lastActivityAt: '2026-09-05T00:00:00.000Z',
        },
        {
          leadId: 3,
          name: 'Deal C',
          product: 'seo',
          amountVnd: 20_000_000,
          closeDate: '2026-07-01',
          ownerName: 'Huy',
          presalesStage: 'proposal',
          hasProposal: true,
          contractApprovalPending: true,
          leadStatus: 'bao_gia',
          stageEnteredAt: '2026-07-01T00:00:00.000Z',
          lastActivityAt: '2026-07-10T00:00:00.000Z',
        },
      ]),
    } as unknown as RevopsPipelineRepository;

    const svc = new RevopsPipelineService(repo);
    const out = await svc.get(actor, { view: 'kanban' });

    expect(out.columns).toHaveLength(5);
    expect(out.columns.find((c) => c.stage === 'qualified')?.count).toBe(1);
    expect(out.columns.find((c) => c.stage === 'negotiation')?.count).toBe(1);
    expect(out.columns.find((c) => c.stage === 'contract_review')?.count).toBe(1);
    expect(out.kpis.staleCount).toBe(2);
    expect(out.kpis.totalVnd).toBe(170_000_000);
    expect(out.columns.find((c) => c.stage === 'qualified')?.cards[0]?.href).toBe(
      '/crm/leads/1/deal-room',
    );
    expect(repo.listDeals).toHaveBeenCalledWith({ scope: 'all', staffId: 9 });
  });

  it('returns empty pipeline when repository fails', async () => {
    const repo = {
      listDeals: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as RevopsPipelineRepository;
    const svc = new RevopsPipelineService(repo);
    const out = await svc.get(actor, {});
    expect(out.kpis.staleCount).toBe(0);
    expect(out.columns.every((c) => c.count === 0)).toBe(true);
  });
});
