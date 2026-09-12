import { bindComfyWorkflow } from './cp-comfy-bind.util';
import { CpComfyAdapter } from './cp-comfy.adapter';

const GATEWAY = 'http://comfy-gateway.internal';
const PUBLIC_8188 = 'http://127.0.0.1:8188';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

const PACKSHOT_WORKFLOW = {
  '20': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'default packshot prompt', clip: ['19', 0] },
  },
  '19': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'model.safetensors' },
  },
} as const;

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

function enabledEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    COMFYUI_WORKER_ENABLED: '1',
    COMFYUI_GATEWAY_URL: GATEWAY,
    ...overrides,
  };
}

describe('CpComfyAdapter', () => {
  it('does not fetch the gateway when the worker flag is off', async () => {
    const fetchImpl = jest.fn();
    const adapter = new CpComfyAdapter({
      fetchImpl,
      env: {
        COMFYUI_WORKER_ENABLED: '0',
        COMFYUI_GATEWAY_URL: PUBLIC_8188,
      },
    });

    await expect(adapter.systemStats()).resolves.toEqual({ ok: false, vram_mb: null });
    await expect(adapter.prompt(JOB_ID, {})).rejects.toMatchObject({
      status: 409,
      error: 'WORKER_UNAVAILABLE',
      gate: 'GT-C01',
    });
    const health = await adapter.providerHealth();
    expect(health).toEqual({
      comfy: { ok: false, reason: 'gpu_building' },
    });
    expect(JSON.stringify(health)).not.toMatch(/8188|COMFYUI_GATEWAY|127\.0\.0\.1|comfy-gateway/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('binds packshot values then POSTs /prompt with client_id ptt-{jobId} on the gateway', async () => {
    const bound = bindComfyWorkflow({
      workflow: structuredClone(PACKSHOT_WORKFLOW) as Record<
        string,
        { class_type: string; inputs: Record<string, unknown> }
      >,
      bindings: { positivePrompt: { nodeId: '20', inputKey: 'text' } },
      values: { positivePrompt: 'luxury watch on marble' },
    });

    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      expect(href.startsWith(GATEWAY)).toBe(true);
      expect(href).not.toContain(':8188');
      if (href.endsWith('/system_stats')) {
        return jsonResponse(200, { devices: [{ vram_total: 25769803776 }] });
      }
      if (href.endsWith('/prompt')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body.client_id).toBe(`ptt-${JOB_ID}`);
        const prompt = body.prompt as Record<string, { inputs: Record<string, unknown> }>;
        expect(prompt['20'].inputs.text).toBe('luxury watch on marble');
        return jsonResponse(200, { prompt_id: 'prm-packshot' });
      }
      throw new Error(`unexpected ${href}`);
    });

    const adapter = new CpComfyAdapter({ fetchImpl, env: enabledEnv() });
    const queued = await adapter.prompt(JOB_ID, bound);

    expect(queued).toEqual({ promptId: 'prm-packshot' });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${GATEWAY}/prompt`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns WORKER_UNAVAILABLE without POSTing /prompt when heartbeat fails', async () => {
    const fetchImpl = jest.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith('/system_stats')) {
        throw new Error('econnrefused');
      }
      throw new Error(`unexpected ${href}`);
    });
    const adapter = new CpComfyAdapter({ fetchImpl, env: enabledEnv() });

    await expect(adapter.prompt(JOB_ID, {})).rejects.toMatchObject({
      status: 409,
      error: 'WORKER_UNAVAILABLE',
      gate: 'GT-C01',
    });
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/prompt'))).toBe(false);
  });

  it('omits gateway host and :8188 from provider health JSON', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      devices: [{ vram_total: 25769803776, vram_free: 12884901888 }],
    }));
    const now = () => Date.parse('2026-09-13T03:00:00.000Z');
    const adapter = new CpComfyAdapter({ fetchImpl, env: enabledEnv(), now });

    const health = await adapter.providerHealth();
    const json = JSON.stringify(health);

    expect(health).toEqual({
      comfy: {
        ok: true,
        vram_mb: 24576,
        checked_at: '2026-09-13T03:00:00.000Z',
      },
    });
    expect(json).not.toMatch(/8188|COMFYUI_GATEWAY|comfy-gateway|127\.0\.0\.1|localhost/i);
  });

  it('marks health gpu_building when system_stats fails', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(503, { error: 'down' }));
    const adapter = new CpComfyAdapter({
      fetchImpl,
      env: enabledEnv(),
      now: () => Date.parse('2026-09-13T03:00:00.000Z'),
    });

    const health = await adapter.providerHealth();
    expect(health.comfy).toMatchObject({ ok: false, reason: 'gpu_building' });
    expect(JSON.stringify(health)).not.toMatch(/8188|comfy-gateway/i);
  });

  it('downloads history output bytes for ingest checksum', async () => {
    const png = Buffer.from('comfy-png-bytes');
    const fetchImpl = jest.fn(async (url: string | URL) => {
      const href = String(url);
      expect(href.startsWith(GATEWAY)).toBe(true);
      if (href.includes('/history/prm-1')) {
        return jsonResponse(200, {
          'prm-1': {
            outputs: {
              '9': {
                images: [{ filename: 'ComfyUI_00001_.png', subfolder: '', type: 'output' }],
              },
            },
            status: { completed: true, status_str: 'success' },
          },
        });
      }
      if (href.includes('/view') && href.includes('ComfyUI_00001_.png')) {
        return bytesResponse(png, 'image/png');
      }
      throw new Error(`unexpected ${href}`);
    });

    const adapter = new CpComfyAdapter({ fetchImpl, env: enabledEnv() });
    const hist = await adapter.history('prm-1');
    expect(hist.outputFiles[0]).toContain('ComfyUI_00001_.png');
    const downloaded = await adapter.download(hist.outputFiles[0]);
    expect(downloaded.bytes.equals(png)).toBe(true);
    expect(downloaded.mime).toBe('image/png');
  });

  it('throws OUT_OF_MEMORY when history reports CUDA OOM', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      'prm-oom': {
        outputs: {},
        status: {
          completed: true,
          status_str: 'error',
          messages: [['execution_error', { exception_message: 'CUDA out of memory' }]],
        },
      },
    }));
    const adapter = new CpComfyAdapter({ fetchImpl, env: enabledEnv() });

    await expect(adapter.history('prm-oom')).rejects.toMatchObject({
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
  });
});
