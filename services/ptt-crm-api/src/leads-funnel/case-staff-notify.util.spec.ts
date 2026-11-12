import {
  caseStaffNotify,
  salesNotifyStaffIds,
  slaAlertPredictionScope,
  solutionHandoffMode,
} from './case-staff-notify.util';

describe('solutionHandoffMode', () => {
  it('auto-reclaims when the original AM is known', () => {
    expect(solutionHandoffMode(42)).toBe('auto_reclaim');
  });

  it('falls back to the claim queue when no previous AM', () => {
    expect(solutionHandoffMode(null)).toBe('claim_queue');
    expect(solutionHandoffMode(0)).toBe('claim_queue');
    expect(solutionHandoffMode(undefined)).toBe('claim_queue');
  });
});

describe('caseStaffNotify', () => {
  it('notifies only the responsible Sales with reason and lead link on return', () => {
    const n = caseStaffNotify({
      kind: 'return_missing_info',
      leadId: 99,
      reason: 'Thiếu ngân sách và quyết định viên',
    });
    expect(n.title).toBe('Solutions trả lại — cần bổ sung thông tin');
    expect(n.body).toContain('Lead #99');
    expect(n.body).toContain('Thiếu ngân sách và quyết định viên');
    expect(n.link_href).toBe('/crm/leads/99');
    expect(n.meta_json).toMatchObject({ lead_id: 99, action: 'open_lead' });
  });

  it('puts a Nhận Lead action on a newly assigned lead', () => {
    const n = caseStaffNotify({ kind: 'lead_assigned', leadId: 7 });
    expect(n.title).toBe('Lead mới được giao cho bạn');
    expect(n.body).toContain('15');
    expect(n.meta_json).toEqual({ lead_id: 7, action: 'claim_lead' });
  });

  it('tells the original AM that the case is theirs again', () => {
    const n = caseStaffNotify({ kind: 'auto_reclaim_solution', leadId: 3 });
    expect(n.title).toContain('giao lại');
    expect(n.body).toContain('4');
    expect(n.link_href).toBe('/crm/leads/3');
  });

  it('includes the edit reason for Solutions and quotes', () => {
    const sol = caseStaffNotify({
      kind: 'request_solution_edits',
      leadId: 1,
      reason: 'Cần thêm timeline',
    });
    expect(sol.body).toContain('Cần thêm timeline');
    const quote = caseStaffNotify({
      kind: 'request_quote_edits',
      leadId: 1,
      reason: 'Giá chưa đúng',
    });
    expect(quote.body).toContain('Giá chưa đúng');
    expect(quote.kind).toBe('presales_quote');
  });
});

describe('slaAlertPredictionScope', () => {
  it('forces self-only when scope=self, even for managers with assign cap', () => {
    expect(
      slaAlertPredictionScope({ queryScope: 'self', selfOwnerId: 15, hasAssignCap: true }),
    ).toEqual({ viewAll: false, ownerId: 15 });
  });

  it('lets a manager dashboard see all when scope is not self', () => {
    expect(
      slaAlertPredictionScope({ queryScope: undefined, selfOwnerId: 15, hasAssignCap: true }),
    ).toEqual({ viewAll: true, ownerId: undefined });
  });

  it('filters regular staff to themselves', () => {
    expect(
      slaAlertPredictionScope({ queryScope: '', selfOwnerId: 8, hasAssignCap: false }),
    ).toEqual({ viewAll: false, ownerId: 8 });
  });
});

describe('salesNotifyStaffIds', () => {
  const amIds = [108, 201];

  it('notifies the Sales submitter when handed_off_by is Sales', () => {
    expect(
      salesNotifyStaffIds({
        handedOffBy: 107,
        leadOwner: 107,
        actorStaffId: 108,
        accountManagerStaffIds: amIds,
      }),
    ).toEqual([107]);
  });

  it('falls back to the lead Sales owner when handed_off_by is the AM', () => {
    expect(
      salesNotifyStaffIds({
        handedOffBy: 108,
        leadOwner: 107,
        actorStaffId: 108,
        accountManagerStaffIds: amIds,
      }),
    ).toEqual([107]);
  });

  it('never notifies the AM who returned the case', () => {
    const ids = salesNotifyStaffIds({
      handedOffBy: 108,
      leadOwner: 108,
      actorStaffId: 108,
      accountManagerStaffIds: amIds,
    });
    expect(ids).toEqual([]);
  });

  it('notifies both a different Sales submitter and the owner', () => {
    expect(
      salesNotifyStaffIds({
        handedOffBy: 106,
        leadOwner: 107,
        actorStaffId: 108,
        accountManagerStaffIds: amIds,
      }).sort(),
    ).toEqual([106, 107]);
  });
});
