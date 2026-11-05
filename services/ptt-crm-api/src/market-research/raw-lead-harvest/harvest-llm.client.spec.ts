import {
  callHarvestChatCompletion,
  harvestModelSupportsCustomTemperature,
  isHarvestTemperatureUnsupportedError,
} from './harvest-llm.client';

describe('harvest-llm.client', () => {
  it('detects models that reject custom temperature', () => {
    expect(harvestModelSupportsCustomTemperature('gpt-4o')).toBe(true);
    expect(harvestModelSupportsCustomTemperature('gpt-6-astra')).toBe(false);
    expect(harvestModelSupportsCustomTemperature('o3-mini')).toBe(false);
  });

  it('detects temperature unsupported API errors', () => {
    expect(
      isHarvestTemperatureUnsupportedError(
        "Unsupported value: 'temperature' does not support 0.3 with this model. Only the default (1) value is supported.",
      ),
    ).toBe(true);
    expect(isHarvestTemperatureUnsupportedError('rate limited')).toBe(false);
  });

  it('omits temperature for gpt-6-astra', async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      expect(body.temperature).toBeUndefined();
      return {
        ok: true,
        json: async () => ({
          model: 'gpt-6-astra',
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      };
    });
    const prev = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const out = await callHarvestChatCompletion({
        baseUrl: 'https://example.test/v1',
        model: 'gpt-6-astra',
        apiToken: 'tok',
        authType: 'bearer_api_key',
        authHeaderName: 'Authorization',
        user: 'hi',
        temperature: 0.3,
      });
      expect(out.content).toContain('ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = prev;
    }
  });

  it('retries without temperature when API rejects it', async () => {
    let calls = 0;
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      if (calls === 1) {
        expect(body.temperature).toBe(0.3);
        return {
          ok: false,
          json: async () => ({
            error: {
              message:
                "Unsupported value: 'temperature' does not support 0.3 with this model. Only the default (1) value is supported.",
            },
          }),
        };
      }
      expect(body.temperature).toBeUndefined();
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'retry-ok' } }],
        }),
      };
    });
    const prev = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const out = await callHarvestChatCompletion({
        baseUrl: 'https://example.test/v1',
        model: 'gpt-4o',
        apiToken: 'tok',
        authType: 'bearer_api_key',
        authHeaderName: 'Authorization',
        user: 'hi',
        temperature: 0.3,
      });
      expect(out.content).toBe('retry-ok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = prev;
    }
  });
});
