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
    expect(n.title).toBe('AM trả về Sales — cần bổ sung Brief');
    expect(n.body).toContain('AM trả về');
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

  it('uses the configured claim window in the assigned-lead notify', () => {
    const n = caseStaffNotify({ kind: 'lead_assigned', leadId: 7, claimMinutes: 1 });
    expect(n.body).toContain('1 phút');
    expect(n.body).not.toContain('15');
  });

  it('notifies the AM when the customer agrees to Solutions', () => {
    const n = caseStaffNotify({ kind: 'customer_agreed_solution', leadId: 11 });
    expect(n.title).toContain('đồng ý Solutions');
    expect(n.link_href).toBe('/crm/leads/11');
  });

  it('notifies the AM when the CEO approves the quote', () => {
    const n = caseStaffNotify({ kind: 'quote_ceo_approved_am', leadId: 11 });
    expect(n.title).toContain('duyệt báo giá');
    expect(n.body).toContain('CEO đã duyệt');
    expect(n.body).toContain('lập hợp đồng');
    expect(n.body).toContain('GĐKD');
  });

  it('tells Sales they may view, while the AM drafts the contract', () => {
    const n = caseStaffNotify({ kind: 'quote_ceo_approved', leadId: 11 });
    expect(n.body).toContain('Sales có thể xem');
    expect(n.body).toContain('AM sẽ lập hợp đồng');
  });

  it('tells the original AM that the case is theirs again', () => {
    const n = caseStaffNotify({ kind: 'auto_reclaim_solution', leadId: 3 });
    expect(n.title).toContain('Submit to AM lại');
    expect(n.body).toContain('làm Solution');
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

describe('new-flow handoff notifies', () => {
  it('notifies AM when Sales submits the Brief', () => {
    const n = caseStaffNotify({ kind: 'submitted_to_am', leadId: 44 });
    expect(n.title).toBe('Sales đã Submit to AM — Chờ Solutions');
    expect(n.body).toContain('làm Solution');
    expect(n.link_href).toBe('/crm/leads/44');
    expect(n.body).not.toMatch(/BANT|SUBMIT FOR SOLUTION|nhận case/i);
  });

  it('notifies the Marketing Leader when AM assigns the case', () => {
    const n = caseStaffNotify({ kind: 'assigned_to_marketing', leadId: 44 });
    expect(n.title).toContain('giao Case Solutions');
    expect(n.body).toContain('Deadline');
    expect(n.link_href).toBe('/crm/leads/44');
  });

  it('tells Sales that AM released the Solution', () => {
    const n = caseStaffNotify({ kind: 'release_to_sales', leadId: 44 });
    expect(n.title).toBe('Solution đã nộp — Chờ báo giá');
    expect(n.body).toContain('AM đã nộp Solution cho Sales');
    expect(n.body).not.toContain('Marketing');
  });

  it('tells the AM to draft the quote after Marketing releases', () => {
    const n = caseStaffNotify({ kind: 'released_to_am', leadId: 44 });
    expect(n.body).toContain('lập báo giá');
    expect(n.link_href).toBe('/crm/leads/44');
  });

  it('tells Sales the AM drafted the contract', () => {
    const n = caseStaffNotify({ kind: 'contract_drafted', leadId: 44 });
    expect(n.title).toBe('AM đã lập hợp đồng');
    expect(n.body).toContain('xem và tải');
  });

  it('notifies involved staff about an internal note, with a lead link', () => {
    const n = caseStaffNotify({ kind: 'internal_note', leadId: 44, reason: 'Cần thêm logo khách' });
    expect(n.title).toBe('Ghi chú nội bộ mới');
    expect(n.body).toContain('Lead #44');
    expect(n.body).toContain('Cần thêm logo khách');
    expect(n.link_href).toBe('/crm/leads/44');
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
