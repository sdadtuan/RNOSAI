import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
