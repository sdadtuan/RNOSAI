import { stubPublishConnector } from './publish-connector';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object = {}, config?: object) {
  return new ContentOsPortfolioService(
    repo as never,
    {} as never,
    marketingRepo as never,
    {} as never,
    config as never,
  );
}

const localStaffAuth = { staffAuthMode: 'nest', staffKeycloakIssuer: null };
const enforcedStaffIdp = {
  staffAuthMode: 'keycloak',
  staffKeycloakIssuer: 'http://127.0.0.1:8080/realms/ptt-staff',
};

describe('ContentOsPortfolioService settings', () => {
  it('GET settings returns direct_social_publish false when the row is missing', async () => {
    const repo = { getSetting: jest.fn().mockResolvedValue(null) };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
    expect(repo.getSetting).toHaveBeenCalledWith('direct_social_publish');
    expect(repo.getSetting).not.toHaveBeenCalledWith('sso_enforced');
  });

  it('PATCH settings persists the stored boolean and GET reads it back', async () => {
    const stored = { key: 'direct_social_publish', value_json: true };
    const repo = {
      getSetting: jest.fn().mockResolvedValue(stored),
      upsertSetting: jest.fn().mockResolvedValue(stored),
    };
    const svc = makeSvc(repo);
    const patched = await svc.patchSettings({
      staffId: 7,
      actor: 'admin@ptt.vn',
      body: { direct_social_publish: true },
    });
    expect(repo.upsertSetting).toHaveBeenCalledWith('direct_social_publish', true, 'admin@ptt.vn');
    expect(patched).toEqual({ direct_social_publish: true, sso_enforced: false });
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({
      direct_social_publish: true,
      sso_enforced: false,
    });
  });

  it('GET settings defaults false when cmkt_settings is missing (42P01)', async () => {
    const repo = {
      getSetting: jest.fn().mockRejectedValue(
        Object.assign(new Error('relation "cmkt_settings" does not exist'), { code: '42P01' }),
      ),
    };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
  });

  it('GET settings defaults false when a cmkt_settings column is missing (42703)', async () => {
    const repo = {
      getSetting: jest.fn().mockRejectedValue(
        Object.assign(new Error('column "value_json" of relation "cmkt_settings" does not exist'), {
          code: '42703',
          table: 'cmkt_settings',
        }),
      ),
    };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
  });

  it('GET settings throws when postgres is not ready instead of returning a false disabled policy', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(false),
      getSetting: jest.fn().mockResolvedValue(null),
    };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).rejects.toMatchObject({ status: 503 });
    expect(repo.getSetting).not.toHaveBeenCalled();
  });

  it('GET settings surfaces a real database error instead of a false disabled policy', async () => {
    const repo = {
      getSetting: jest.fn().mockRejectedValue(
        Object.assign(new Error('connection terminated unexpectedly'), { code: '57P01' }),
      ),
    };
    const svc = makeSvc(repo);
    await expect(svc.getSettings({ staffId: 7 })).rejects.toMatchObject({
      message: 'connection terminated unexpectedly',
    });
  });

  it('PATCH settings rejects a missing or non-boolean direct_social_publish with 400', async () => {
    const repo = { upsertSetting: jest.fn() };
    const svc = makeSvc(repo);
    await expect(
      svc.patchSettings({ staffId: 7, actor: 'admin@ptt.vn', body: {} }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc.patchSettings({
        staffId: 7,
        actor: 'admin@ptt.vn',
        body: { direct_social_publish: 'true' },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.upsertSetting).not.toHaveBeenCalled();
  });

  it('PATCH settings persists an explicit false boolean', async () => {
    const repo = {
      upsertSetting: jest.fn().mockResolvedValue({ key: 'direct_social_publish', value_json: false }),
    };
    const svc = makeSvc(repo);
    await expect(
      svc.patchSettings({
        staffId: 7,
        actor: 'admin@ptt.vn',
        body: { direct_social_publish: false },
      }),
    ).resolves.toEqual({ direct_social_publish: false, sso_enforced: false });
    expect(repo.upsertSetting).toHaveBeenCalledWith('direct_social_publish', false, 'admin@ptt.vn');
  });

  it('GET settings exposes sso_enforced read-only false when no IdP is configured', async () => {
    const repo = { getSetting: jest.fn().mockResolvedValue(null) };
    const svc = makeSvc(repo, {}, localStaffAuth);
    await expect(svc.getSettings({ staffId: 7 })).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
    expect(repo.getSetting).not.toHaveBeenCalledWith('sso_enforced');
  });

  it('GET settings exposes sso_enforced true when staff IdP is enforced', async () => {
    const repo = { getSetting: jest.fn().mockResolvedValue(null) };
    const svc = makeSvc(repo, {}, enforcedStaffIdp);
    const settings = await svc.getSettings({ staffId: 7 });
    expect(settings).toEqual({
      direct_social_publish: false,
      sso_enforced: true,
    });
    expect(repo.getSetting).not.toHaveBeenCalledWith('sso_enforced');
    expect(JSON.stringify(settings)).not.toMatch(/issuer|secret|client_secret|private.?key/i);
  });

  it('PATCH settings ignores sso_enforced and never persists it', async () => {
    const repo = {
      upsertSetting: jest.fn().mockResolvedValue({ key: 'direct_social_publish', value_json: false }),
    };
    const svc = makeSvc(repo, {}, localStaffAuth);
    await expect(
      svc.patchSettings({
        staffId: 7,
        actor: 'admin@ptt.vn',
        body: { direct_social_publish: false, sso_enforced: true },
      }),
    ).resolves.toEqual({ direct_social_publish: false, sso_enforced: false });
    expect(repo.upsertSetting).toHaveBeenCalledTimes(1);
    expect(repo.upsertSetting).toHaveBeenCalledWith('direct_social_publish', false, 'admin@ptt.vn');
    expect(repo.upsertSetting).not.toHaveBeenCalledWith('sso_enforced', expect.anything(), expect.anything());
  });

  it('PATCH settings still derives sso_enforced from staff IdP and does not persist it', async () => {
    const repo = {
      upsertSetting: jest.fn().mockResolvedValue({ key: 'direct_social_publish', value_json: false }),
    };
    const svc = makeSvc(repo, {}, enforcedStaffIdp);
    await expect(
      svc.patchSettings({
        staffId: 7,
        actor: 'admin@ptt.vn',
        body: { direct_social_publish: false, sso_enforced: false },
      }),
    ).resolves.toEqual({ direct_social_publish: false, sso_enforced: true });
    expect(repo.upsertSetting).toHaveBeenCalledTimes(1);
    expect(repo.upsertSetting).toHaveBeenCalledWith('direct_social_publish', false, 'admin@ptt.vn');
    expect(repo.upsertSetting).not.toHaveBeenCalledWith('sso_enforced', expect.anything(), expect.anything());
  });

  it('does not publish through the stub when the admin flag is on', async () => {
    const repo = {
      getSetting: jest.fn().mockResolvedValue({ key: 'direct_social_publish', value_json: true }),
    };
    const svc = makeSvc(repo);
    const settings = await svc.getSettings({ staffId: 7 });
    const connector = stubPublishConnector(settings);
    await expect(connector.publish({ item_id: 21, channel: 'facebook' })).rejects.toMatchObject({
      name: 'NotEnabledError',
    });
  });
});
