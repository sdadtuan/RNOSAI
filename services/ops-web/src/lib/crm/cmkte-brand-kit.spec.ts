import { describe, expect, it } from 'vitest';
import { canOpenCreativeOsBrandKit } from './cmkte-brand-kit';

describe('canOpenCreativeOsBrandKit', () => {
  it('is true only when caps include crm_cp.view', () => {
    expect(canOpenCreativeOsBrandKit([{ section: 'crm_cp', action: 'view' }])).toBe(true);
  });

  it('is false without crm_cp.view', () => {
    expect(canOpenCreativeOsBrandKit([{ section: 'crm_content', action: 'view' }])).toBe(false);
    expect(canOpenCreativeOsBrandKit([{ section: 'crm_cp', action: 'edit' }])).toBe(false);
    expect(canOpenCreativeOsBrandKit([{ section: 'crm_agency', action: 'view' }])).toBe(false);
    expect(canOpenCreativeOsBrandKit([])).toBe(false);
    expect(canOpenCreativeOsBrandKit(null)).toBe(false);
    expect(canOpenCreativeOsBrandKit(undefined)).toBe(false);
  });
});
