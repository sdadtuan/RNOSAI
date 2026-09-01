import { describe, expect, it } from 'vitest';
import { isCeoPosition, resolveStaffPostLoginPath } from './post-login-path.util';

const ceoUser = {
  email: 'ceo@ptt.vn',
  caps: [{ section: 'ceo_command', action: 'view' }],
  position_code: 'CEO',
} as never;

describe('resolveStaffPostLoginPath', () => {
  it('CEO with ceo caps lands on /crm/ceo', () => {
    expect(resolveStaffPostLoginPath(ceoUser)).toBe('/crm/ceo');
  });

  it('respects explicit next over CEO default', () => {
    expect(resolveStaffPostLoginPath(ceoUser, '/crm/leads')).toBe('/crm/leads');
  });

  it('non-CEO stays on home', () => {
    expect(
      resolveStaffPostLoginPath({
        caps: [{ section: 'crm_leads', action: 'view' }],
        position_code: 'KD-01',
      } as never),
    ).toBe('/');
  });

  it('CEO without ceo nav caps stays on home', () => {
    expect(
      resolveStaffPostLoginPath({
        caps: [{ section: 'crm_leads', action: 'view' }],
        position_code: 'CEO',
      } as never),
    ).toBe('/');
  });
});

describe('isCeoPosition', () => {
  it('matches case-insensitive CEO code', () => {
    expect(isCeoPosition({ position_code: 'ceo' } as never)).toBe(true);
  });
});
