import { describe, expect, it, vi } from 'vitest';
import { CP_SETTINGS_TABS } from '@/components/crm/cp/CpSettings';
import {
  buildCpSettingsPatch,
  getCpSettings,
  grantCpCredits,
  patchCpSettings,
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
