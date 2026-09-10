import { API_BASE } from '@/lib/api';

export const CMKTE_LAST_LIFECYCLE_KEY = 'cmkte-last-lifecycle';

export function parseLifecycleId(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function resolveRequestLifecycleId(input: {
  explicit?: number | null;
  search?: string | null;
  stored?: string | number | null;
}): number | undefined {
  return parseLifecycleId(input.explicit) ?? parseLifecycleId(input.search) ?? parseLifecycleId(input.stored);
}

export function readLastLifecycleId(): number | undefined {
  try {
    return parseLifecycleId(globalThis.localStorage?.getItem(CMKTE_LAST_LIFECYCLE_KEY));
  } catch {
    return undefined;
  }
}

export function writeLastLifecycleId(id: number): void {
  if (!(id > 0)) return;
  try {
    globalThis.localStorage?.setItem(CMKTE_LAST_LIFECYCLE_KEY, String(id));
  } catch {
    // storage unavailable
  }
}

export function validateRequestForm(f: {
  client: string; source: string; deliverable: string; objective: string; due: string;
}): string | null {
  if (!f.client.trim() || !f.source.trim() || !f.deliverable.trim() || !f.objective.trim() || !f.due.trim()) {
    return 'Thiếu trường bắt buộc — không tạo request.';
  }
  return null;
}

export type ContentRequestCreated = {
  id: number;
  display_code?: string;
  triage_status?: string;
  [key: string]: unknown;
};

export type RequestFormSubmitInput = {
  client: string;
  source: string;
  deliverable: string;
  objective: string;
  due: string;
  priority: string;
  lifecycle_id: number;
  token: string;
};

function splitClientBrand(client: string): { client_label: string; brand_label: string } {
  const raw = client.trim();
  const parts = raw.split(/\s*[·/|]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { client_label: parts[0], brand_label: parts.slice(1).join(' · ') };
  }
  return { client_label: raw, brand_label: raw };
}

export async function submitRequestForm(
  f: RequestFormSubmitInput,
): Promise<{ error: string } | { request: ContentRequestCreated }> {
  const error = validateRequestForm(f);
  if (error) return { error };
  if (!Number.isFinite(f.lifecycle_id) || f.lifecycle_id <= 0 || !f.priority.trim()) {
    return { error: 'Thiếu trường bắt buộc — không tạo request.' };
  }
  const { client_label, brand_label } = splitClientBrand(f.client);
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${f.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lifecycle_id: f.lifecycle_id,
      source: f.source,
      client_label,
      brand_label,
      deliverable_ask: f.deliverable.trim(),
      objective: f.objective.trim(),
      due_at: f.due.trim(),
      priority: f.priority.trim(),
    }),
  });
  if (!res.ok) {
    return { error: 'Không tạo được Content Request.' };
  }
  writeLastLifecycleId(f.lifecycle_id);
  return { request: await res.json() };
}
