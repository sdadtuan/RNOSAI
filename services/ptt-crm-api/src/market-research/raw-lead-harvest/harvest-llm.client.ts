import type { ResearchAiAuthType } from './ai-providers.types';

export type HarvestLlmCallInput = {
  baseUrl: string;
  model: string;
  apiToken: string;
  authType: ResearchAiAuthType;
  authHeaderName: string;
  system?: string;
  user: string;
  timeoutMs?: number;
  temperature?: number;
};

export type HarvestLlmCallResult = {
  content: string;
  model: string;
};

/** Newer OpenAI-compatible models (o1/o3/gpt-5+/astra) often reject custom temperature. */
export function harvestModelSupportsCustomTemperature(model: string): boolean {
  const m = String(model || '')
    .trim()
    .toLowerCase();
  if (!m) return true;
  if (/^o[0-9]/.test(m) || m.includes('o1') || m.includes('o3') || m.includes('o4')) return false;
  if (m.includes('gpt-5') || m.includes('gpt-6') || m.includes('astra')) return false;
  if (m.includes('reasoning')) return false;
  return true;
}

export function isHarvestTemperatureUnsupportedError(message: string): boolean {
  const msg = String(message || '').toLowerCase();
  return msg.includes('temperature') && (msg.includes('unsupported') || msg.includes('does not support'));
}

export async function callHarvestChatCompletion(
  input: HarvestLlmCallInput,
): Promise<HarvestLlmCallResult> {
  const url = `${input.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (input.authType === 'bearer_api_key') {
    headers[input.authHeaderName || 'Authorization'] = `Bearer ${input.apiToken}`;
  } else {
    headers[input.authHeaderName || 'x-api-key'] = input.apiToken;
  }

  const messages = [
    ...(input.system ? [{ role: 'system', content: input.system }] : []),
    { role: 'user', content: input.user },
  ];

  const post = async (includeTemperature: boolean): Promise<HarvestLlmCallResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 90000);
    try {
      const body: Record<string, unknown> = {
        model: input.model,
        messages,
      };
      if (includeTemperature) {
        body.temperature = input.temperature ?? 0.2;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      if (!res.ok) {
        throw new Error(parsed.error?.message || `harvest_llm_http_${res.status}`);
      }
      const content = String(parsed.choices?.[0]?.message?.content ?? '').trim();
      if (!content) throw new Error('harvest_llm_empty');
      return { content, model: String(parsed.model ?? input.model) };
    } finally {
      clearTimeout(timer);
    }
  };

  const tryWithTemp = harvestModelSupportsCustomTemperature(input.model);
  try {
    return await post(tryWithTemp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (tryWithTemp && isHarvestTemperatureUnsupportedError(message)) {
      return await post(false);
    }
    throw err;
  }
}
