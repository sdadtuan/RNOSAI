import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import {
  API_URL,
  QT_PUBLIC_ACCEPT_CTA,
  convertQtVersionApi,
  getQtProposalApi,
  listQtQuotesApi,
  patchQtStatusApi,
  putQtLinesApi,
  qtApi,
  qtCatalogItems,
  staffToken,
  type QtApiResult,
  type QtConvertDto,
} from './qt-w1-helpers';
import {
  QT_AC03_COST_VND,
  QT_AC03_FEE_VND,
  QT_HEALTHY_GM_COST_VND,
  assertNoMockMoneyInQtProductUi,
  approveAllQtSteps,
  fetchQtCatalogApi,
  getQtLinesApi,
  prepareQtForApproval,
  publishQtVersionApi,
  putQtFeeLine,
  qtApiError,
  requireActiveCatalogItem,
  seedQtLineWithCosts,
  seedQtWorkingQuote,
  submitQtApprovalApi,
  type QtLineRow,
  type QtSeededQuote,
} from './qt-w2-helpers';

export {
  API_URL,
  QT_PUBLIC_ACCEPT_CTA,
  convertQtVersionApi,
  getQtProposalApi,
  listQtQuotesApi,
  patchQtStatusApi,
  staffToken,
};
export {
  assertNoMockMoneyInQtProductUi,
  approveAllQtSteps,
  fetchQtCatalogApi,
  getQtLinesApi,
  prepareQtForApproval,
  publishQtVersionApi,
  putQtFeeLine,
  qtApiError,
  requireActiveCatalogItem,
  seedQtLineWithCosts,
  seedQtWorkingQuote,
  submitQtApprovalApi,
};
export type { QtApiResult, QtConvertDto, QtLineRow, QtSeededQuote };

export const QT_REPORT_TAB_SLUGS = [
  'executive',
  'funnel',
  'margin',
  'loss',
  'engagement',
] as const;

export const QT_REPORT_TAB_IDS = [
  'rpt-01',
  'rpt-02',
  'rpt-03',
  'rpt-04',
  'rpt-05',
] as const;

export const QT_REPORT_TAB_ALIAS: Record<(typeof QT_REPORT_TAB_IDS)[number], (typeof QT_REPORT_TAB_SLUGS)[number]> =
  {
    'rpt-01': 'executive',
    'rpt-02': 'funnel',
    'rpt-03': 'margin',
    'rpt-04': 'loss',
    'rpt-05': 'engagement',
  };

export const QT_VID_TPL_01 = 'VID-TPL-01';
export const QT_LOST_REASONS = ['budget', 'competitor', 'priority', 'scope', 'other'] as const;

export type QtReportDto = {
  tab?: string;
  sent_count?: number;
  sent_value_vnd?: number | null;
  steps?: unknown[];
  groups?: unknown[];
  reasons?: unknown[];
  items?: unknown[];
};

export type QtCatalogImportDto = {
  job_id?: string;
  state?: string;
  result?: { rate_cards?: number; revisions?: number; errors?: string[] };
};

export type QtSettingsDto = {
  handoff_video?: boolean;
  ai_enabled?: boolean;
};

function qtRoot(): string {
  return join(__dirname, '../../src/components/crm/qt');
}

export async function fetchQtReportsApi(
  request: APIRequestContext,
  token: string,
  tab: string,
  query = 'scope=all',
): Promise<QtApiResult<QtReportDto>> {
  const suffix = query ? `&${query}` : '';
  return qtApi<QtReportDto>(
    request,
    token,
    `/api/crm/proposals/reports?tab=${encodeURIComponent(tab)}${suffix}`,
  );
}

export async function importQtCatalogApi(
  request: APIRequestContext,
  token: string,
  body: { filename: string; csv?: string; json?: unknown },
): Promise<QtApiResult<QtCatalogImportDto>> {
  return qtApi<QtCatalogImportDto>(request, token, '/api/crm/proposals/quote-catalog/import', {
    method: 'POST',
    data: body,
  });
}

export async function generateQtProposalApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtApiResult<{ error?: string }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/generate`, { method: 'POST' });
}

export async function fetchQtSettingsApi(
  request: APIRequestContext,
  token: string,
): Promise<QtApiResult<QtSettingsDto>> {
  return qtApi<QtSettingsDto>(request, token, '/api/crm/proposals/settings');
}

export async function patchQtSettingsApi(
  request: APIRequestContext,
  token: string,
  body: Partial<QtSettingsDto>,
): Promise<QtApiResult<QtSettingsDto>> {
  return qtApi<QtSettingsDto>(request, token, '/api/crm/proposals/settings', {
    method: 'PATCH',
    data: body,
  });
}

export function findBrandFilmCatalogItem(
  catalogJson: Parameters<typeof qtCatalogItems>[0],
): Record<string, unknown> | undefined {
  const items = qtCatalogItems(catalogJson);
  const match = items.find((item) => {
    const dv = String(item.dv_code ?? '').toUpperCase();
    const kind = String(item.kind ?? item.catalog_kind ?? '').toLowerCase();
    const name = String(item.name ?? item.title ?? '');
    const template = String(item.template_key ?? '');
    const addable =
      item.can_add_to_client_quote === true && String(item.status ?? '').toLowerCase() === 'active';
    if (!addable) return false;
    return (
      dv === 'DV12' ||
      template === QT_VID_TPL_01 ||
      kind === 'brand_film' ||
      kind === 'human_video' ||
      /brand\s*film|reels|video/i.test(name)
    );
  });
  return match;
}

export async function ensureHandoffVideo(
  request: APIRequestContext,
  token: string,
): Promise<{ previous: boolean; enabled: boolean }> {
  const current = await fetchQtSettingsApi(request, token);
  if (!current.ok) {
    throw new Error(
      `Wave 3 prerequisite missing: GET settings (${current.status} ${JSON.stringify(current.json)})`,
    );
  }
  const previous = current.json.handoff_video === true;
  if (previous) return { previous, enabled: true };
  const patched = await patchQtSettingsApi(request, token, { handoff_video: true });
  if (patched.status === 403 || patched.status === 404) {
    throw new Error(
      `Wave 3 prerequisite missing: crm_quote manage to set handoff_video (${patched.status} ${JSON.stringify(patched.json)})`,
    );
  }
  expect(
    patched.ok,
    `PATCH handoff_video: ${patched.status} ${JSON.stringify(patched.json)}`,
  ).toBeTruthy();
  expect(patched.json.handoff_video).toBe(true);
  return { previous, enabled: true };
}

export async function restoreHandoffVideo(
  request: APIRequestContext,
  token: string,
  previous: boolean,
): Promise<void> {
  if (previous) return;
  await patchQtSettingsApi(request, token, { handoff_video: false });
}

export async function seedBrandFilmLine(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtLineRow> {
  const catalog = await fetchQtCatalogApi(request, token);
  const brand = findBrandFilmCatalogItem(catalog.json);
  const active = brand ?? requireActiveCatalogItem(catalog.json);
  const dvCode = String(active.dv_code);
  const snapshot = {
    ...(typeof active.catalog_snapshot_json === 'object' && active.catalog_snapshot_json
      ? (active.catalog_snapshot_json as Record<string, unknown>)
      : {}),
    status: 'active',
    kind: brand ? String((active as { kind?: string }).kind ?? 'brand_film') : 'brand_film',
    template_key: QT_VID_TPL_01,
    rate:
      (active as { rate?: { suggested_vnd?: number } }).rate ??
      ({ suggested_vnd: QT_AC03_FEE_VND } as { suggested_vnd: number }),
  };
  const added = await putQtLinesApi(request, token, proposalId, [
    {
      dv_code: dvCode,
      package_tier: 'standard',
      client_visible: true,
      qty: 1,
      unit_price_vnd: QT_AC03_FEE_VND,
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
      catalog_snapshot_json: snapshot,
    },
  ]);
  expect(added.ok, `Brand Film line: ${added.status} ${JSON.stringify(added.json)}`).toBeTruthy();
  return ((added.json as { lines?: QtLineRow[] }).lines?.[0] ?? {
    dv_code: dvCode,
    package_tier: 'standard',
  }) as QtLineRow;
}

export async function acceptAndConvertTwice(
  request: APIRequestContext,
  token: string,
  seeded: QtSeededQuote,
  keyPrefix: string,
): Promise<{ first: QtApiResult<QtConvertDto>; second: QtApiResult<QtConvertDto> }> {
  const accepted = await patchQtStatusApi(request, token, seeded.proposalId, 'accepted');
  if (!accepted.ok) {
    throw new Error(
      `Wave 3 prerequisite missing: accept ${seeded.proposalId} (${accepted.status} ${JSON.stringify(accepted.json)})`,
    );
  }
  const first = await convertQtVersionApi(
    request,
    token,
    seeded.proposalId,
    seeded.versionId,
    `${keyPrefix}-a`,
  );
  if (first.status === 403 || first.status === 404) {
    throw new Error(
      `Wave 3 prerequisite missing: convert ${seeded.proposalId}/${seeded.versionId} (${first.status} ${JSON.stringify(first.json)})`,
    );
  }
  expect(first.ok, `first convert: ${first.status} ${JSON.stringify(first.json)}`).toBeTruthy();
  const second = await convertQtVersionApi(
    request,
    token,
    seeded.proposalId,
    seeded.versionId,
    `${keyPrefix}-b`,
  );
  expect(second.ok, `second convert: ${second.status} ${JSON.stringify(second.json)}`).toBeTruthy();
  return { first, second };
}

export async function publishWorkingQuote(
  request: APIRequestContext,
  token: string,
  seeded: QtSeededQuote,
): Promise<void> {
  await seedQtLineWithCosts(request, token, seeded.proposalId, {
    unit_price_vnd: QT_AC03_FEE_VND,
    cost_labor_vnd: QT_AC03_COST_VND,
  });
  await prepareQtForApproval(request, token, seeded);
  const submitted = await submitQtApprovalApi(request, token, seeded.versionId);
  expect(
    submitted.ok,
    `submit-approval: ${submitted.status} ${JSON.stringify(submitted.json)}`,
  ).toBeTruthy();
  await approveAllQtSteps(request, token, submitted.json.steps ?? []);
  const published = await publishQtVersionApi(request, token, seeded.versionId);
  if (published.status === 403) {
    throw new Error(
      `Wave 3 prerequisite missing: crm_quote.publish (${published.status} ${JSON.stringify(published.json)})`,
    );
  }
  expect(published.ok, `publish: ${published.status} ${JSON.stringify(published.json)}`).toBeTruthy();
}

export function assertQtReportTabsInSource(): void {
  const src = readFileSync(join(qtRoot(), 'QtReports.tsx'), 'utf8');
  for (const id of QT_REPORT_TAB_IDS) {
    expect(src, `missing ${id}`).toContain(`'${id}'`);
  }
  for (const slug of QT_REPORT_TAB_SLUGS) {
    expect(src, `missing slug ${slug}`).toContain(`${slug}:`);
  }
  expect(src).toContain('dash(null)');
  const format = readFileSync(join(__dirname, '../../src/lib/crm/qt-format.ts'), 'utf8');
  expect(format).toContain("return '—'");
  expect(src).not.toContain('265.647.600');
  expect(src).not.toMatch(/22,4|8,46/);
}

export function assertNoQtVideoEditor(): void {
  const convert = readFileSync(join(qtRoot(), 'QtConvert.tsx'), 'utf8');
  const catalog = readFileSync(join(qtRoot(), 'QtCatalog.tsx'), 'utf8');
  expect(convert).toContain('/crm/video/');
  expect(convert).toContain('template_key');
  expect(convert.toLowerCase()).not.toContain('timeline editor');
  expect(convert).not.toMatch(/contenteditable|video-editor|host editor/i);
  expect(catalog).toContain('QT không host editor video');
  expect(catalog).toContain(QT_VID_TPL_01);
}

export function assertQtAiFlagUnset(): void {
  const raw = process.env.QT_AI_ENABLED;
  expect(raw === undefined || raw === '', `QT_AI_ENABLED must stay unset (got ${JSON.stringify(raw)})`).toBe(
    true,
  );
}

export function assertQtW3SourceGuards(): void {
  assertNoMockMoneyInQtProductUi();
  assertQtReportTabsInSource();
  assertNoQtVideoEditor();
  assertQtAiFlagUnset();
  expect(QT_PUBLIC_ACCEPT_CTA).toBe('Xác nhận đề xuất');
}
