import {
  CpMagnificFlowsAdapter,
  magnificFlowRoutes,
} from './cp-magnific-flows.adapter';

const API_KEY = 'sk_live_secret_do_not_log';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  } as unknown as Response;
}

describe('magnificFlowRoutes', () => {
  it('maps flow paths from env', () => {
    const routes = magnificFlowRoutes({
      MAGNIFIC_FLOWS_BASE: 'https://flows.example.test',
    });
    expect(routes.list).toBe('https://flows.example.test/v1/ai/flows');
    expect(routes.get('abc')).toBe('https://flows.example.test/v1/ai/flows/abc');
    expect(routes.run('abc')).toBe('https://flows.example.test/v1/ai/flows/abc/run');
    expect(routes.runStatus('run-1')).toBe('https://flows.example.test/v1/ai/flows/runs/run-1');
  });
});

describe('CpMagnificFlowsAdapter', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = {
      ...envBackup,
      MAGNIFIC_FLOWS_BASE: 'https://flows.example.test',
    };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('lists flows from data[]', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      data: [{ sqid: 'sq1', name: 'Social 9:16', total_cost: 5 }],
    }));
    const adapter = new CpMagnificFlowsAdapter({ getApiKey: async () => API_KEY, fetchImpl });

    const items = await adapter.listFlows();
    expect(items).toEqual([{ sqid: 'sq1', name: 'Social 9:16', total_cost: 5 }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://flows.example.test/v1/ai/flows',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Magnific-Api-Key': API_KEY }),
      }),
    );
  });

  it('runs a flow and returns workflow_run_identifier', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(202, {
      workflow_run_identifier: 'run-flow-9',
    }));
    const adapter = new CpMagnificFlowsAdapter({ getApiKey: async () => API_KEY, fetchImpl });

    const out = await adapter.runFlow('sq1', { image_prompt: 'hero' });
    expect(out.workflowRunIdentifier).toBe('run-flow-9');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://flows.example.test/v1/ai/flows/sq1/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('extracts first video URL from completed run', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      status: 'completed',
      result: { videos: ['https://cdn.example/out.mp4'] },
    }));
    const adapter = new CpMagnificFlowsAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
      waitTimeoutMs: 200,
      pollIntervalMs: 5,
    });

    const out = await adapter.waitForRun('run-flow-9');
    expect(out.outputUrls).toEqual(['https://cdn.example/out.mp4']);
  });

  it('maps provider 401 to magnific_disconnected', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(401, { error: 'nope' }));
    const adapter = new CpMagnificFlowsAdapter({ getApiKey: async () => API_KEY, fetchImpl });

    await expect(adapter.listFlows()).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
  });

  it('maps non-ok upstream to magnific_upstream_failed', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(502, { error: 'down' }));
    const adapter = new CpMagnificFlowsAdapter({ getApiKey: async () => API_KEY, fetchImpl });

    await expect(adapter.getFlow('sq1')).rejects.toMatchObject({
      error: 'magnific_upstream_failed',
    });
  });

  it('redacts the API key from logs', async () => {
    const logs: string[] = [];
    const fetchImpl = jest.fn(async () => jsonResponse(502, { error: 'down' }));
    const adapter = new CpMagnificFlowsAdapter({
      getApiKey: async () => API_KEY,
      fetchImpl,
      log: (message) => logs.push(message),
    });

    await expect(adapter.listFlows()).rejects.toBeTruthy();
    expect(logs.join('\n')).not.toContain(API_KEY);
  });
});
