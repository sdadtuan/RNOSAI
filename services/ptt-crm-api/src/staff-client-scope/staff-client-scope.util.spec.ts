import {
  assertClientInScope,
  capAllows,
  isClientScopeRestricted,
  isSuperAdminPositionCode,
  normalizeClientIds,
} from './staff-client-scope.util';

describe('staff-client-scope.util', () => {
  it('detects super-admin bypass', () => {
    expect(isSuperAdminPositionCode('super-admin')).toBe(true);
    expect(isSuperAdminPositionCode('SUPER-ADMIN')).toBe(true);
    expect(isSuperAdminPositionCode('AM-01')).toBe(false);
  });

  it('capAllows honors compact SUPER-ADMIN wildcard without exploding grants', () => {
    const star = [{ section: '*', action: '*' }];
    expect(capAllows(star, 'crm_leads', 'view')).toBe(true);
    expect(capAllows(star, 'crm_board', 'view')).toBe(true);
    expect(capAllows(star, 'crm_presales_solution', 'claim')).toBe(true);
    expect(capAllows(star, 'crm_gdkd', 'view_all_leads')).toBe(true);
    expect(capAllows([], 'crm_leads', 'view')).toBe(false);
    expect(capAllows([{ section: 'crm_leads', action: 'view' }], 'crm_leads', 'edit')).toBe(false);
  });

  it('restricts only when pilot on and bindings exist', () => {
    expect(isClientScopeRestricted(false, 'AM-01', ['uuid-1'])).toBe(false);
    expect(isClientScopeRestricted(true, 'super-admin', ['uuid-1'])).toBe(false);
    expect(isClientScopeRestricted(true, 'AM-01', [])).toBe(false);
    expect(isClientScopeRestricted(true, 'AM-01', ['uuid-1'])).toBe(true);
  });

  it('checks client membership', () => {
    const allowed = normalizeClientIds(['a', 'b']);
    expect(assertClientInScope('a', allowed)).toBe(true);
    expect(assertClientInScope('c', allowed)).toBe(false);
    expect(assertClientInScope(null, allowed)).toBe(false);
  });
});
