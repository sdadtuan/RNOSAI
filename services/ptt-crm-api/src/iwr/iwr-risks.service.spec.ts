import { IwrRisksService } from './iwr-risks.service';

describe('IwrRisksService', () => {
  it('createFromBlocker notifies immediately on critical severity', async () => {
    const notify = { insert: jest.fn().mockResolvedValue(undefined) };
    const risks = {
      insert: jest.fn().mockResolvedValue({
        id: 'risk1',
        report_id: 'r1',
        item_id: 'i1',
        title: 'Critical outage',
        severity: 'critical',
        owner_staff_id: 2,
        status: 'open',
        due_at: null,
      }),
      listOpen: jest.fn(),
      getById: jest.fn(),
      updateStatus: jest.fn(),
    };
    const reports = {
      getReport: jest.fn().mockResolvedValue({
        id: 'r1',
        author_staff_id: 3,
        reviewer_staff_id: 2,
      }),
      listItems: jest.fn().mockResolvedValue([
        {
          id: 'i1',
          report_id: 'r1',
          section_key: 'blocked',
          title: 'Critical outage',
          body: 'system down',
          ref_kind: 'none',
          ref_id: null,
          evidence_url: null,
          sort_order: 0,
        },
      ]),
    };
    const svc = new IwrRisksService(risks as never, reports as never, notify as never);
    await svc.createFromBlocker(
      { staffId: 3, staffLabel: 'NV', departmentId: 10, caps: [{ section: 'iwr', action: 'write' }] },
      'r1',
      'i1',
    );

    expect(notify.insert).toHaveBeenCalled();
    const events = notify.insert.mock.calls.map((c) => c[0].event_key);
    expect(events).toContain('iwr_risk_critical');
  });
});
