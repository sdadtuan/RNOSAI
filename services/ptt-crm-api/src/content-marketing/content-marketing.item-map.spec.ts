import { mapItemRow } from './content-marketing.repository';

describe('mapItemRow legal_hold', () => {
  const base = {
    id: 21,
    lifecycle_id: 4,
    title: 'Held story',
    created_at: '2026-09-11T00:00:00.000Z',
    updated_at: '2026-09-11T00:00:00.000Z',
  };

  it('returns legal_hold from the selected row and legal_hold_set_by when selected', () => {
    const held = mapItemRow({
      ...base,
      legal_hold: true,
      legal_hold_set_by: 'w@ptt.vn',
    });
    expect(held.legal_hold).toBe(true);
    expect(held.legal_hold_set_by).toBe('w@ptt.vn');

    const off = mapItemRow({ ...base, legal_hold: false });
    expect(off.legal_hold).toBe(false);
    expect(off.legal_hold_set_by).toBeUndefined();
  });
});
