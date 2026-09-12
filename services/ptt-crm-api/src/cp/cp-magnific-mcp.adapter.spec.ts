import {
  MAGNIFIC_MCP_BASE,
  MAGNIFIC_SUBMIT_TIMEOUT_MS,
  MAGNIFIC_TOOLS_CACHE_MS,
  MAGNIFIC_VIDEO_WAIT_DEFAULT_MS,
  CpMagnificMcpAdapter,
} from './cp-magnific-mcp.adapter';

const TOKEN = 'tok_live_secret_do_not_log';

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

function bytesResponse(bytes: Buffer, mime: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? mime : null) },
    json: async () => ({}),
    text: async () => bytes.toString('utf8'),
    arrayBuffer: async () => bytes,
  } as unknown as Response;
}

function mcpFetch(handler: (body: Record<string, unknown>, url: string, init?: RequestInit) => Response | Promise<Response>) {
  return jest.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    if ((init?.method ?? 'GET') === 'GET' || href.includes('/download/')) {
      return handler({}, href, init);
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return handler(body, href, init);
  });
}

describe('CpMagnificMcpAdapter', () => {
  it('exports MCP base, 15-minute tools cache, 60s submit, and 600s video wait', () => {
    expect(MAGNIFIC_MCP_BASE).toBe('https://mcp.magnific.com');
    expect(MAGNIFIC_TOOLS_CACHE_MS).toBe(15 * 60 * 1000);
    expect(MAGNIFIC_SUBMIT_TIMEOUT_MS).toBe(60_000);
    expect(MAGNIFIC_VIDEO_WAIT_DEFAULT_MS).toBe(600_000);
  });

  it('maps images_generate onto the discovered MCP tool name', async () => {
    const fetchImpl = mcpFetch((body, url) => {
      if (body.method === 'tools/list') {
        return jsonResponse(200, {
          result: { tools: [{ name: 'account_balance' }, { name: 'images.generate' }] },
        });
      }
      if (body.method === 'tools/call') {
        const params = body.params as Record<string, unknown>;
        expect(params.name).toBe('images.generate');
        return jsonResponse(200, { result: { id: 'run-42' } });
      }
      throw new Error(`unexpected ${url}`);
    });

    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
    });
    const generated = await adapter.generate({
      transport: 'mcp',
      capability: 'images_generate',
      inputs: { prompt: 'packshot' },
    });

    expect(generated.externalRunId).toBe('run-42');
    expect(fetchImpl).toHaveBeenCalledWith(
      MAGNIFIC_MCP_BASE,
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('maps a provider 401 to 409 magnific_disconnected (GT-M01)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(401, { error: 'unauthorized' }));
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
    });

    await expect(adapter.getBalance()).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
    await expect(
      adapter.generate({ transport: 'mcp', capability: 'images_generate', inputs: {} }),
    ).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
    });
  });

  it('throws magnific_disconnected without calling Magnific when OAuth is missing', async () => {
    const fetchImpl = jest.fn();
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => '',
      fetchImpl,
    });

    await expect(adapter.getBalance()).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('copies download bytes into a buffer and keeps the provider mime', async () => {
    const bytes = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
    const fetchImpl = jest.fn(async () => bytesResponse(bytes, 'image/png'));
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
    });

    const downloaded = await adapter.download('https://mcp.magnific.com/out.png');
    expect(downloaded.bytes.equals(bytes)).toBe(true);
    expect(downloaded.mime).toBe('image/png');
  });

  it('refuses download from cdn.example and still downloads same-origin MCP', async () => {
    const fetchImpl = jest.fn(async () => bytesResponse(Buffer.from('png'), 'image/png'));
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
    });

    await expect(adapter.download('https://cdn.example/out.png')).rejects.toMatchObject({
      error: 'magnific_download_host_blocked',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    await adapter.download('https://mcp.magnific.com/files/out.png');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('caches tools/list for 15 minutes', async () => {
    let now = 1_000;
    const fetchImpl = mcpFetch((body) => {
      if (body.method === 'tools/list') {
        return jsonResponse(200, { result: { tools: [{ name: 'account_balance' }] } });
      }
      return jsonResponse(200, { result: { credits: 12 } });
    });
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
      now: () => now,
    });

    await adapter.getBalance();
    now += MAGNIFIC_TOOLS_CACHE_MS - 1;
    await adapter.getBalance();
    const listCalls = fetchImpl.mock.calls.filter(([, init]) => {
      const raw = String((init as RequestInit | undefined)?.body ?? '');
      return raw.includes('tools/list');
    });
    expect(listCalls).toHaveLength(1);

    now += 2;
    await adapter.getBalance();
    const listCallsAfter = fetchImpl.mock.calls.filter(([, init]) => {
      const raw = String((init as RequestInit | undefined)?.body ?? '');
      return raw.includes('tools/list');
    });
    expect(listCallsAfter).toHaveLength(2);
  });

  it('redacts the OAuth token from logs and thrown errors', async () => {
    const logs: string[] = [];
    const fetchImpl = jest.fn(async () => jsonResponse(500, { error: 'upstream' }));
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
      log: (message) => logs.push(message),
    });

    await expect(adapter.getBalance()).rejects.toBeTruthy();
    const dumped = `${logs.join('\n')} ${JSON.stringify(logs)}`;
    expect(dumped).not.toContain(TOKEN);
    expect(dumped.toLowerCase()).not.toContain('authorization');
  });

  it('returns null credits when the balance tool has no number', async () => {
    const fetchImpl = mcpFetch((body) => {
      if (body.method === 'tools/list') {
        return jsonResponse(200, { result: { tools: [{ name: 'account_balance' }] } });
      }
      return jsonResponse(200, { result: { message: 'unavailable' } });
    });
    const adapter = new CpMagnificMcpAdapter({
      getToken: async () => TOKEN,
      fetchImpl,
    });

    await expect(adapter.getBalance()).resolves.toEqual({ credits: null });
  });
});
