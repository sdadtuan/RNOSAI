import { parseForbiddenRequest } from './ceo-command-action.catalog';

describe('ceo-command-action.catalog', () => {
  it('payroll request is forbidden', () => {
    expect(parseForbiddenRequest('Duyệt lương tháng này')?.href).toBe('/crm/hr');
  });
});
