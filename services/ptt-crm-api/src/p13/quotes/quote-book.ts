import { createHash } from 'crypto';
import { calculateQuote, snapshotOf, type QuoteLineInput, type QuoteServiceRef, type QuoteSettings, type QuoteItemRef, type QuoteTotals } from './quote-calc';
import { QuoteError } from './quote-error';
import { PDF_RENDERER_VERSION, renderQuotePdf, type QuotePdfInput } from './quote-pdf';
import { addCalendarDays, isExpired, saigonDate } from './quote-validity';
import type { PricingRoleInput, PricingSettingsInput } from '../pricing/pricing-engine';

export type QuoteActor = {
  staffId: number;
  email: string;
  seeAll: boolean;
  seeMargin: boolean;
  seeCost: boolean;
  canApprove: boolean;
  canEditSettings: boolean;
};

export type QuoteFileRow = {
  seq: number;
  kind: 'quote_draft' | 'quote_final';
  file_name: string;
  renderer_version: string;
  data_hash: string;
  display_mode: string;
  exported_by: string;
  exported_at: string;
  bytes?: Buffer;
};

export type P13Quote = {
  id: number;
  quote_code: string;
  version_n: number;
  pricing_source: 'p13';
  status: string;
  owner_staff_id: number;
  shared_staff_ids: number[];
  title: string;
  client_name: string;
  am_name: string;
  display_mode: QuotePdfInput['display_mode'];
  validity_days: number | null;
  issued_at: string | null;
  valid_until: string | null;
  extra_discount_pct: string | null;
  p13_approval_status: 'none' | 'pending' | 'approved' | 'returned';
  needs_approval: boolean;
  approval_reasons: string[];
  approval_note: string | null;
  sent_channel: string | null;
  sent_evidence_url: string | null;
  accepted_evidence_url: string | null;
  accepted_by_contact: string | null;
  rejected_reason: string | null;
  payment_terms: string;
  lines: QuoteLineInput[];
  line_ids: number[];
  calc: QuoteTotals | null;
  snapshot: Record<string, unknown> | null;
  pricing_version_id: string | null;
  files: QuoteFileRow[];
  total_vnd: string | null;
  fee_vnd: string | null;
  margin_pct_effective: string | null;
  is_test: boolean;
  ever_left_draft: boolean;
};

export type QuoteContext = {
  now: Date;
  settings: QuoteSettings;
  roles: PricingRoleInput[] | null;
  pricing: PricingSettingsInput | null;
  version: { id: string; code: string } | null;
  services: QuoteServiceRef[];
  items: QuoteItemRef[];
  company: { legal_name: string; tax_code: string; contact: string };
  allocateCode: () => string;
};

const HIDDEN_COST = ['cost_total', 'cost_snapshot', 'hourly_rate', 'rate', 'monthly_salary', 'insurance_pct', 'monthly_benefits'];

export function visibleQuote(quote: P13Quote, actor: QuoteActor): Record<string, unknown> {
  if (!actor.seeAll && quote.owner_staff_id !== actor.staffId && !quote.shared_staff_ids.includes(actor.staffId)) {
    throw new QuoteError(404, 'not_found');
  }
  const data = JSON.parse(JSON.stringify(publicView(quote))) as Record<string, unknown>;
  if (!actor.seeCost) stripKeys(data, HIDDEN_COST);
  if (!actor.seeMargin) stripKeys(data, ['margin_pct_effective']);
  return data;
}

function stripKeys(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => stripKeys(item, keys));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) delete record[key];
  Object.values(record).forEach((item) => stripKeys(item, keys));
}

export function publicView(quote: P13Quote) {
  const today = '';
  return {
    id: quote.id,
    quote_code: quote.quote_code,
    version_n: quote.version_n,
    pricing_source: quote.pricing_source,
    status: quote.status,
    p13_approval_status: quote.p13_approval_status,
    owner_staff_id: quote.owner_staff_id,
    title: quote.title,
    client_name: quote.client_name,
    display_mode: quote.display_mode,
    validity_days: quote.validity_days,
    extra_discount_pct: quote.extra_discount_pct,
    issued_at: quote.issued_at,
    valid_until: quote.valid_until,
    lines: (quote.calc?.lines ?? []).map((line, index) => ({ ...line, id: quote.line_ids?.[index] ?? null })),
    totals: quote.calc?.totals ?? null,
    total: quote.total_vnd,
    fee: quote.fee_vnd,
    margin_pct_effective: quote.margin_pct_effective,
    effective_discount_pct: quote.calc?.effective_discount_pct ?? null,
    needs_approval: quote.needs_approval,
    approval_reasons: quote.approval_reasons,
    warnings: quote.calc?.warnings ?? [],
    blockers: blockersOf(quote, today),
    missing: quote.calc?.missing ?? [],
    snapshot: quote.snapshot,
    pricing_version_id: quote.pricing_version_id,
    files: quote.files.map(({ bytes: _bytes, ...row }) => row),
  };
}

function blockersOf(quote: P13Quote, today: string): string[] {
  const blockers = new Set(quote.calc?.blockers ?? []);
  if (quote.validity_days == null) blockers.add('quote_validity_missing');
  if (today && quote.valid_until && isExpired(today, quote.valid_until)) blockers.add('quote_expired');
  return [...blockers];
}

function assertDraftEditable(quote: P13Quote) {
  if (quote.status !== 'draft') throw new QuoteError(409, 'quote_locked');
  if (quote.p13_approval_status === 'pending') throw new QuoteError(409, 'quote_locked');
}

function recalc(quote: P13Quote, ctx: QuoteContext) {
  const calc = calculateQuote({
    lines: quote.lines,
    extra_discount_pct: quote.extra_discount_pct,
    validity_days: quote.validity_days,
    settings: ctx.settings,
    roles: ctx.roles,
    pricing: ctx.pricing,
    version: ctx.version,
    services: ctx.services,
    items: ctx.items,
  });
  quote.calc = calc;
  quote.needs_approval = calc.needs_approval;
  quote.approval_reasons = calc.approval_reasons;
  quote.total_vnd = calc.totals?.grand_total ?? null;
  quote.fee_vnd = calc.totals?.fee_total ?? null;
  quote.margin_pct_effective = calc.totals?.margin_pct_effective ?? null;
  quote.pricing_version_id = ctx.version?.id ?? quote.pricing_version_id;
}

export function createP13Quote(
  input: { title?: string; client_name?: string; am_name?: string; owner_staff_id?: number; is_test?: boolean },
  ctx: QuoteContext,
  actor: QuoteActor,
): P13Quote {
  const days = ctx.settings.default_validity_days;
  const quote: P13Quote = {
    id: 0,
    quote_code: ctx.allocateCode(),
    version_n: 1,
    pricing_source: 'p13',
    status: 'draft',
    owner_staff_id: input.owner_staff_id ?? actor.staffId,
    shared_staff_ids: [],
    title: input.title ?? '',
    client_name: input.client_name ?? '',
    am_name: input.am_name ?? '',
    display_mode: ctx.settings.default_display_mode,
    validity_days: days,
    issued_at: null,
    valid_until: null,
    extra_discount_pct: '0',
    p13_approval_status: 'none',
    needs_approval: false,
    approval_reasons: [],
    approval_note: null,
    sent_channel: null,
    sent_evidence_url: null,
    accepted_evidence_url: null,
    accepted_by_contact: null,
    rejected_reason: null,
    payment_terms: '',
    lines: [],
    line_ids: [],
    calc: null,
    snapshot: null,
    pricing_version_id: ctx.version?.id ?? null,
    files: [],
    total_vnd: null,
    fee_vnd: null,
    margin_pct_effective: null,
    is_test: input.is_test === true,
    ever_left_draft: false,
  };
  recalc(quote, ctx);
  return quote;
}

export function removeQuoteLine(quote: P13Quote, index: number, ctx: QuoteContext) {
  if (index < 0 || index >= quote.lines.length) throw new QuoteError(404, 'not_found');
  putQuoteLines(
    quote,
    quote.lines.filter((_, lineIndex) => lineIndex !== index),
    quote.extra_discount_pct,
    quote.validity_days,
    ctx,
  );
  quote.line_ids = quote.line_ids.filter((_, lineIndex) => lineIndex !== index);
  return quote;
}

export function putQuoteLines(quote: P13Quote, lines: QuoteLineInput[], extra: string | null | undefined, validityDays: number | null | undefined, ctx: QuoteContext) {
  assertDraftEditable(quote);
  quote.lines = lines;
  if (extra !== undefined) quote.extra_discount_pct = extra;
  if (validityDays !== undefined) quote.validity_days = validityDays;
  if (quote.p13_approval_status === 'approved') quote.p13_approval_status = 'none';
  recalc(quote, ctx);
  return quote;
}

export function quoteChecks(quote: P13Quote, ctx: QuoteContext) {
  const today = saigonDate(ctx.now);
  const expired = Boolean(quote.issued_at && quote.valid_until && isExpired(today, quote.valid_until));
  const companyMissing = !ctx.company.legal_name.trim() || !ctx.company.tax_code.trim() || !ctx.company.contact.trim();
  const blockers = blockersOf(quote, today);
  if (expired) blockers.push('quote_expired');
  return {
    blockers,
    warnings: quote.calc?.warnings ?? [],
    missing: quote.calc?.missing ?? [],
    needs_approval: quote.needs_approval,
    approval_reasons: quote.approval_reasons,
    can_send: blockers.length === 0 && (!quote.needs_approval || quote.p13_approval_status === 'approved'),
    company_profile_incomplete: companyMissing,
    expired,
    valid_until_if_issued_today: quote.validity_days == null ? null : addCalendarDays(today, quote.validity_days),
    discount_approval_threshold_pct: ctx.settings.discount_approval_threshold_pct,
  };
}

function assertSendable(quote: P13Quote, ctx: QuoteContext) {
  const checks = quoteChecks(quote, ctx);
  if (checks.missing.length || checks.blockers.includes('pricing_params_incomplete')) {
    throw new QuoteError(409, 'pricing_params_incomplete', { missing: checks.missing });
  }
  if (checks.blockers.includes('quote_validity_missing')) throw new QuoteError(409, 'quote_validity_missing');
  if (checks.blockers.includes('quote_empty')) throw new QuoteError(409, 'quote_empty');
  if (checks.expired || checks.blockers.includes('quote_expired')) throw new QuoteError(409, 'quote_expired');
  if (quote.needs_approval && quote.p13_approval_status !== 'approved') {
    throw new QuoteError(409, 'quote_approval_required', { approval_reasons: quote.approval_reasons });
  }
}

export function submitQuote(quote: P13Quote, ctx: QuoteContext, actor: QuoteActor) {
  if (quote.status !== 'draft') throw new QuoteError(409, 'quote_invalid_transition');
  if (quote.p13_approval_status === 'pending') throw new QuoteError(409, 'quote_invalid_transition');
  const checks = quoteChecks(quote, ctx);
  if (checks.missing.length) throw new QuoteError(409, 'pricing_params_incomplete', { missing: checks.missing });
  if (quote.validity_days == null) throw new QuoteError(409, 'quote_validity_missing');
  if (checks.expired) throw new QuoteError(409, 'quote_expired');
  if ((quote.calc?.lines.filter((line) => line.line_type === 'package' || line.line_type === 'item' || line.line_type === 'custom').length ?? 0) < 1) {
    throw new QuoteError(409, 'quote_empty');
  }
  quote.p13_approval_status = 'pending';
  quote.snapshot = snapshotOf(quote.calc ?? calculateQuote({ lines: [], settings: ctx.settings, roles: null, pricing: null, services: [], items: [] }), ctx.version, ctx.settings.discount_approval_threshold_pct, quote.validity_days);
  quote.ever_left_draft = false;
  void actor;
  return quote;
}

export function approveQuote(quote: P13Quote, actor: QuoteActor) {
  if (!actor.canApprove) throw new QuoteError(403, 'missing_cap');
  if (quote.status !== 'draft' || quote.p13_approval_status !== 'pending') throw new QuoteError(409, 'quote_invalid_transition');
  quote.p13_approval_status = 'approved';
  quote.approval_note = null;
  return quote;
}

export function returnQuote(quote: P13Quote, note: string | null | undefined, actor: QuoteActor) {
  if (!actor.canApprove) throw new QuoteError(403, 'missing_cap');
  if (!note?.trim()) throw new QuoteError(422, 'quote_evidence_required', { field: 'approval_note' });
  if (quote.p13_approval_status !== 'pending') throw new QuoteError(409, 'quote_invalid_transition');
  quote.p13_approval_status = 'returned';
  quote.approval_note = note.trim();
  return quote;
}

export function markSent(quote: P13Quote, body: { sent_channel?: string; sent_evidence_url?: string; dry_run?: boolean }, ctx: QuoteContext) {
  if (quote.status !== 'draft') throw new QuoteError(409, 'quote_invalid_transition');
  assertSendable(quote, ctx);
  if (!body.sent_channel || !body.sent_evidence_url) throw new QuoteError(422, 'quote_evidence_required', { field: 'sent_evidence_url' });
  if (body.dry_run) return quote;
  const today = saigonDate(ctx.now);
  if (!quote.issued_at) {
    quote.issued_at = today;
    quote.valid_until = quote.validity_days == null ? null : addCalendarDays(today, quote.validity_days);
  } else if (quote.valid_until && isExpired(today, quote.valid_until)) {
    throw new QuoteError(409, 'quote_expired');
  }
  quote.status = 'sent';
  quote.sent_channel = body.sent_channel;
  quote.sent_evidence_url = body.sent_evidence_url;
  quote.ever_left_draft = true;
  quote.snapshot = snapshotOf(quote.calc!, ctx.version, ctx.settings.discount_approval_threshold_pct, quote.validity_days);
  return quote;
}

export function acceptQuote(quote: P13Quote, body: { accepted_evidence_url?: string; accepted_by_contact?: string; dry_run?: boolean }, ctx: QuoteContext) {
  if (quote.status !== 'sent') throw new QuoteError(409, 'quote_invalid_transition');
  const today = saigonDate(ctx.now);
  if (quote.valid_until && isExpired(today, quote.valid_until)) throw new QuoteError(409, 'quote_expired');
  if (!body.accepted_evidence_url || !body.accepted_by_contact) {
    throw new QuoteError(422, 'quote_evidence_required', { field: 'accepted_evidence_url' });
  }
  if (body.dry_run) return quote;
  quote.status = 'accepted';
  quote.accepted_evidence_url = body.accepted_evidence_url;
  quote.accepted_by_contact = body.accepted_by_contact;
  return quote;
}

export function rejectQuote(quote: P13Quote, reason: string | null | undefined) {
  if (quote.status !== 'sent' && quote.status !== 'draft') throw new QuoteError(409, 'quote_invalid_transition');
  if (!reason?.trim()) throw new QuoteError(422, 'quote_evidence_required', { field: 'rejected_reason' });
  quote.status = 'rejected';
  quote.rejected_reason = reason.trim();
  quote.ever_left_draft = true;
  return quote;
}

export function expireQuote(quote: P13Quote, ctx: QuoteContext) {
  const today = saigonDate(ctx.now);
  if (!quote.valid_until || !isExpired(today, quote.valid_until)) throw new QuoteError(409, 'quote_invalid_transition');
  if (quote.status !== 'sent') throw new QuoteError(409, 'quote_invalid_transition');
  quote.status = 'expired';
  return quote;
}

export function newQuoteVersion(quote: P13Quote) {
  if (quote.status === 'draft' && !quote.ever_left_draft) throw new QuoteError(409, 'quote_invalid_transition');
  quote.version_n += 1;
  quote.status = 'draft';
  quote.p13_approval_status = 'none';
  quote.issued_at = null;
  quote.valid_until = null;
  quote.snapshot = null;
  quote.sent_evidence_url = null;
  quote.accepted_evidence_url = null;
  return quote;
}

function pdfInput(quote: P13Quote, ctx: QuoteContext, mode: 'draft' | 'final'): QuotePdfInput {
  const today = saigonDate(ctx.now);
  const issued = quote.issued_at ?? today;
  const days = quote.validity_days ?? ctx.settings.default_validity_days;
  const until = quote.valid_until ?? addCalendarDays(issued, days);
  if (!quote.calc?.totals) throw new QuoteError(409, 'pricing_params_incomplete', { missing: quote.calc?.missing ?? [] });
  return {
    mode,
    display_mode: quote.display_mode,
    quote_code: quote.quote_code,
    version_n: quote.version_n,
    issued_on: issued,
    issued_provisional: !quote.issued_at,
    validity_days: days,
    valid_until: until,
    client_name: quote.client_name,
    am_name: quote.am_name,
    company: {
      legal_name: ctx.company.legal_name.trim() || '—',
      tax_code: ctx.company.tax_code.trim() || '—',
      contact: ctx.company.contact.trim() || '—',
    },
    lines: quote.calc.lines,
    totals: quote.calc.totals,
    extra_discount_pct: quote.extra_discount_pct,
    payment_terms: quote.payment_terms,
    notes: [...(quote.calc.warnings ?? []), ...(quote.calc.blockers ?? [])],
  };
}

export async function exportQuotePdf(
  quote: P13Quote,
  body: { mode?: 'draft' | 'final'; display_mode?: QuotePdfInput['display_mode']; dry_run?: boolean },
  ctx: QuoteContext,
  actor: QuoteActor,
): Promise<{ buffer: Buffer | null; file_name: string; page_count: number; would_block: boolean; codes: string[] }> {
  const mode = body.mode ?? 'draft';
  if (body.display_mode) quote.display_mode = body.display_mode;
  const checks = quoteChecks(quote, ctx);
  const codes = [...checks.blockers];
  if (mode === 'final') {
    if (quote.needs_approval && quote.p13_approval_status !== 'approved') codes.push('quote_approval_required');
    if (checks.company_profile_incomplete) codes.push('company_profile_incomplete');
  }
  const unique = [...new Set(codes)];
  if (mode === 'final' && unique.length) {
    if (body.dry_run) {
      return { buffer: null, file_name: fileName(quote, quote.files.length + 1), page_count: 0, would_block: true, codes: unique };
    }
    throw new QuoteError(409, 'quote_export_blocked', { codes: unique });
  }
  const view = pdfInput(quote, ctx, mode);
  const buffer = await renderQuotePdf(view);
  const name = fileName(quote, quote.files.length + 1);
  if (body.dry_run) return { buffer, file_name: name, page_count: pageCount(buffer), would_block: false, codes: [] };
  if (mode === 'final' && !quote.issued_at) {
    const today = saigonDate(ctx.now);
    quote.issued_at = today;
    quote.valid_until = quote.validity_days == null ? null : addCalendarDays(today, quote.validity_days);
  }
  const hash = createHash('sha256').update(JSON.stringify({ lines: quote.lines, totals: quote.calc?.totals, mode, display: quote.display_mode })).digest('hex');
  quote.files.push({
    seq: quote.files.length + 1,
    kind: mode === 'final' ? 'quote_final' : 'quote_draft',
    file_name: name,
    renderer_version: PDF_RENDERER_VERSION,
    data_hash: hash,
    display_mode: quote.display_mode,
    exported_by: actor.email,
    exported_at: ctx.now.toISOString(),
    bytes: buffer,
  });
  return { buffer, file_name: name, page_count: pageCount(buffer), would_block: false, codes: [] };
}

function fileName(quote: P13Quote, seq: number): string {
  return `${quote.quote_code}-v${quote.version_n}-${seq}.pdf`;
}

function pageCount(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches?.length ?? 1;
}
