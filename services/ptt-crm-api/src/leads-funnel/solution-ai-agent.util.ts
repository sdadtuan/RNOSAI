import { createHmac, timingSafeEqual } from 'crypto';

export const SOLUTION_AI_SIGNATURE_HEADER = 'x-ptt-signature';

export type SolutionAgentConfig = {
  webhookUrl: string;
  secret: string;
  configured: boolean;
  publicUrl: string;
};

export function readSolutionAgentConfig(): SolutionAgentConfig {
  const webhookUrl = String(process.env.PTT_SOLUTION_AGENT_WEBHOOK_URL ?? '').trim();
  const secret = String(process.env.PTT_SOLUTION_AGENT_SECRET ?? '').trim();
  const port = String(process.env.CRM_API_PORT ?? process.env.PORT ?? '3000').trim() || '3000';
  const publicUrl = String(
    process.env.PTT_CRM_API_PUBLIC_URL ?? process.env.PTT_API_PUBLIC_URL ?? `http://127.0.0.1:${port}`,
  )
    .trim()
    .replace(/\/$/, '');
  return { webhookUrl, secret, configured: Boolean(webhookUrl && secret), publicUrl };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(rec)
        .sort()
        .map((key) => [key, sortKeys(rec[key])]),
    );
  }
  return value;
}

export function signSolutionAiPayload(secret: string, body: unknown): string {
  const hex = createHmac('sha256', secret).update(canonicalJson(body)).digest('hex');
  return `sha256=${hex}`;
}

export function verifySolutionAiSignature(
  secret: string,
  body: unknown,
  header: string | null | undefined,
): boolean {
  const expected = signSolutionAiPayload(secret, body);
  const got = String(header ?? '').trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function postSolutionAiWebhook(
  webhookUrl: string,
  body: unknown,
  signature: string,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; status: number }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PTT-Signature': signature,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
