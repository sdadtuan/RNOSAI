import {
  CpMagnificRestAdapter,
  magnificRestRoutes,
} from './cp-magnific-rest.adapter';

const API_KEY = 'sk_live_secret_do_not_log';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  } as unknown as Response;
}

function bytesResponse(bytes: Buffer, mime: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? mime : null) },
    json: async () => ({}),
    text: async () => bytes.toString('utf8'),
    arrayBuffer: async () => bytes,
  } as unknown as Response;
}

describe('magnificRestRoutes', () => {
  it('maps REST paths from env instead of a hardcoded vendor host', () => {
    const routes = magnificRestRoutes({
      MAGNIFIC_REST_BASE: 'https://rest.example.test',
      MAGNIFIC_REST_BALANCE_PATH: '/usage/credits',
      MAGNIFIC_REST_GENERATE_PATH: '/jobs',
      MAGNIFIC_REST_STATUS_PATH: '/jobs/{id}',
    });
    expect(routes.base).toBe('https://rest.example.test');
    expect(routes.balance).toBe('https://rest.example.test/usage/credits');
    expect(routes.generate).toBe('https://rest.example.test/jobs');
    expect(routes.status('abc')).toBe('https://rest.example.test/jobs/abc');
    expect(JSON.stringify(routes)).not.toMatch(/magnific\.com/);
  });
});

describe('CpMagnificRestAdapter', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = {
      ...envBackup,
      MAGNIFIC_REST_BASE: 'https://rest.example.test',
      MAGNIFIC_REST_BALANCE_PATH: '/usage/credits',
      MAGNIFIC_REST_GENERATE_PATH: '/jobs',
      MAGNIFIC_REST_STATUS_PATH: '/jobs/{id}',
    };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('sends the API key only on the server request to the mapped generate path', async () => {
    const fetchImpl = jest.fn(async (url: string | URL) => {
      if (String(url).endsWith('/jobs')) {
        return jsonResponse(200, { id: 'rest-9' });
      }
      return jsonResponse(200, { credits: 4 });
    });
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
    });

    const generated = await adapter.generate({
      transport: 'rest',
      capability: 'images_generate',
      inputs: { prompt: 'hero' },
    });

    expect(generated.externalRunId).toBe('rest-9');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://rest.example.test/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${API_KEY}`,
        }),
      }),
    );
  });

  it('maps a provider 401 to 409 magnific_disconnected (GT-M01)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(401, { error: 'nope' }));
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
    });

    await expect(adapter.getBalance()).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
  });

  it('throws magnific_disconnected without calling Magnific when the key is missing', async () => {
    const fetchImpl = jest.fn();
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => '',
      fetchImpl,
    });

    await expect(adapter.getBalance()).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('copies download bytes into a buffer', async () => {
    const bytes = Buffer.from('png-bytes');
    const fetchImpl = jest.fn(async () => bytesResponse(bytes, 'image/png'));
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
    });

    const downloaded = await adapter.download('https://cdn.example/file.png');
    expect(downloaded.bytes.equals(bytes)).toBe(true);
    expect(downloaded.mime).toBe('image/png');
  });

  it('redacts the API key from logs', async () => {
    const logs: string[] = [];
    const fetchImpl = jest.fn(async () => jsonResponse(502, { error: 'down' }));
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
      log: (message) => logs.push(message),
    });

    await expect(adapter.getBalance()).rejects.toBeTruthy();
    expect(logs.join('\n')).not.toContain(API_KEY);
  });

  it('returns null credits when the balance payload has no number', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { status: 'ok' }));
    const adapter = new CpMagnificRestAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
    });
    await expect(adapter.getBalance()).resolves.toEqual({ credits: null });
  });
});
