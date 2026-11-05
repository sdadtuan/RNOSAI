import { BadRequestException } from '@nestjs/common';
import { normalizeQuoteTier } from './quote-pricing.util';

export type QuoteCatalogImportRateCard = {
  dv_code: string;
  package_tier: string;
  fee_vnd: number;
  cost_labor_vnd: number | null;
  effective_from: string;
  effective_to: string | null;
  state: 'active' | 'retired';
};

export type QuoteCatalogImportRevision = {
  catalog_service_id: string;
  profile_json: Record<string, unknown>;
};

export type QuoteCatalogImportParsed = {
  rate_cards: QuoteCatalogImportRateCard[];
  revisions: QuoteCatalogImportRevision[];
};

function importBad(error: string, extra?: Record<string, unknown>): never {
  throw new BadRequestException({ error, ...extra });
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function parseBigintVnd(value: unknown, field: string, required: boolean): number | null {
  if (value == null || value === '') {
    if (required) importBad('import_fee_required', { field });
    return null;
  }
  const raw = String(value).trim().replace(/,/g, '');
  if (!/^-?\d+$/.test(raw)) importBad('import_fee_invalid', { field });
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) importBad('import_fee_invalid', { field });
  return n;
}

function parseDate(value: unknown, required: boolean): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) importBad('import_date_required');
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  importBad('import_date_invalid', { value: raw });
}

function parseState(value: unknown): 'active' | 'retired' {
  return String(value ?? '').trim().toLowerCase() === 'retired' ? 'retired' : 'active';
}

function mapRateCard(row: Record<string, unknown>): QuoteCatalogImportRateCard {
  const dv = String(row.dv_code ?? '').trim().toUpperCase();
  if (!dv) importBad('import_dv_required');
  const tier = normalizeQuoteTier(String(row.package_tier ?? 'standard')) ?? 'standard';
  const fee = parseBigintVnd(row.fee_vnd, 'fee_vnd', true);
  return {
    dv_code: dv,
    package_tier: tier,
    fee_vnd: fee as number,
    cost_labor_vnd: parseBigintVnd(row.cost_labor_vnd, 'cost_labor_vnd', false),
    effective_from: parseDate(row.effective_from, true) as string,
    effective_to: parseDate(row.effective_to, false),
    state: parseState(row.state),
  };
}

function mapRevision(row: Record<string, unknown>): QuoteCatalogImportRevision {
  const id = String(row.catalog_service_id ?? row.dv_code ?? '').trim();
  if (!id) importBad('import_revision_id_required');
  const profile = asObject(row.profile_json);
  return { catalog_service_id: id, profile_json: Object.keys(profile).length ? profile : { ...row } };
}

function parseCsvRecords(text: string): Array<Record<string, unknown>> {
  const raw = String(text ?? '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) importBad('import_csv_empty');
  const headers = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const rec: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      rec[header] = cells[index] ?? '';
    });
    return rec;
  });
}

function revisionFromRate(card: QuoteCatalogImportRateCard): QuoteCatalogImportRevision {
  return {
    catalog_service_id: card.dv_code,
    profile_json: {
      dv_code: card.dv_code,
      package_tier: card.package_tier,
      fee_vnd: card.fee_vnd,
      cost_labor_vnd: card.cost_labor_vnd,
      effective_from: card.effective_from,
      effective_to: card.effective_to,
      state: card.state,
    },
  };
}

export function parseQuoteCatalogImport(input: {
  csv?: string;
  json?: unknown;
  filename?: string;
}): QuoteCatalogImportParsed {
  const filename = String(input.filename ?? '').toLowerCase();
  let source: unknown = input.json;
  if (source == null && input.csv) {
    source = filename.endsWith('.json')
      ? JSON.parse(input.csv)
      : { rate_cards: parseCsvRecords(input.csv) };
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    source = trimmed.startsWith('{') || trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : { rate_cards: parseCsvRecords(trimmed) };
  }
  if (Array.isArray(source)) source = { rate_cards: source };
  const doc = asObject(source);
  const rateRows = Array.isArray(doc.rate_cards) ? doc.rate_cards : [];
  const revisionRows = Array.isArray(doc.revisions) ? doc.revisions : [];
  if (!rateRows.length && !revisionRows.length && Object.keys(doc).length) {
    if (doc.dv_code) {
      return parseQuoteCatalogImport({ json: { rate_cards: [doc] } });
    }
  }
  const rate_cards = rateRows.map((row) => mapRateCard(asObject(row)));
  const revisions = revisionRows.length
    ? revisionRows.map((row) => mapRevision(asObject(row)))
    : rate_cards.map(revisionFromRate);
  if (!rate_cards.length && !revisions.length) importBad('import_payload_empty');
  return { rate_cards, revisions };
}
