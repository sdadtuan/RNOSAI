import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import {
  API_URL,
  QT_MOCK_MONEY,
  QT_PUBLIC_ACCEPT_CTA,
  acceptPublicProposalApi,
  convertQtVersionApi,
  createQuoteFromLeadApi,
  fetchPublicProposalApi,
  fetchQtCatalogApi,
  getQtProposalApi,
  mintQtShareApi,
  publicHtmlLeaks,
  putQtLinesApi,
  putQtPaymentsApi,
  qtApi,
  qtCatalogItems,
  requestPublicProposalOtpApi,
  resolveQtLeadId,
  staffToken,
  type QtApiResult,
} from './qt-w1-helpers';

export {
  API_URL,
  QT_PUBLIC_ACCEPT_CTA,
  acceptPublicProposalApi,
  convertQtVersionApi,
  createQuoteFromLeadApi,
  fetchPublicProposalApi,
  fetchQtCatalogApi,
  getQtProposalApi,
  mintQtShareApi,
  publicHtmlLeaks,
  putQtLinesApi,
  putQtPaymentsApi,
  qtApi,
  qtCatalogItems,
  requestPublicProposalOtpApi,
  resolveQtLeadId,
  staffToken,
};
export type { QtApiResult };

/** AC-03 test input: 22.4% GM vs floor 25% (2240 vs 2500 bps). Not UI copy. */
export const QT_GM_BELOW_FLOOR_BPS = 2240;
export const QT_GM_FLOOR_BPS = 2500;
export const QT_AC03_FEE_VND = 100_000_000;
export const QT_AC03_COST_VND = 77_600_000;
export const QT_HEALTHY_GM_COST_VND = 70_000_000;

export const QT_PUBLIC_LEAK_KEYS = [
  'cost',
  'margin',
  'gm_bps',
  'nsr',
  'nsr_vnd',
  'direct_cost_vnd',
  'approval',
  'approvals',
  'approval_id',
] as const;

export const QT_PUBLIC_LEAK_RE =
  /"cost"|"margin"|"gm_bps"|"nsr"|"nsr_vnd"|"direct_cost_vnd"|"approval"|"approvals"|"approval_id"|"Hidden internal"/;

export const QT_OPTION_KEYS = ['A', 'B', 'C'] as const;

export type QtApprovalStep = {
  id?: string;
  section?: string;
  state?: string;
  seq?: number;
};

export type QtApprovalSubmit = {
  approval?: { id?: string; policy_snapshot?: { gm_bps?: number } };
  steps?: QtApprovalStep[];
};

export type QtOptionRow = {
  option_key?: string;
  name?: string;
  recommended?: boolean;
  client_visible?: boolean;
  payable_vnd?: number;
};

export type QtLineRow = {
  id?: number;
  dv_code?: string;
  sku_code?: string;
  package_tier?: string;
  qty?: number;
  unit_price_vnd?: number | string;
  final_price_vnd?: number | string;
  catalog_snapshot_json?: {
    package_tier?: string;
    rate?: { suggested_vnd?: number };
  };
};

export type QtSeededQuote = {
  proposalId: number;
  versionId: string;
  quoteCode?: string | null;
};

function qtError(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  return String((json as { error?: string }).error ?? '');
}

export function publicQuoteJsonLeaks(payload: unknown): string[] {
  const hits: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'string') {
      if (/Hidden internal/i.test(value)) hits.push('hidden_option');
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (
        (QT_PUBLIC_LEAK_KEYS as readonly string[]).includes(lower) ||
        lower.startsWith('cost_') ||
        lower.startsWith('approval_')
      ) {
        hits.push(key);
        continue;
      }
      walk(child);
    }
  };
  walk(payload);
  return [...new Set(hits)];
}

export function publicRenderLeaks(html: string): string[] {
  const hits = [...publicHtmlLeaks(html)];
  if (/\bgm_bps\b|direct[_\s-]?cost|cost_labor|cost_outsource/i.test(html)) hits.push('cost');
  if (/Hidden internal/i.test(html)) hits.push('hidden_option');
  if (/internal note/i.test(html)) hits.push('internal');
  return [...new Set(hits)];
}

export async function submitQtApprovalApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<QtApiResult<QtApprovalSubmit>> {
  return qtApi<QtApprovalSubmit>(
    request,
    token,
    `/api/crm/quote-versions/${encodeURIComponent(versionId)}/submit-approval`,
    { method: 'POST' },
  );
}

export async function publishQtVersionApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<QtApiResult> {
  return qtApi(request, token, `/api/crm/quote-versions/${encodeURIComponent(versionId)}/publish`, {
    method: 'POST',
  });
}

export async function createQtRevisionApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtApiResult<{ id?: string; n?: number; state?: string }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/versions`, { method: 'POST' });
}

export async function listQtVersionsApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtApiResult<{ versions?: Array<{ id?: string; n?: number; state?: string }> }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/versions`);
}

export async function diffQtVersionsApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  fromN: number,
  toN: number,
): Promise<QtApiResult<{ items?: Array<{ path?: string; from?: unknown; to?: unknown; critical?: boolean }> }>> {
  return qtApi(
    request,
    token,
    `/api/crm/proposals/${proposalId}/versions/${fromN}/diff/${toN}`,
  );
}

export async function listQtOptionsApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<QtApiResult<{ options?: QtOptionRow[] }>> {
  return qtApi(request, token, `/api/crm/quote-versions/${encodeURIComponent(versionId)}/options`);
}

export async function createQtOptionApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  body: { option_key?: string; name: string; recommended?: boolean; client_visible?: boolean },
): Promise<QtApiResult<{ option?: QtOptionRow; options?: QtOptionRow[] }>> {
  return qtApi(request, token, `/api/crm/quote-versions/${encodeURIComponent(versionId)}/options`, {
    method: 'POST',
    data: body,
  });
}

export async function patchQtOptionApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  optionKey: string,
  body: { client_visible?: boolean; recommended?: boolean; name?: string },
): Promise<QtApiResult<{ option?: QtOptionRow; options?: QtOptionRow[] }>> {
  return qtApi(
    request,
    token,
    `/api/crm/quote-versions/${encodeURIComponent(versionId)}/options/${encodeURIComponent(optionKey)}`,
    { method: 'PATCH', data: body },
  );
}

export async function actQtApprovalStepApi(
  request: APIRequestContext,
  token: string,
  stepId: string,
  body: { action: string; comment?: string; lost_reason?: string },
): Promise<QtApiResult<{ step?: QtApprovalStep; steps?: QtApprovalStep[] }>> {
  return qtApi(request, token, `/api/crm/quote-approval-steps/${encodeURIComponent(stepId)}/actions`, {
    method: 'POST',
    data: body,
  });
}

export async function recalculateQtApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  versionId: string,
): Promise<QtApiResult<{ gm_bps?: number | null; fee_vnd?: number; payable_vnd?: number }>> {
  return qtApi(
    request,
    token,
    `/api/crm/proposals/${proposalId}/versions/${encodeURIComponent(versionId)}/recalculate?section=finance`,
    { method: 'POST' },
  );
}

export async function saveQtStudioSectionsApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  sections: Record<string, boolean>,
): Promise<QtApiResult> {
  return qtApi(request, token, `/api/crm/quote-versions/${encodeURIComponent(versionId)}/studio`, {
    method: 'PATCH',
    data: { sections },
  });
}

export async function fetchQtCatalogPackagesApi(
  request: APIRequestContext,
  token: string,
): Promise<QtApiResult<{ packages?: Array<Record<string, unknown>> }>> {
  return qtApi(request, token, '/api/crm/proposals/quote-catalog/packages');
}

export async function getQtLinesApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtApiResult<{ lines?: QtLineRow[] }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/lines`);
}

export async function patchQtHeaderApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  body: { title?: string; objective?: string; audience?: string; campaign_period?: string },
  rowVersion: number,
): Promise<QtApiResult<{ row_version?: number }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}`, {
    method: 'PATCH',
    data: body,
    headers: { 'If-Match': String(rowVersion) },
  });
}

export function qtApiError(json: unknown): string {
  return qtError(json);
}

/** Empty money stays null — never coerce blank to 0. */
export function qtLineFeeVnd(line: QtLineRow | undefined): number | null {
  const unit = line?.unit_price_vnd;
  if (unit != null && unit !== '' && Number.isFinite(Number(unit))) {
    return Number(unit);
  }
  const suggested = line?.catalog_snapshot_json?.rate?.suggested_vnd;
  if (suggested != null && Number.isFinite(Number(suggested))) {
    return Number(suggested);
  }
  return null;
}

export function requireQtLineFeeVnd(line: QtLineRow | undefined, label: string): number {
  const fee = qtLineFeeVnd(line);
  if (fee == null) {
    throw new Error(`Wave 2 prerequisite missing: ${label} fee snapshot is empty (null/—), not 0`);
  }
  return fee;
}

/** Product UI only — unit specs may mention 265647600 as a forbidden fixture. */
export function assertNoMockMoneyInQtProductUi(): void {
  const root = join(__dirname, '../../src/components/crm/qt');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.spec\./.test(name)) continue;
      if (!/\.(tsx?|jsx?|css)$/.test(name)) continue;
      const text = readFileSync(full, 'utf8');
      if (text.includes(QT_MOCK_MONEY) || text.includes('265.647.600') || /22,4|8,46/.test(text)) {
        hits.push(full);
      }
    }
  };
  walk(root);
  expect(hits, `found mockup money in ${hits.join(', ')}`).toEqual([]);
}

export function requireActiveCatalogItem(catalogJson: {
  services?: Array<Record<string, unknown>>;
  families?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  const active = qtCatalogItems(catalogJson).find((item) => {
    const status = String(item.status ?? '').toLowerCase();
    return item.can_add_to_client_quote === true && status === 'active';
  });
  if (!active?.dv_code) {
    throw new Error('Wave 2 prerequisite missing: no active catalog item that can_add_to_client_quote');
  }
  return active;
}

export function otherCatalogTier(
  item: Record<string, unknown>,
  currentTier: string,
): { tier: string; suggested_vnd?: number | null } | null {
  const tiers = Array.isArray(item.package_tiers) ? (item.package_tiers as Array<Record<string, unknown>>) : [];
  const other = tiers.find((row) => {
    const tier = String(row.tier ?? '');
    return tier && tier !== currentTier && row.rate_missing !== true && Number(row.suggested_vnd ?? 0) > 0;
  });
  if (!other) return null;
  return { tier: String(other.tier), suggested_vnd: Number(other.suggested_vnd) };
}

export async function ensureQtHeaderComplete(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<void> {
  const detail = await getQtProposalApi(request, token, proposalId);
  expect(detail.ok, `QT detail ${proposalId}: ${detail.status}`).toBeTruthy();
  const title = String(detail.json.title ?? '').trim() || `QT-W2-${proposalId}`;
  const objective = String(detail.json.objective ?? '').trim() || 'Wave 2 UAT objective';
  const audience = String(detail.json.audience ?? '').trim() || 'CFO';
  const period = String(detail.json.campaign_period ?? '').trim() || '2026-Q4';
  if (
    String(detail.json.objective ?? '').trim() &&
    String(detail.json.audience ?? '').trim() &&
    String(detail.json.campaign_period ?? '').trim()
  ) {
    return;
  }
  const rowVersion = Number(detail.json.row_version ?? 1);
  const patched = await patchQtHeaderApi(
    request,
    token,
    proposalId,
    { title, objective, audience, campaign_period: period },
    rowVersion,
  );
  expect(patched.ok, `QT header patch: ${patched.status} ${JSON.stringify(patched.json)}`).toBeTruthy();
}

export async function seedQtWorkingQuote(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<QtSeededQuote> {
  const leadId = await resolveQtLeadId(request, token);
  const created = await createQuoteFromLeadApi(request, token, {
    lead_id: leadId,
    title,
  });
  expect(
    created.ok,
    `QT create from lead ${leadId}: ${created.status} ${JSON.stringify(created.json)}`,
  ).toBeTruthy();
  const proposalId = created.json.proposal?.id;
  const versionId = created.json.proposal?.current_version_id;
  expect(proposalId).toEqual(expect.any(Number));
  expect(versionId).toBeTruthy();
  await ensureQtHeaderComplete(request, token, proposalId!);
  return {
    proposalId: proposalId!,
    versionId: String(versionId),
    quoteCode: created.json.proposal?.quote_code,
  };
}

export async function putQtFeeLine(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  line: Record<string, unknown>,
): Promise<QtApiResult<{ lines?: QtLineRow[] }>> {
  return putQtLinesApi(request, token, proposalId, [line]) as Promise<
    QtApiResult<{ lines?: QtLineRow[] }>
  >;
}

export async function seedQtLineWithCosts(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  costs: { unit_price_vnd: number; cost_labor_vnd: number; qty?: number; package_tier?: string },
): Promise<QtLineRow> {
  const catalog = await fetchQtCatalogApi(request, token);
  const active = requireActiveCatalogItem(catalog.json);
  const line = {
    dv_code: String(active.dv_code),
    package_tier: costs.package_tier ?? 'standard',
    client_visible: true,
    qty: costs.qty ?? 1,
    unit_price_vnd: costs.unit_price_vnd,
    cost_labor_vnd: costs.cost_labor_vnd,
  };
  const added = await putQtFeeLine(request, token, proposalId, line);
  if (!added.ok && added.status === 403 && qtError(added.json) === 'missing_cap') {
    throw new Error(
      `Wave 2 prerequisite missing: crm_quote.finance is required to snapshot AC-03/AC-04 costs (${added.status} ${JSON.stringify(added.json)})`,
    );
  }
  expect(added.ok, `put QT line: ${added.status} ${JSON.stringify(added.json)}`).toBeTruthy();
  return added.json.lines?.[0] ?? line;
}

export async function prepareQtForApproval(
  request: APIRequestContext,
  token: string,
  seeded: QtSeededQuote,
): Promise<void> {
  const payments = await putQtPaymentsApi(request, token, seeded.versionId, [
    { pct_bps: 5000, milestone: 'Đợt 1' },
    { pct_bps: 3000, milestone: 'Đợt 2' },
    { pct_bps: 2000, milestone: 'Đợt 3' },
  ]);
  expect(payments.ok, `QT payments: ${payments.status} ${JSON.stringify(payments.json)}`).toBeTruthy();

  const recalc = await recalculateQtApi(request, token, seeded.proposalId, seeded.versionId);
  expect(recalc.ok, `QT recalc: ${recalc.status} ${JSON.stringify(recalc.json)}`).toBeTruthy();

  const studio = await saveQtStudioSectionsApi(request, token, seeded.versionId, {
    '08': true,
    '09': true,
  });
  expect(studio.ok, `QT studio: ${studio.status} ${JSON.stringify(studio.json)}`).toBeTruthy();
}

export async function approveAllQtSteps(
  request: APIRequestContext,
  token: string,
  steps: QtApprovalStep[],
): Promise<void> {
  const ordered = [...steps].sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0));
  for (const step of ordered) {
    if (!step.id) continue;
    const acted = await actQtApprovalStepApi(request, token, step.id, { action: 'approve' });
    if (acted.status === 403 || acted.status === 404) {
      throw new Error(
        `Wave 2 prerequisite missing: crm_quote.approve for step ${step.section} (${acted.status} ${JSON.stringify(acted.json)})`,
      );
    }
    expect(acted.ok, `approve ${step.section}: ${acted.status} ${JSON.stringify(acted.json)}`).toBeTruthy();
  }
}

export async function ensureQtOptionsAbc(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<QtOptionRow[]> {
  const listed = await listQtOptionsApi(request, token, versionId);
  expect(listed.ok, `list options: ${listed.status}`).toBeTruthy();
  const have = new Set((listed.json.options ?? []).map((row) => String(row.option_key)));
  const names: Record<(typeof QT_OPTION_KEYS)[number], string> = {
    A: 'Phương án A',
    B: 'Phương án B',
    C: 'Hidden internal',
  };
  for (const key of QT_OPTION_KEYS) {
    if (have.has(key)) continue;
    const created = await createQtOptionApi(request, token, versionId, {
      option_key: key,
      name: names[key],
      recommended: key === 'B',
      client_visible: key !== 'C',
    });
    expect(created.ok, `create option ${key}: ${created.status} ${JSON.stringify(created.json)}`).toBeTruthy();
  }
  const hidden = await patchQtOptionApi(request, token, versionId, 'C', {
    client_visible: false,
    name: 'Hidden internal',
  });
  expect(hidden.ok, `hide option C: ${hidden.status} ${JSON.stringify(hidden.json)}`).toBeTruthy();
  const after = await listQtOptionsApi(request, token, versionId);
  const keys = (after.json.options ?? []).map((row) => String(row.option_key)).sort();
  expect(keys).toEqual(['A', 'B', 'C']);
  return after.json.options ?? [];
}
