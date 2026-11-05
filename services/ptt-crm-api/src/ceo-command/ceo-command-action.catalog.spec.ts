import {
  parseForbiddenRequest,
  previewVi,
  requiredCapsForAction,
  validateActionParams,
} from './ceo-command-action.catalog';

describe('ceo-command-action.catalog', () => {
  it('payroll request is forbidden', () => {
    expect(parseForbiddenRequest('Duyệt lương tháng này')?.href).toBe('/crm/hr');
  });

  it('contract approval request is forbidden (use Hub)', () => {
    expect(parseForbiddenRequest('Duyệt hợp đồng lead 42')?.href).toBe('/crm/hub');
    expect(parseForbiddenRequest('approve contract #99')?.href).toBe('/crm/hub');
  });

  describe('validateActionParams — remind_contract_approval', () => {
    it('requires positive lead_id', () => {
      expect(() => validateActionParams('remind_contract_approval', {})).toThrow('missing_lead_id');
      expect(() => validateActionParams('remind_contract_approval', { lead_id: 0 })).toThrow(
        'missing_lead_id',
      );
    });

    it('accepts lead_id with optional contract_id', () => {
      expect(validateActionParams('remind_contract_approval', { lead_id: 42 })).toEqual({
        lead_id: 42,
      });
      expect(
        validateActionParams('remind_contract_approval', { lead_id: 42, contract_id: 7 }),
      ).toEqual({ lead_id: 42, contract_id: 7 });
    });
  });

  describe('validateActionParams — prioritize_solution_queue', () => {
    it('requires positive lead_id', () => {
      expect(() => validateActionParams('prioritize_solution_queue', {})).toThrow('missing_lead_id');
    });

    it('trims note to 200 chars', () => {
      const long = 'x'.repeat(250);
      const out = validateActionParams('prioritize_solution_queue', {
        lead_id: 30,
        note: long,
      });
      expect(out.lead_id).toBe(30);
      expect(String(out.note)).toHaveLength(200);
    });

    it('omits empty note', () => {
      expect(
        validateActionParams('prioritize_solution_queue', { lead_id: 30, note: '  ' }),
      ).toEqual({ lead_id: 30 });
    });
  });

  it('requiredCapsForAction — both §20 actions need ceo_command.act', () => {
    const cap = [{ section: 'ceo_command', action: 'act' }];
    expect(requiredCapsForAction('remind_contract_approval')).toEqual(cap);
    expect(requiredCapsForAction('prioritize_solution_queue')).toEqual(cap);
  });

  it('previewVi for §20 actions', () => {
    expect(previewVi('remind_contract_approval', { lead_id: 42 })).toBe(
      'Nhắc GDKD duyệt HĐ lead #42?',
    );
    expect(previewVi('prioritize_solution_queue', { lead_id: 30 })).toBe(
      'Ưu tiên queue Solution lead #30?',
    );
  });
});
