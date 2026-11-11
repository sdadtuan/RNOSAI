import { normalizePortalChannel, normalizePortalPageId, portalCrmCareEnabled } from './portal-client-pages.util';

describe('portal client pages', () => {
  const previous = process.env.PTT_PORTAL_CRM_CARE;

  afterEach(() => {
    if (previous == null) delete process.env.PTT_PORTAL_CRM_CARE;
    else process.env.PTT_PORTAL_CRM_CARE = previous;
  });

  it('keeps a numeric Facebook page id', () => {
    expect(normalizePortalPageId(' 159660448507680 ')).toBe('159660448507680');
  });

  it('rejects a short or non-numeric page id', () => {
    expect(normalizePortalPageId('12345')).toBeNull();
    expect(normalizePortalPageId('page-abc')).toBeNull();
  });

  it('stores a Google customer id without dashes', () => {
    expect(normalizePortalChannel('google')).toBe('google');
    expect(normalizePortalPageId('123-456-7890', 'google')).toBe('1234567890');
  });

  it('keeps an ad account id after the act_ prefix', () => {
    expect(normalizePortalChannel('ad_account')).toBe('ad_account');
    expect(normalizePortalPageId('act_285156271715982', 'ad_account')).toBe('285156271715982');
  });

  it('leaves the portal CRM module off until the flag is on', () => {
    delete process.env.PTT_PORTAL_CRM_CARE;
    expect(portalCrmCareEnabled()).toBe(false);
    process.env.PTT_PORTAL_CRM_CARE = 'on';
    expect(portalCrmCareEnabled()).toBe(true);
  });
});
