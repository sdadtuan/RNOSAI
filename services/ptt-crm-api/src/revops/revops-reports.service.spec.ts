import { RevopsCommissionService } from './revops-commission.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsReportsService } from './revops-reports.service';
import { RevopsRoutingService } from './revops-routing.service';
import { RevopsSlaService } from './revops-sla.service';

describe('RevopsReportsService', () => {
  const actor = { staffId: 1, caps: [{ section: 'crm_revops', action: 'view' }] };

  function build() {
    const dashboard = {
      get: jest.fn().mockResolvedValue({
        period: '2026-09',
        bu: 'all',
        revenue: { actualVnd: 1_245_000_000, targetVnd: 1_500_000_000 },
        atRisk: [{ id: 'r1', kind: 'renewal', title: 'XYZ Spa', href: '/x', severity: 'warning' }],
      }),
    } as unknown as RevopsDashboardService;
    const commission = {
      getHub: jest.fn().mockResolvedValue({
        summary: { estimatedVnd: 84_650_000, approvedVnd: 57_250_000, pendingVnd: 27_400_000 },
        projections: { newVnd: 648_000_000, renewalVnd: 375_000_000, upsellVnd: 222_000_000, slaVnd: 0, totalVnd: 1_245_000_000 },
        transactions: [{ id: 't1', dealRef: 'DH-1', commissionVnd: -1_800_000, status: 'clawback' }],
      }),
    } as unknown as RevopsCommissionService;
    const sla = {
      getCenter: jest.fn().mockResolvedValue({
        kpis: { compliancePct: 92, breaches: 3 },
        incidents: [{ id: 'i1', title: 'Lead breach', status: 'breached', dueAt: '2026-09-06T08:00:00Z' }],
      }),
    } as unknown as RevopsSlaService;
    const routing = {
      getCenter: jest.fn().mockResolvedValue({
        territories: [{ id: 'ter-1', name: 'HCM Enterprise' }],
      }),
    } as unknown as RevopsRoutingService;
    const svc = new RevopsReportsService(dashboard, commission, sla, routing);
    return { svc, dashboard, commission, sla, routing };
  }

  it('returns 4 seeded reports and dashboard cards', async () => {
    const { svc } = build();
    const out = await svc.get(actor, { period: '2026-09', bu: 'all', territory: 'all' });
    expect(out.library).toHaveLength(4);
    expect(out.filters.currency).toBe('VND');
    expect(out.cards.revenueMix.rows).toHaveLength(3);
    expect(out.cards.commissionLiability.clawbackVnd).toBe(1_800_000);
    expect(out.territoryOptions.length).toBeGreaterThan(1);
  });

  it('exports CSV for known slug', async () => {
    const { svc } = build();
    const out = await svc.exportCsv(actor, 'lead-sla-leakage', { period: '2026-09' });
    expect(out.filename).toContain('lead-sla-leakage');
    expect(out.csv).toContain('incident_id,title,status,due_at');
  });

  it('rejects unknown slug', async () => {
    const { svc } = build();
    await expect(svc.exportCsv(actor, 'not-a-report', {})).rejects.toThrow('Unknown report');
  });
});
