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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 90000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature ?? 0.2,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.user },
        ],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    if (!res.ok) {
      throw new Error(body.error?.message || `harvest_llm_http_${res.status}`);
    }
    const content = String(body.choices?.[0]?.message?.content ?? '').trim();
    if (!content) throw new Error('harvest_llm_empty');
    return { content, model: String(body.model ?? input.model) };
  } finally {
    clearTimeout(timer);
  }
}
