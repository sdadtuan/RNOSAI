import { CpSettingsService } from './cp-settings.service';

type SettingsService = {
  get(): Promise<Record<string, unknown> | null>;
  patch(
    input: Record<string, unknown>,
    updatedByStaffId?: number | null,
  ): Promise<Record<string, unknown> | null>;
};

class SettingsMemory {
  row: Record<string, unknown> = {
    tenant_id: 'PTT',
    locale: 'vi-VN',
    provider_private_config: 'must-not-leak',
    models_json: [{
      id: 'video-v1',
      max_res: '4k',
      api_key: 'model-key',
      access_token: 'model-access-token',
      arbitrary_provider_option: 'must-not-leak',
      credentials: { token: 'nested-token', endpoint: 'safe' },
    }],
    policy_json: {
      moderation: 'review',
      provider: { password: 'hidden', region: 'vn-safe' },
      secret: 'policy-secret',
    },
  };

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('UPDATE crm_cp_settings')) {
      this.row.updated_by_staff_id = params.at(-2);
      if (sql.includes('models_json')) this.row.models_json = params[0];
      if (sql.includes('routing_json')) this.row.routing_json = params[0];
    }
    return { rows: [this.row] };
  }
}

function loadService(db: SettingsMemory): SettingsService {
  return new CpSettingsService(db);
}

describe('CpSettingsService', () => {
  it('omits provider secrets recursively from settings', async () => {
    const settings = await loadService(new SettingsMemory()).get();

    expect(settings).toEqual({
      locale: 'vi-VN',
      models_json: [{
        id: 'video-v1',
        max_res: '4k',
      }],
      policy_json: {
        moderation: 'review',
        provider: { region: 'vn-safe' },
      },
    });
  });

  it('keeps only allowlisted model fields when patching settings', async () => {
    const db = new SettingsMemory();
    const settings = await loadService(db).patch({
      models_json: [{
        id: 'video-v2',
        max_res: '1080p',
        max_duration_sec: 60,
        cap_per_job: 8,
        region: 'ap-southeast-1',
        fallback_id: 'video-v1',
        api_key: 'drop-me',
        arbitrary: 'drop-me-too',
      }],
    }, 42);

    expect(settings?.models_json).toEqual([{
      id: 'video-v2',
      max_res: '1080p',
      max_duration_sec: 60,
      cap_per_job: 8,
      region: 'ap-southeast-1',
      fallback_id: 'video-v1',
    }]);
  });

  it('returns and patches routing_json fallback_id', async () => {
    const db = new SettingsMemory();
    db.row.routing_json = {};
    const settings = loadService(db);

    const patched = await settings.patch({
      routing_json: { fallback_id: 'stub-lite', secret: 'drop' },
    }, 7);

    expect(patched?.routing_json).toEqual({ fallback_id: 'stub-lite' });
    const stored = await settings.get();
    expect(stored?.routing_json).toEqual({ fallback_id: 'stub-lite' });
  });
});
