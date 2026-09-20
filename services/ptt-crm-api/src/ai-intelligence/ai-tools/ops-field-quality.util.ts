/** P8 — field quality statuses for Pain / ICP / Service / TMMT core. */

export const FIELD_QUALITY_STATUSES = [
  'empty',
  'assumed_draft',
  'assumed_confirmed',
  'validated',
] as const;

export type FieldQualityStatus = (typeof FIELD_QUALITY_STATUSES)[number];

export type FieldQualityMeta = {
  status: FieldQualityStatus;
  source?: string;
  confidence?: number;
  citations?: string[];
  filled_by?: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  text?: string;
};

export const GATE_SATISFYING_STATUSES: ReadonlySet<FieldQualityStatus> = new Set([
  'assumed_confirmed',
  'validated',
]);

export function isGateSatisfyingStatus(status: unknown): boolean {
  return GATE_SATISFYING_STATUSES.has(String(status ?? '') as FieldQualityStatus);
}

export function parseFieldQualityStatus(raw: unknown): FieldQualityStatus {
  const s = String(raw ?? '').trim();
  if ((FIELD_QUALITY_STATUSES as readonly string[]).includes(s)) {
    return s as FieldQualityStatus;
  }
  return 'empty';
}

export function normalizeFieldMeta(raw: unknown): FieldQualityMeta {
  if (!raw || typeof raw !== 'object') {
    return { status: 'empty' };
  }
  const row = raw as Record<string, unknown>;
  const status = parseFieldQualityStatus(row.status);
  const citations = Array.isArray(row.citations)
    ? row.citations.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];
  return {
    status,
    source: row.source != null ? String(row.source).slice(0, 120) : undefined,
    confidence:
      row.confidence != null && Number.isFinite(Number(row.confidence))
        ? Math.max(0, Math.min(1, Number(row.confidence)))
        : undefined,
    citations,
    filled_by: row.filled_by != null ? String(row.filled_by).slice(0, 120) : undefined,
    confirmed_by:
      row.confirmed_by == null ? null : String(row.confirmed_by).slice(0, 120),
    confirmed_at:
      row.confirmed_at == null ? null : String(row.confirmed_at).slice(0, 40),
    text: row.text != null ? String(row.text).slice(0, 4000) : undefined,
  };
}

/** Legacy non-empty text without meta → treat as validated (human-entered pre-P8). */
export function resolveFieldStatus(opts: {
  text?: string;
  meta?: unknown;
}): FieldQualityMeta {
  const meta = normalizeFieldMeta(opts.meta);
  const text = String(opts.text ?? meta.text ?? '').trim();
  if (!text) {
    return { ...meta, status: 'empty', text: '' };
  }
  if (meta.status === 'empty' && !opts.meta) {
    return {
      status: 'validated',
      source: 'legacy_filled',
      confidence: 0.9,
      text,
    };
  }
  if (meta.status === 'empty' && text) {
    return { ...meta, status: 'assumed_draft', text };
  }
  return { ...meta, text };
}

export function statusSatisfiesGate(meta: FieldQualityMeta): boolean {
  return isGateSatisfyingStatus(meta.status) && Boolean(String(meta.text ?? '').trim());
}
