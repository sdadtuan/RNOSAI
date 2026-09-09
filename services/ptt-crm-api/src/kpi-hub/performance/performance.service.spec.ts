import { BadRequestException } from '@nestjs/common';
import { PerformanceService } from './performance.service';

describe('PerformanceService', () => {
  it('lists seeded assignments and creates a draft', async () => {
    const svc = new PerformanceService();
    const before = (await svc.listAssignments()).items.length;
    const created = svc.createAssignment({
      name: 'Lead đủ điều kiện Q4',
      owner: 'Nguyễn Minh Anh',
      scope_type: 'department',
      scope_name: 'Sales',
      target: 1200,
      direction: 'higher',
    });
    expect(created.status).toBe('no_data');
    expect((await svc.listAssignments()).items.length).toBe(before + 1);
  });

  it('rejects scorecard item when weight exceeds 100', () => {
    const svc = new PerformanceService();
    const sc = svc.listScorecards().items[0];
    expect(sc.weight_valid).toBe(true);
    try {
      svc.addScorecardItem(sc.id, {
        name: 'Extra',
        definition_code: 'X',
        weight: 15,
        target_label: '1',
        unit: '',
        formula: '',
        owner: 'A',
      });
      throw new Error('expected weight block');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'weight_exceeds_100' });
    }
  });

  it('requires blocker note on red check-in', async () => {
    const svc = new PerformanceService();
    await expect(
      svc.createCheckIn({ assignment_id: 'asg-p1', note: '', actual: 5.2 }),
    ).rejects.toMatchObject({
      response: { error: 'blocker_required_when_red' },
    });
    const saved = await svc.createCheckIn({
      assignment_id: 'asg-p1',
      note: '03 blocker P1',
      actual: 5.2,
    });
    expect(saved.status).toBe('red');
  });

  it('refuses overwrite of verified auto actual (AC-PM-08)', async () => {
    const svc = new PerformanceService();
    await expect(svc.createCheckIn({ assignment_id: 'asg-cpa', note: 'ok', actual: 1 })).rejects.toMatchObject({
      response: { error: 'actual_locked' },
    });
  });

  it('activate blocked without measurement plan', () => {
    const svc = new PerformanceService();
    const draft = svc.createAssignment({
      name: 'CPL custom orphan',
      definition_code: 'MKT_006',
      owner: 'Lê Hoàng',
      scope_type: 'campaign',
      scope_name: 'Orphan',
      target: 100000,
      direction: 'lower',
      collection_method: 'api',
    });
    try {
      svc.activateAssignment(draft.id);
      throw new Error('expected block');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'readiness_blocked' });
    }
  });

  it('close refused when quality pending (AC-PM-04)', () => {
    const svc = new PerformanceService();
    try {
      svc.closePeriod({ scorecard_id: 'sc-mkt-lead-q4', period: 'Q4-2026' });
      throw new Error('expected quality block');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'quality_blocks_close' });
    }
  });

  it('marketing roas is N/A without attribution (AC-PM-09)', () => {
    const svc = new PerformanceService();
    expect(svc.getMarketing().roas).toEqual({
      value: null,
      display: 'N/A',
      reason: 'Thiếu attribution model',
    });
  });

  it('hydrates assignment actual from service kpi instance when repo provided', async () => {
    const repo = {
      listRecentActuals: async () => [{ instance_id: 'inst-1', value: 99000, quality_status: 'valid' }],
    };
    const svc = new PerformanceService(repo as never);
    svc.createAssignment({
      name: 'CPL hydrated',
      definition_code: 'MKT_006',
      owner: 'Lê Hoàng',
      scope_type: 'campaign',
      scope_name: 'An Phát',
      target: 100000,
      direction: 'lower',
      instance_id: 'inst-1',
    });
    const items = (await svc.listAssignments()).items;
    const row = items.find((a) => a.instance_id === 'inst-1');
    expect(row?.actual).toBe(99000);
    expect(row?.quality).toBe('verified');
  });
});
