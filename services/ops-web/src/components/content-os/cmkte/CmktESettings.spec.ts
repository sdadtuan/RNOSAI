import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AUDIT_RETENTION_COPY } from '@/lib/crm/cmkte-settings';
import { CmktESettings } from './CmktESettings';

describe('CmktESettings SSO flag', () => {
  it('exposes sso_enforced read-only and false when no IdP is configured', () => {
    const html = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, ssoEnforced: false }),
    );
    expect(html).toMatch(/sso_enforced|SSO enforced|SSO bắt buộc/i);
    expect(html).toMatch(/disabled[^>]*role="switch"|role="switch"[^>]*disabled/i);
    expect(html).not.toMatch(/name="sso_enforced"[^>]*checked|sso_enforced[^>]*checked/i);
  });

  it('exposes sso_enforced read-only and checked when staff IdP is enforced', () => {
    const html = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, ssoEnforced: true }),
    );
    expect(html).toMatch(/sso_enforced|SSO enforced|SSO bắt buộc/i);
    expect(html).toMatch(/disabled[^>]*role="switch"|role="switch"[^>]*disabled/i);
    expect(html).toMatch(/name="sso_enforced"[^>]*checked|checked[^>]*name="sso_enforced"/i);
  });
});

describe('CmktESettings audit export + retention', () => {
  it('enables Audit export and shows 7-year retention copy', () => {
    const html = renderToStaticMarkup(createElement(CmktESettings, { context: null }));
    expect(html).toMatch(/<button[^>]*>\s*Audit export\s*<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\s*Audit export/);
    expect(html).toContain(AUDIT_RETENTION_COPY);
    expect(html).toMatch(/Audit lưu 7 năm/);
  });
});

describe('CmktESettings Connect Page', () => {
  it('shows Connect Page and Disconnect without access_token', () => {
    const html = renderToStaticMarkup(
      createElement(CmktESettings, {
        context: null,
        accounts: [
          {
            id: 1,
            channel: 'facebook_page',
            display_name: 'PTT Ads',
            account_ref: '555',
            health: { status: 'Connected' },
          },
        ],
      }),
    );
    expect(html).toContain('Connect Page');
    expect(html).toContain('Disconnect');
    expect(html).toContain('Connected');
    expect(html).not.toContain('access_token');
    expect(html).not.toMatch(/WIN · E4/);
    expect(html).not.toMatch(/Instagram|Website CMS/);
  });

  it('tags Manual when the Page is not connected', () => {
    const html = renderToStaticMarkup(
      createElement(CmktESettings, {
        context: null,
        accounts: [
          {
            id: 1,
            channel: 'facebook_page',
            display_name: 'PTT Ads',
            account_ref: '555',
            health: { status: 'Manual' },
          },
        ],
      }),
    );
    expect(html).toContain('Manual');
    expect(html).toContain('Connect Page');
    expect(html).toContain('Disconnect');
    expect(html).not.toContain('access_token');
  });
});

describe('CmktESettings direct social publish label', () => {
  it('labels the switch from the current enabled state', () => {
    const off = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, directSocialPublish: false }),
    );
    const on = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, directSocialPublish: true }),
    );
    expect(off).toMatch(/Direct social publish connector \(tắt · disabled\)/);
    expect(on).toMatch(/Direct social publish connector \(bật · enabled\)/);
    expect(on).not.toMatch(/tắt · disabled/);
  });
});

