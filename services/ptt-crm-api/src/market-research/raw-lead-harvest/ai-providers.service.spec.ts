import { ResearchAiProvidersService } from './ai-providers.service';
import { researchAiTokenHint } from './token-hint.util';

describe('ResearchAiProvidersService credential privacy', () => {
  it('token hint never equals full secret', () => {
    const secret = 'sk-live-super-secret-token';
    const hint = researchAiTokenHint(secret);
    expect(hint).not.toContain('super-secret');
    expect(hint.endsWith('oken')).toBe(true);
  });

  it('createCredential path returns public shape without cipher (contract via mock repo)', async () => {
    const repo = {
      createCredential: jest.fn().mockResolvedValue({
        id: 1,
        provider_id: 9,
        label: 'Prod',
        token_hint: '…oken',
        is_primary: true,
        enabled: true,
        created_at: '2026-09-14T00:00:00.000Z',
        updated_at: '2026-09-14T00:00:00.000Z',
      }),
    };
    const svc = new ResearchAiProvidersService(repo as never);
    const out = await svc.createCredential(
      9,
      { label: 'Prod', api_token: 'sk-live-super-secret-token' },
      42,
    );
    expect(out).not.toHaveProperty('secret_cipher');
    expect(out).not.toHaveProperty('api_token');
    expect(out.token_hint).toBe('…oken');
    expect(repo.createCredential).toHaveBeenCalledWith(
      9,
      { label: 'Prod', api_token: 'sk-live-super-secret-token' },
      42,
    );
  });

  it('testProvider fails when not configured', async () => {
    const repo = {
      getProvider: jest.fn().mockResolvedValue({ id: 1, code: 'openai', enabled: true }),
      resolveRuntimeCredential: jest.fn().mockResolvedValue(null),
      listModels: jest.fn(),
    };
    const svc = new ResearchAiProvidersService(repo as never);
    const out = await svc.testProvider(1);
    expect(out).toEqual({ ok: false, error: 'provider_not_configured' });
  });

  it('deleteProvider / deleteModel / deleteCredential delegate (409 surfaced by repo)', async () => {
    const repo = {
      deleteProvider: jest.fn().mockRejectedValue({ status: 409, response: { error: 'provider_in_use_disable_instead' } }),
      deleteModel: jest.fn().mockResolvedValue({ ok: true, id: 2 }),
      deleteCredential: jest.fn().mockResolvedValue({ ok: true, id: 3 }),
    };
    const svc = new ResearchAiProvidersService(repo as never);
    await expect(svc.deleteProvider(1)).rejects.toMatchObject({ status: 409 });
    await expect(svc.deleteModel(2)).resolves.toEqual({ ok: true, id: 2 });
    await expect(svc.deleteCredential(3, 9)).resolves.toEqual({ ok: true, id: 3 });
    expect(repo.deleteCredential).toHaveBeenCalledWith(3, 9);
  });
});
