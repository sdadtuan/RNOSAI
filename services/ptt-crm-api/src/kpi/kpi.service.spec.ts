import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { KpiPgRepository } from './kpi-pg.repository';
import { KpiService } from './kpi.service';

describe('KpiService', () => {
  it('serves KPI reads and writes from PostgreSQL only', async () => {
    const metric = { id: 1, name: 'Revenue' };
    const pg = {
      listMetrics: jest.fn().mockResolvedValue([metric]),
      createMetric: jest.fn().mockResolvedValue(metric),
      patchMetric: jest.fn().mockResolvedValue(metric),
      listStaffKpi: jest.fn().mockResolvedValue([]),
      exportStaffKpi: jest.fn().mockResolvedValue({
        staff_kpi: [],
        year: 2026,
        month: 8,
      }),
    } as unknown as KpiPgRepository;
    const service = new KpiService(
      pg,
      undefined as unknown as LeadsFunnelService,
    );

    await expect(service.listMetrics(false)).resolves.toEqual({ metrics: [metric] });
    await expect(service.createMetric({ name: ' Revenue ' })).resolves.toBe(metric);
    await expect(service.patchMetric(1, { name: 'Revenue' })).resolves.toBe(metric);
    await expect(service.listStaffKpi('2026', '8')).resolves.toEqual({ staff_kpi: [] });
    await expect(service.exportStaffKpi('2026', '8')).resolves.toEqual({
      staff_kpi: [],
      year: 2026,
      month: 8,
    });

    expect(pg.listMetrics).toHaveBeenCalledWith(false);
    expect(pg.createMetric).toHaveBeenCalledWith({ name: 'Revenue' });
    expect(pg.patchMetric).toHaveBeenCalledWith(1, { name: 'Revenue' });
    expect(pg.listStaffKpi).toHaveBeenCalledWith(2026, 8, undefined);
    expect(pg.exportStaffKpi).toHaveBeenCalledWith(2026, 8, undefined);
  });

  it('filters staff KPI list by team when provided', async () => {
    const pg = {
      listStaffKpi: jest.fn().mockResolvedValue([
        { id: 1, staff_id: 10, staff_department: 'Sales' },
        { id: 2, staff_id: 11, staff_department: 'CSKH' },
      ]),
      staffIdsForTeam: jest.fn().mockResolvedValue([10]),
    } as unknown as KpiPgRepository;
    const service = new KpiService(pg, undefined as unknown as LeadsFunnelService);
    await expect(service.listStaffKpi('2026', '9', undefined, 'sales')).resolves.toEqual({
      staff_kpi: [{ id: 1, staff_id: 10, staff_department: 'Sales' }],
    });
    expect(pg.staffIdsForTeam).toHaveBeenCalledWith('sales');
  });
});
