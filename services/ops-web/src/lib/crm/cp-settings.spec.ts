import { describe, expect, it, vi } from 'vitest';
import { CP_SETTINGS_TABS } from '@/components/crm/cp/CpSettings';
import {
  buildCpSettingsPatch,
  getCpSettings,
  grantCpCredits,
  patchCpSettings,
  projectCpSettingsForUi,
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
});
