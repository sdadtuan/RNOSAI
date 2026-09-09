import { filterFieldsForRole } from './performance-acl';

const row = {
  target: 100000,
  actual: 99000,
  disclaimer: 'Dự kiến theo budget 120tr',
  margin: 0.224,
  reviewer_comment: 'internal',
  agency_fee: 18_000_000,
  hr_note: 'calibration private',
  client_visible: true,
};

describe('performance-acl', () => {
  it('client viewer only gets target actual disclaimer (AC-PM-05)', () => {
    expect(filterFieldsForRole(row, 'client_viewer')).toEqual({
      target: 100000,
      actual: 99000,
      disclaimer: 'Dự kiến theo budget 120tr',
    });
  });

  it('finance sees margin and fee but not hr_note', () => {
    const out = filterFieldsForRole(row, 'finance');
    expect(out).toMatchObject({ margin: 0.224, agency_fee: 18_000_000, target: 100000 });
    expect(out).not.toHaveProperty('hr_note');
  });

  it('hr sees hr_note but not margin', () => {
    const out = filterFieldsForRole(row, 'hr');
    expect(out).toMatchObject({ hr_note: 'calibration private', target: 100000 });
    expect(out).not.toHaveProperty('margin');
  });

  it('auditor sees all fields', () => {
    expect(filterFieldsForRole(row, 'auditor')).toEqual(row);
  });
});
