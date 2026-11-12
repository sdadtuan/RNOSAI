import { describe, expect, it } from 'vitest';
import { leadPropertyRows } from './lead-property-rows';

describe('leadPropertyRows', () => {
  it('lists contact, source, and owner for the property rail', () => {
    const rows = leadPropertyRows(
      {
        phone: '0901 234 567',
        email: 'am@pttads.vn',
        source: 'Facebook',
        channel: 'form',
        project_code: 'SEO-HCM',
        ai_band: 'hot',
        created_at: '2026-08-25T03:00:00.000Z',
      },
      'Lan',
    );
    expect(rows.map((r) => r.key)).toEqual([
      'phone',
      'email',
      'source',
      'channel',
      'project',
      'owner',
      'created',
      'band',
    ]);
    expect(rows.find((r) => r.key === 'owner')?.label).toBe('Phụ trách');
    expect(rows.find((r) => r.key === 'owner')?.value).toBe('Lan');
    expect(rows.find((r) => r.key === 'band')).toEqual({
      key: 'band',
      label: 'Hạng',
      value: 'Nóng',
      tone: 'hot',
    });
    expect(rows.find((r) => r.key === 'created')?.value).toBe('2026-08-25');
  });

  it('hides channel when it matches source', () => {
    const rows = leadPropertyRows({
      phone: '090',
      email: 'a@b.com',
      source: 'facebook',
      channel: 'Facebook',
      project_code: '',
      created_at: '2026-01-01',
    });
    expect(rows.some((r) => r.key === 'channel')).toBe(false);
    expect(rows.find((r) => r.key === 'source')?.value).toBe('facebook');
  });

  it('falls back when fields are empty', () => {
    const rows = leadPropertyRows({
      phone: '',
      email: '',
      source: '',
      channel: '',
      created_at: '',
    });
    expect(rows.find((r) => r.key === 'owner')?.value).toBe('Chưa phân');
    expect(rows.some((r) => r.key === 'band')).toBe(false);
  });
});
