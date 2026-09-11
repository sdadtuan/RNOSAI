import { createHttpJsonDamAdapter, assertDamBaseUrl } from './http-json-dam.adapter';
import { listDamOrEmpty } from './dam-adapter';

describe('assertDamBaseUrl', () => {
  it('rejects http and empty env', () => {
    expect(() => assertDamBaseUrl('http://evil')).toThrow('dam_not_configured');
    expect(() => assertDamBaseUrl('')).toThrow('dam_not_configured');
  });
});

describe('createHttpJsonDamAdapter', () => {
  it('lists JSON array and returns empty success', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '100' },
      json: async () => [],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'approved-creative' })).resolves.toEqual({
      items: [],
    });
  });

  it('rejects a row whose url host is not the allowlist host', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '200' },
      json: async () => [{ id: 'x', url: 'https://evil.example/a.jpg' }],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'c' })).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });

  it('rejects an http url even when the host matches the allowlist', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '200' },
      json: async () => [{ id: 'x', url: 'http://dam.example.internal/a.jpg' }],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'c' })).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });

  it('returns allowlisted https rows without an error', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '200' },
      json: async () => [{ id: 'ok', url: 'https://dam.example.internal/a.jpg', filename: 'a.jpg' }],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'approved-creative' })).resolves.toEqual({
      items: [{ id: 'ok', url: 'https://dam.example.internal/a.jpg', filename: 'a.jpg' }],
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://dam.example.internal/approved-creative',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('encodes the collection in the request path', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '2' },
      json: async () => [],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await listDamOrEmpty(adapter, { collection: 'approved creative' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://dam.example.internal/approved%20creative',
      expect.anything(),
    );
  });

  it('times out with AbortSignal.timeout(5000)', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '2' },
      json: async () => [],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await listDamOrEmpty(adapter, { collection: 'c' });
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    timeoutSpy.mockRestore();
  });

  it('does not follow a redirect off the allowlist host', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'location' ? 'https://evil.example/c' : null),
      },
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'c' })).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect on the same allowlist host', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'location' ? 'https://dam.example.internal/other' : null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '2' },
        json: async () => [],
      });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'c' })).resolves.toEqual({ items: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenLastCalledWith(
      'https://dam.example.internal/other',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects a body larger than the cap', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '512001' },
      json: async () => [],
    });
    const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
    await expect(listDamOrEmpty(adapter, { collection: 'c' })).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });
});
