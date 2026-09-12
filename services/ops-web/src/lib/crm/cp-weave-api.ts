import { cpFetch } from './cp-api';

export type CpWeaveBrief = {
  creative_brief?: string;
  prompt?: string;
  negative_prompt?: string;
  shot_list?: string[];
  output_format?: { kind?: string; width?: number; height?: number; notes?: string };
};

export type CpWeaveWorkOrder = {
  id: string;
  project_id: string;
  status: string;
  template_key: string;
  task_id?: string | null;
  client_code?: string | null;
  campaign_code?: string | null;
  brief_json?: CpWeaveBrief;
  assets?: Array<{ id: string; lane?: string; checksum?: string; storage_uri?: string }>;
  ai_stub?: boolean;
};

export type CpWeaveIngestResult = {
  scanned: number;
  ingested: number;
  skipped: number;
  warnings: string[];
};

export function buildOpenHref(input: { href: string }): string {
  const href = String(input.href ?? '').trim();
  if (!href) throw new Error('href_required');
  const url = new URL(href);
  if (url.pathname.includes('/api/')) {
    throw new Error('weave_open_is_not_api');
  }
  return url.toString();
}

export function listWeaveOrders(token: string, projectId: string) {
  return cpFetch<{ items: CpWeaveWorkOrder[] }>(
    token,
    `/weave-orders?project_id=${encodeURIComponent(projectId)}`,
  );
}

export function createWeaveOrder(token: string, input: { project_id: string; template_key: string }) {
  return cpFetch<CpWeaveWorkOrder>(token, '/weave-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getWeaveOrder(token: string, id: string) {
  return cpFetch<CpWeaveWorkOrder>(token, `/weave-orders/${encodeURIComponent(id)}`);
}

export function generateWeaveBrief(token: string, id: string) {
  return cpFetch<CpWeaveWorkOrder>(token, `/weave-orders/${encodeURIComponent(id)}/generate-brief`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function openWeaveOrder(token: string, id: string) {
  return cpFetch<{ href: string }>(token, `/weave-orders/${encodeURIComponent(id)}/open`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function syncWeaveOutput(token: string, id: string, includeDrafts = false) {
  return cpFetch<CpWeaveIngestResult>(token, `/weave-orders/${encodeURIComponent(id)}/sync-output`, {
    method: 'POST',
    body: JSON.stringify({ include_drafts: includeDrafts }),
  });
}

export function submitWeaveReview(token: string, id: string) {
  return cpFetch<CpWeaveWorkOrder>(token, `/weave-orders/${encodeURIComponent(id)}/submit-review`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function deliverWeaveOrder(token: string, id: string) {
  return cpFetch<CpWeaveWorkOrder>(token, `/weave-orders/${encodeURIComponent(id)}/deliver`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function addWeaveAsset(token: string, id: string, input: { storage_uri: string; source?: string }) {
  return cpFetch<Record<string, unknown>>(token, `/weave-orders/${encodeURIComponent(id)}/assets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
