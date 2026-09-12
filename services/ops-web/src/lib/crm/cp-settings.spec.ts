import { describe, expect, it, vi } from 'vitest';
import { CP_SETTINGS_TABS } from '@/components/crm/cp/CpSettings';
import {
  buildCpSettingsPatch,
  disconnectCpProviderConnection,
  getCpSettings,
  grantCpCredits,
  listCpProviderConnections,
  patchCpSettings,
  projectCpSettingsForUi,
  saveMagnificRestKey,
  startMagnificOAuth,
} from './cp-api';

describe('CP settings UI contract', () => {
  it('exports exactly the eight required URL tabs', () => {
    expect(CP_SETTINGS_TABS).toHaveLength(8);
    expect(CP_SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      'profile',
      'members',
      'sso',
      'credit',
      'models',
      'integrations',
      'security',
      'policy',
    ]);
  });

  it('allowlists model fields before PATCH', () => {
    expect(buildCpSettingsPatch({
      routing_json: { fallback_id: 'stub-lite', secret: 'drop' },
    })).toEqual({
      routing_json: { fallback_id: 'stub-lite' },
    });
    expect(buildCpSettingsPatch({
      models_json: [{
        id: 'stub-pro',
        max_res: '1080',
        max_duration_sec: 60,
        cap_per_job: 200,
        region: 'VN',
        fallback_id: 'stub-lite',
        api_key: 'must-not-leave-browser',
      }],
    })).toEqual({
      models_json: [{
        id: 'stub-pro',
        max_res: '1080',
        max_duration_sec: 60,
        cap_per_job: 200,
        region: 'VN',
        fallback_id: 'stub-lite',
      }],
    });
  });

  it('projects API settings before they can reach the UI', () => {
    expect(projectCpSettingsForUi({
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
      default_brand_kit_id: null,
      retention_days: 365,
      signed_url_ttl_min: 15,
      restore_days: 30,
      legal_hold: false,
      soft_alert_pct: 80,
      hard_cap_pct: 100,
      high_cost_threshold: 200,
      concurrent_slots: 5,
      watermark_draft: true,
      ai_enabled: false,
      publish_native: false,
      models_json: [{ id: 'safe', api_key: 'hidden', token: 'hidden' }],
      policy_json: {
        outcome: 'review',
        credentials: { value: 'hidden' },
        nested: { password: 'hidden', allowed: true },
      },
    })).toEqual(expect.objectContaining({
      models_json: [{ id: 'safe' }],
      policy_json: {
        outcome: 'review',
        nested: { allowed: true },
      },
    }));
  });

  it('binds GET, PATCH, and credit grant to CP API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    await getCpSettings('token');
    await patchCpSettings('token', { locale: 'vi-VN' });
    await grantCpCredits('token', {
      agency_client_id: '11111111-1111-4111-8111-111111111111',
      amount: 10,
    }, 'grant-uuid');

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/crm\/cp\/settings$/);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ locale: 'vi-VN' }),
    }));
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(/\/api\/crm\/cp\/credits\/grant$/);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'grant-uuid' }),
    }));

    fetchMock.mockRestore();
  });

  it('binds Magnific connection routes without echoing the API key on GET', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({
        items: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          provider: 'magnific_rest',
          status: 'on',
          account_label: 'PTT',
          expires_at: null,
          has_secret: true,
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const listed = await listCpProviderConnections('token');
    await startMagnificOAuth('token');
    await saveMagnificRestKey('token', 'sk-must-not-return');
    await disconnectCpProviderConnection('token', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/crm\/cp\/provider-connections$/);
    expect(JSON.stringify(listed)).not.toMatch(/token|api_key/i);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/provider-connections\/magnific\/oauth\/start$/);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(/\/provider-connections\/magnific\/rest-key$/);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ api_key: 'sk-must-not-return' }),
    }));
    expect(fetchMock.mock.calls[3]?.[0]).toMatch(/\/provider-connections\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/disconnect$/);

    fetchMock.mockRestore();
  });
});
