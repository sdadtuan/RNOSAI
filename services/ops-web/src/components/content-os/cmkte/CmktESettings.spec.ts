import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AUDIT_RETENTION_COPY } from '@/lib/crm/cmkte-settings';
import {
  CmktESettings,
  disconnectConnectorId,
  facebookConnectStatusCopy,
  holdErrorToast,
  FB_CONNECT_ERROR_TOAST,
  FB_CONNECT_OK_TOAST,
  HOLD_FORBIDDEN_TOAST,
  HOLD_REASON_TOAST,
} from './CmktESettings';

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

describe('CmktESettings Disconnect', () => {
  it('uses connector_id when present and does not fall back to account id', () => {
    expect(disconnectConnectorId({ connector_id: 9 })).toBe(9);
    expect(disconnectConnectorId({ connector_id: 0 })).toBeNull();
    expect(disconnectConnectorId({ connector_id: null })).toBeNull();
    expect(disconnectConnectorId({ id: 1 } as { id: number; connector_id?: number | null })).toBeNull();

    const missing = renderToStaticMarkup(
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
        onDisconnect: async () => undefined,
      }),
    );
    expect(missing).toMatch(/<button[^>]*disabled[^>]*>\s*Disconnect/);
    expect(missing).not.toContain('access_token');

    const present = renderToStaticMarkup(
      createElement(CmktESettings, {
        context: null,
        accounts: [
          {
            id: 1,
            connector_id: 9,
            channel: 'facebook_page',
            display_name: 'PTT Ads',
            account_ref: '555',
            health: { status: 'Connected' },
          },
        ],
        onDisconnect: async () => undefined,
      }),
    );
    expect(present).toContain('Disconnect');
    expect(present).not.toMatch(/<button[^>]*disabled[^>]*>\s*Disconnect/);
    expect(present).not.toContain('access_token');
    expect(JSON.stringify({ id: 1, connector_id: 9 })).not.toMatch(/access_token|refresh_token/);
  });
});

describe('CmktESettings Connect Page', () => {
  it('does not navigate to the JWT-guarded start route from the button', () => {
    const src = readFileSync(join(__dirname, 'CmktESettings.tsx'), 'utf8');
    expect(src).not.toMatch(/window\.location\.assign\(facebookOAuthStartUrl\(\)\)/);
    expect(src).toMatch(/startFacebookOAuth/);
    expect(src).toMatch(/isSafeFacebookDialogRedirect/);
  });

  it('shows Vietnamese OAuth status from ?fb=ok|error without a token', () => {
    const ok = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, fbStatus: 'ok' }),
    );
    const err = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, fbStatus: 'error' }),
    );
    expect(ok).toContain(FB_CONNECT_OK_TOAST);
    expect(err).toContain(FB_CONNECT_ERROR_TOAST);
    expect(ok).not.toContain('access_token');
    expect(err).not.toContain('access_token');
    expect(facebookConnectStatusCopy('ok')).toBe(FB_CONNECT_OK_TOAST);
    expect(facebookConnectStatusCopy('error')).toBe(FB_CONNECT_ERROR_TOAST);
  });

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

describe('CmktESettings legal hold', () => {
  it('shows reason input and Áp dụng hold without a writer delete control', () => {
    const html = renderToStaticMarkup(
      createElement(CmktESettings, { context: null, holdItemId: 21 }),
    );
    expect(html).toContain('Áp dụng hold');
    expect(html).toMatch(/Lý do hold/i);
    expect(html).toMatch(/<input[^>]*(name|id)="hold-reason"/);
    expect(html).not.toMatch(/>\s*DELETE\s*</i);
    expect(html).not.toMatch(/>\s*Xóa\s*</);
  });

  it('surfaces 400/403 hold errors instead of swallowing them', () => {
    const src = readFileSync(join(__dirname, 'CmktESettings.tsx'), 'utf8');
    expect(src).not.toMatch(/\.catch\(\(\) => undefined\)/);
    expect(holdErrorToast({ status: 400, message: 'hold_reason_required' })).toBe(HOLD_REASON_TOAST);
    expect(holdErrorToast({ status: 403, message: 'missing_cap' })).toBe(HOLD_FORBIDDEN_TOAST);
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

