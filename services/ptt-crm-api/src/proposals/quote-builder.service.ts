import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuoteCatalogService } from './quote-catalog.service';
import { allocatePayment, calcGmBps, calcNsr, calcPayable } from './quote-money.util';
import { normalizeQuoteTier, resolveProductTierPricing } from './quote-pricing.util';
import type { PutQuoteLinesBody, QuoteLineInput } from './proposals.types';
import {
  QuoteBuilderLineRow,
  QuoteBuilderLineWrite,
  QuoteHeaderPatch,
  QuoteProposalHeader,
  QuoteVersionDiff,
  QuoteVersionRow,
  QuoteVersionsRepository,
} from './quote-versions.repository';

const REVISION_PARENT_STATUSES = new Set(['approved', 'sent', 'viewed', 'negotiation']);

export type QuoteBuilderActor = {
  staffId: number;
  staffAuthVia?: 'internal' | 'jwt';
  hasFinance: boolean;
  includeFinance?: boolean;
};

export type QuotePaymentItemInput = {
  pct_bps: number;
  milestone?: string;
  seq?: number;
};

export type QuoteBuilderLineResult = Record<string, unknown> & {
  package_tier: string;
  item_type?: string;
  catalog_snapshot_json: Record<string, unknown> & {
    rate?: { suggested_vnd?: number };
  };
  cost_labor_vnd?: number | null;
  cost_outsource_vnd?: number | null;
  cost_other_vnd?: number | null;
};

export type QuoteBuilderLinesResult = {
  proposal_id: number;
  lines: QuoteBuilderLineResult[];
  flags?: { cost_missing: boolean };
};

export type QuoteRecalcResult = {
  proposal_id: number;
  version_id: string;
  fee_vnd: number;
  media_vnd: number;
  discount_vnd: number;
  tax_vnd: number;
  payable_vnd: number;
  nsr_vnd?: number;
  direct_cost_vnd?: number | null;
  gm_bps?: number | null;
  cost_labor_vnd?: number | null;
  cost_outsource_vnd?: number | null;
  cost_other_vnd?: number | null;
  flags?: { cost_missing: boolean };
  payments: Array<{ amount_vnd: number; pct_bps: number; milestone: string }>;
  snapshot: {
    lines: Array<{
      catalog_snapshot_json: { rate?: { suggested_vnd?: number } };
    }>;
  };
};

const QT_LINE_KEYS = [
  'item_type',
  'media_vnd',
  'client_visible',
  'catalog_snapshot_json',
  'qty',
] as const;

export function hasQtLineFields(line: QuoteLineInput | null | undefined): boolean {
  if (!line) return false;
  return QT_LINE_KEYS.some((key) => line[key] != null);
}

export function isQuoteBuilderTarget(
  proposal: { quote_code?: string | null; current_version_id?: string | null } | null | undefined,
  body: PutQuoteLinesBody,
): boolean {
  if (proposal?.quote_code || proposal?.current_version_id) return true;
  return (body.lines ?? []).some((line) => hasQtLineFields(line));
}

export function isQuoteHeaderComplete(header: {
  title?: string | null;
  agency_client_id?: string | null;
  customer_id?: number | null;
  objective?: string | null;
  audience?: string | null;
  campaign_period?: string | null;
}): boolean {
  const title = String(header.title ?? '').trim();
  const objective = String(header.objective ?? '').trim();
  const audience = String(header.audience ?? '').trim();
  const period = String(header.campaign_period ?? '').trim();
  const client = String(header.agency_client_id ?? '').trim();
  const customerId = Number(header.customer_id ?? 0);
  return Boolean(title && objective && audience && period && (client || customerId > 0));
}

export function parsePaymentTemplate(template: string): number[] {
  const parts = String(template ?? '')
    .split('/')
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.map((n) => (n <= 100 ? Math.round(n * 100) : Math.round(n)));
}

function bad(error: string, extra?: Record<string, unknown>): never {
  throw new BadRequestException({ error, ...extra });
}

function isQuoteOsProposal(proposal: {
  quote_code?: string | null;
  current_version_id?: string | null;
}): boolean {
  return Boolean(proposal.quote_code || proposal.current_version_id);
}

function normalizeItemType(value: unknown): 'fee' | 'media' | 'pass_through' {
  const raw = String(value ?? 'fee').trim().toLowerCase();
  if (raw === 'media') return 'media';
  if (raw === 'pass_through') return 'pass_through';
  return 'fee';
}

function asInt(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyOf(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (value == null || value === '') return 0n;
  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}

function catalogStatus(row: { status?: string; active?: boolean } | null): string {
  const status = String(row?.status ?? '').trim().toLowerCase();
  if (status) return status;
  return row?.active === false ? 'draft' : 'active';
}

function snapshotRate(snap: Record<string, unknown>): {
  min_vnd: number | null;
  max_vnd: number | null;
  suggested_vnd: number | null;
} {
  const rate = (snap.rate ?? snap) as Record<string, unknown>;
  const suggested = rate.suggested_vnd ?? rate.price_vnd;
  return {
    min_vnd: rate.min_vnd == null ? null : asInt(rate.min_vnd),
    max_vnd: rate.max_vnd == null ? null : asInt(rate.max_vnd),
    suggested_vnd: suggested == null ? null : asInt(suggested),
  };
}

function readCatalogCost(tier: Record<string, unknown> | null): {
  labor: number | null;
  outsource: number | null;
  other: number | null;
  missing: boolean;
} {
  if (!tier) return { labor: null, outsource: null, other: null, missing: true };
  const laborRaw = tier.cost_labor_vnd ?? tier.labor_vnd ?? tier.cost_vnd ?? tier.direct_cost_vnd;
  const outRaw = tier.cost_outsource_vnd ?? tier.outsource_vnd;
  const otherRaw = tier.cost_other_vnd ?? tier.other_vnd;
  const labor = laborRaw == null || laborRaw === '' ? null : asInt(laborRaw);
  const outsource = outRaw == null || outRaw === '' ? null : asInt(outRaw);
  const other = otherRaw == null || otherRaw === '' ? null : asInt(otherRaw);
  const has = (labor != null && labor > 0) || (outsource != null && outsource > 0) || (other != null && other > 0);
  return {
    labor: has ? labor : null,
    outsource: has ? outsource : null,
    other: has ? other : null,
    missing: !has,
  };
}

function lineHasCostFields(line: QuoteLineInput): boolean {
  return (
    line.cost_labor_vnd != null || line.cost_outsource_vnd != null || line.cost_other_vnd != null
  );
}

function stripFinance<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  delete out.cost_labor_vnd;
  delete out.cost_outsource_vnd;
  delete out.cost_other_vnd;
  delete out.direct_cost_vnd;
  delete out.gm_bps;
  delete out.nsr_vnd;
  delete out.flags;
  const snapshot = (out as Record<string, unknown>).snapshot;
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const snap = { ...(snapshot as Record<string, unknown>) };
    const lines = Array.isArray(snap.lines)
      ? (snap.lines as Record<string, unknown>[]).map((line) => {
          const next = { ...line };
          delete next.cost_labor_vnd;
          delete next.cost_outsource_vnd;
          delete next.cost_other_vnd;
          return next;
        })
      : snap.lines;
    (out as Record<string, unknown>).snapshot = { ...snap, lines };
  }
  return out;
}

@Injectable()
export class QuoteBuilderService {
  constructor(
    private readonly versions: QuoteVersionsRepository,
    private readonly audit: QuoteAuditRepository,
    @Optional() private readonly catalog?: QuoteCatalogService,
  ) {}

  async patchHeader(
    proposalId: number,
    patch: QuoteHeaderPatch,
    ifMatch: string | undefined,
    actor: QuoteBuilderActor,
  ) {
    this.assertStaff(actor);
    const current = await this.requireWritableProposal(proposalId);
    const expected = this.parseIfMatch(ifMatch);
    const updated = await this.versions.updateHeader(proposalId, patch, expected);
    if (!updated) {
      throw new ConflictException({
        error: 'row_version_conflict',
        row_version: current.row_version,
      });
    }
    await this.audit.insert({
      proposal_id: proposalId,
      version_id: updated.current_version_id,
      actor_staff_id: actor.staffId || null,
      action: 'quote.header_patched',
      resource: 'quote',
      snapshot_json: { row_version: updated.row_version },
    });
    return updated;
  }

  async putLines(
    proposalId: number,
    body: PutQuoteLinesBody,
    actor: QuoteBuilderActor,
  ): Promise<QuoteBuilderLinesResult> {
    this.assertStaff(actor);
    if (actor.hasFinance !== true && (body.lines ?? []).some(lineHasCostFields)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_quote.finance' });
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) bad('lines_required');
    const proposal = await this.requireWritableProposal(proposalId, { critical: true });
    return this.versions.withTransaction(async (query) => {
      const version =
        (proposal.current_version_id
          ? await this.versions.getVersion(proposal.current_version_id, query)
          : null) ??
        (await this.versions.createWorkingVersion(proposalId, actor.staffId || 0, query));
      this.assertMutableVersion(version, { critical: true });

      const writes: QuoteBuilderLineWrite[] = [];
      let costMissing = false;
      for (const input of body.lines) {
        const resolved = await this.resolveQtLine(input, actor);
        if (resolved.cost_labor_vnd == null && resolved.cost_outsource_vnd == null && resolved.cost_other_vnd == null) {
          costMissing = true;
        }
        writes.push(resolved);
      }
      const lines = await this.versions.replaceLines(proposalId, writes, query);
      await this.audit.insert(
        {
          proposal_id: proposalId,
          version_id: version.id,
          actor_staff_id: actor.staffId || null,
          action: 'quote.lines_replaced',
          resource: 'quote_lines',
          snapshot_json: { line_count: lines.length },
        },
        query,
      );
      return this.presentLines(proposalId, lines, { cost_missing: costMissing }, actor);
    });
  }

  async recalculate(
    proposalId: number,
    vid: string,
    actor: QuoteBuilderActor,
  ): Promise<QuoteRecalcResult> {
    this.assertStaff(actor);
    if (actor.includeFinance && !actor.hasFinance) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_quote.finance' });
    }
    const proposal = await this.requireWritableProposal(proposalId);
    const version = await this.versions.getVersion(vid);
    if (!version || version.proposal_id !== proposalId) {
      throw new NotFoundException({ error: 'version_not_found' });
    }
    this.assertWorkingVersion(version);
    if (!isQuoteHeaderComplete(proposal)) bad('header_incomplete');

    const lines = await this.versions.listLines(proposalId);
    if (!lines.some((line) => line.client_visible)) bad('client_visible_line_required');
    if (lines.some((line) => line.client_visible && this.lineIsDraft(line))) {
      bad('catalog_not_active');
    }

    const settings = await this.versions.loadSettings();
    const money = this.computeMoney(lines, settings.vat_bps);
    let payments = await this.versions.listPayments(vid);
    let pct = payments.map((p) => p.pct_bps);
    if (!pct.length) pct = parsePaymentTemplate(settings.payment_template);
    if (pct.reduce((sum, n) => sum + n, 0) !== 10000) bad('payment_pct_invalid');

    const amounts = allocatePayment(money.payableVnd, pct);
    const paymentRows = pct.map((bps, index) => ({
      seq: index + 1,
      pct_bps: bps,
      amount_vnd: amounts[index] ?? 0n,
      milestone: payments[index]?.milestone || `Đợt ${index + 1}`,
    }));
    const snapshot = {
      vat_bps: settings.vat_bps,
      lines: lines.map((line) => ({
        id: line.id,
        dv_code: line.dv_code,
        package_tier: line.package_tier,
        item_type: line.item_type,
        qty: line.qty,
        unit_price_vnd: line.unit_price_vnd,
        final_price_vnd: line.final_price_vnd,
        discount_vnd: line.discount_vnd,
        tax_vnd: line.tax_vnd,
        cost_labor_vnd: line.cost_labor_vnd,
        cost_outsource_vnd: line.cost_outsource_vnd,
        cost_other_vnd: line.cost_other_vnd,
        scope_notes: line.scope_notes,
        media_amount_vnd: line.media_amount_vnd,
        client_visible: line.client_visible,
        catalog_snapshot_json: line.catalog_snapshot_json,
      })),
      money: {
        fee_vnd: Number(money.feeVnd),
        media_vnd: Number(money.mediaVnd),
        discount_vnd: Number(money.discountVnd),
        tax_vnd: Number(money.taxVnd),
        payable_vnd: Number(money.payableVnd),
        nsr_vnd: Number(money.nsrVnd),
        direct_cost_vnd: money.directCostVnd == null ? null : Number(money.directCostVnd),
        gm_bps: money.gmBps,
      },
    };
    payments = await this.versions.withTransaction(async (query) => {
      const saved = await this.versions.replacePayments(vid, paymentRows, query);
      await this.versions.updateTotals(
        vid,
        {
          fee_vnd: money.feeVnd,
          media_vnd: money.mediaVnd,
          discount_vnd: money.discountVnd,
          tax_vnd: money.taxVnd,
          payable_vnd: money.payableVnd,
          nsr_vnd: money.nsrVnd,
          direct_cost_vnd: money.directCostVnd,
          gm_bps: money.gmBps,
        },
        snapshot,
        query,
      );
      await this.versions.setProposalPayable(proposalId, money.payableVnd, query);
      await this.audit.insert(
        {
          proposal_id: proposalId,
          version_id: vid,
          actor_staff_id: actor.staffId || null,
          action: 'quote.recalculated',
          resource: 'quote_version',
          snapshot_json: { payable_vnd: Number(money.payableVnd) },
        },
        query,
      );
      return saved;
    });

    const out: Record<string, unknown> = {
      proposal_id: proposalId,
      version_id: vid,
      fee_vnd: Number(money.feeVnd),
      media_vnd: Number(money.mediaVnd),
      discount_vnd: Number(money.discountVnd),
      tax_vnd: Number(money.taxVnd),
      payable_vnd: Number(money.payableVnd),
      nsr_vnd: Number(money.nsrVnd),
      direct_cost_vnd: money.directCostVnd == null ? null : Number(money.directCostVnd),
      gm_bps: money.gmBps,
      cost_labor_vnd: money.costLaborVnd,
      cost_outsource_vnd: money.costOutsourceVnd,
      cost_other_vnd: money.costOtherVnd,
      flags: { cost_missing: money.costMissing },
      payments,
      snapshot,
    };
    return (actor.hasFinance ? out : stripFinance(out)) as QuoteRecalcResult;
  }

  async createRevision(proposalId: number, actor: QuoteBuilderActor): Promise<QuoteVersionRow> {
    this.assertStaff(actor);
    const proposal = await this.requireQuoteProposal(proposalId);
    const created = await this.versions.createNextWorkingVersion(proposalId, actor.staffId || 0);
    await this.audit.insert({
      proposal_id: proposalId,
      version_id: created.id,
      actor_staff_id: actor.staffId || null,
      action: 'quote.version_created',
      resource: 'quote_version',
      snapshot_json: { n: created.n, from_version_id: proposal.current_version_id },
    });
    return created;
  }

  async diffVersions(
    proposalId: number,
    fromN: number,
    toN: number,
  ): Promise<{ items: QuoteVersionDiff[]; from_n: number; to_n: number }> {
    await this.requireQuoteProposal(proposalId);
    try {
      const items = await this.versions.compareVersions(proposalId, fromN, toN);
      return { items, from_n: fromN, to_n: toN };
    } catch (err) {
      if (err instanceof Error && err.message === 'version_not_found') {
        throw new NotFoundException({ error: 'version_not_found' });
      }
      throw err;
    }
  }

  async putPayments(
    vid: string,
    body: { items?: QuotePaymentItemInput[] },
    actor: QuoteBuilderActor,
  ) {
    this.assertStaff(actor);
    const items = body.items ?? [];
    if (!items.length) bad('payments_required');
    const pct = items.map((item) => asInt(item.pct_bps));
    if (pct.reduce((sum, n) => sum + n, 0) !== 10000) bad('payment_pct_invalid');

    const version = await this.versions.getVersion(vid);
    if (!version) throw new NotFoundException({ error: 'version_not_found' });
    await this.requireWritableProposal(version.proposal_id, { critical: true });
    this.assertMutableVersion(version, { critical: true });
    const settings = await this.versions.loadSettings();
    const lines = await this.versions.listLines(version.proposal_id);
    const money = this.computeMoney(lines, settings.vat_bps);
    const payable = money.payableVnd > 0n ? money.payableVnd : moneyOf(version.payable_vnd);
    const amounts = allocatePayment(payable, pct);
    const rows = items.map((item, index) => ({
      seq: item.seq ?? index + 1,
      pct_bps: pct[index],
      amount_vnd: amounts[index] ?? 0n,
      milestone: String(item.milestone ?? `Đợt ${index + 1}`),
    }));
    const saved = await this.versions.replacePayments(vid, rows);
    await this.audit.insert({
      proposal_id: version.proposal_id,
      version_id: vid,
      actor_staff_id: actor.staffId || null,
      action: 'quote.payments_replaced',
      resource: 'quote_payments',
      snapshot_json: { pct_bps: pct },
    });
    return { version_id: vid, items: saved };
  }

  private async resolveQtLine(
    input: QuoteLineInput,
    _actor: QuoteBuilderActor,
  ): Promise<QuoteBuilderLineWrite> {
    const dvCode = String(input.dv_code ?? '').trim().toUpperCase();
    if (!dvCode) bad('dv_or_sku_required');
    const tier = normalizeQuoteTier(String(input.package_tier ?? 'standard'));
    if (!tier) bad('invalid_package_tier', { tier: input.package_tier });
    const clientVisible = input.client_visible !== false;
    const itemType = normalizeItemType(input.item_type);

    const existingSnap =
      input.catalog_snapshot_json && typeof input.catalog_snapshot_json === 'object'
        ? input.catalog_snapshot_json
        : null;
    const catalog = await this.versions.loadCatalog(dvCode);
    const liveStatus = catalogStatus(catalog);
    if (clientVisible && liveStatus === 'draft') bad('catalog_not_active');

    const snapStatus = existingSnap ? catalogStatus(existingSnap) : liveStatus;
    if (clientVisible && snapStatus === 'draft') bad('catalog_not_active');

    const tierPricing = catalog?.tier_pricing ?? {};
    const existingRate = existingSnap ? snapshotRate(existingSnap) : null;
    let liveRate: {
      min_vnd: number | null;
      max_vnd: number | null;
      suggested_vnd: number;
      rate_card_id?: string | null;
    } | null = null;
    if (!existingRate && this.catalog) {
      const resolved = await this.catalog.resolveRate(dvCode, tier);
      liveRate = {
        min_vnd: resolved.min_vnd,
        max_vnd: resolved.max_vnd,
        suggested_vnd: resolved.suggested_vnd,
        rate_card_id: resolved.rate_card_id,
      };
    }
    const priced =
      existingRate?.suggested_vnd && existingRate.suggested_vnd > 0
        ? {
            min_vnd: existingRate.min_vnd,
            max_vnd: existingRate.max_vnd,
            suggested_vnd: existingRate.suggested_vnd,
            rate_missing: false,
          }
        : liveRate
          ? {
              min_vnd: liveRate.min_vnd,
              max_vnd: liveRate.max_vnd,
              suggested_vnd: liveRate.suggested_vnd,
              rate_missing: false,
            }
          : resolveProductTierPricing(tierPricing, tier);
    if (priced.rate_missing || !priced.suggested_vnd) bad('rate_missing', { dv_code: dvCode, tier });

    const qty = Number(input.qty ?? 1) > 0 ? Number(input.qty ?? 1) : 1;
    const unitPrice =
      input.unit_price_vnd != null && Number.isFinite(Number(input.unit_price_vnd))
        ? Math.max(0, Math.round(Number(input.unit_price_vnd)))
        : priced.suggested_vnd;
    const discount = Math.max(0, Math.round(Number(input.discount_vnd ?? 0)));
    const finalPrice =
      input.final_price_vnd != null && Number.isFinite(Number(input.final_price_vnd))
        ? Math.max(0, Math.round(Number(input.final_price_vnd)))
        : Math.max(0, Math.round(qty * unitPrice) - discount);
    const mediaAmount =
      itemType === 'media'
        ? Math.max(0, Math.round(Number(input.media_vnd ?? finalPrice)))
        : Math.max(0, Math.round(Number(input.media_vnd ?? 0)));

    const rawTier = (tierPricing[tier] ??
      tierPricing.TieuChuan ??
      tierPricing.standard ??
      {}) as Record<string, unknown>;
    const snapCost = existingSnap
      ? readCatalogCost((existingSnap.cost as Record<string, unknown>) ?? existingSnap)
      : readCatalogCost(rawTier);
    const bodyCost = {
      labor: input.cost_labor_vnd == null ? snapCost.labor : asInt(input.cost_labor_vnd),
      outsource: input.cost_outsource_vnd == null ? snapCost.outsource : asInt(input.cost_outsource_vnd),
      other: input.cost_other_vnd == null ? snapCost.other : asInt(input.cost_other_vnd),
    };
    const costMissing =
      (bodyCost.labor == null || bodyCost.labor <= 0) &&
      (bodyCost.outsource == null || bodyCost.outsource <= 0) &&
      (bodyCost.other == null || bodyCost.other <= 0);

    const snapshot = existingSnap ?? {
      dv_code: dvCode,
      package_tier: tier,
      catalog_status: liveStatus,
      quoted_at: new Date().toISOString(),
      rate: {
        min_vnd: priced.min_vnd,
        max_vnd: priced.max_vnd,
        suggested_vnd: priced.suggested_vnd,
        ...(liveRate?.rate_card_id ? { rate_card_id: liveRate.rate_card_id } : {}),
      },
      cost: costMissing
        ? { labor_vnd: null, outsource_vnd: null, other_vnd: null }
        : {
            labor_vnd: bodyCost.labor,
            outsource_vnd: bodyCost.outsource,
            other_vnd: bodyCost.other,
          },
    };

    return {
      dv_code: dvCode,
      sku_code: input.sku_code?.trim() || `${dvCode}-${tier === 'basic' ? 'CB' : tier === 'premium' ? 'CS' : 'TC'}`,
      package_tier: tier,
      service_slug: catalog?.service_slug || catalog?.slug || dvCode.toLowerCase(),
      reference_price_min: priced.min_vnd ?? priced.suggested_vnd ?? 0,
      reference_price_max: priced.max_vnd ?? priced.suggested_vnd ?? 0,
      final_price_vnd: itemType === 'media' ? mediaAmount : finalPrice,
      scope_notes: String(input.scope_notes ?? ''),
      item_type: itemType,
      qty,
      unit_price_vnd: unitPrice,
      discount_vnd: discount,
      media_amount_vnd: mediaAmount,
      tax_vnd: 0,
      cost_labor_vnd: costMissing ? null : bodyCost.labor,
      cost_outsource_vnd: costMissing ? null : bodyCost.outsource,
      cost_other_vnd: costMissing ? null : bodyCost.other,
      client_visible: clientVisible,
      catalog_snapshot_json: snapshot,
    };
  }

  private computeMoney(lines: QuoteBuilderLineRow[], vatBps: number) {
    const feeLines = lines.filter((line) => normalizeItemType(line.item_type) === 'fee');
    const mediaLines = lines.filter((line) => normalizeItemType(line.item_type) === 'media');
    const passThroughLines = lines.filter(
      (line) => normalizeItemType(line.item_type) === 'pass_through',
    );
    const feeVnd = feeLines.reduce((sum, line) => sum + moneyOf(line.final_price_vnd), 0n);
    const mediaVnd = mediaLines.reduce(
      (sum, line) => sum + moneyOf(line.media_amount_vnd || line.final_price_vnd),
      0n,
    );
    const passThroughVnd = passThroughLines.reduce(
      (sum, line) => sum + moneyOf(line.final_price_vnd),
      0n,
    );
    const discountVnd = 0n;
    const { taxVnd, payableVnd } = calcPayable({
      feeVnd: feeVnd + passThroughVnd,
      mediaVnd,
      discountVnd,
      vatBps,
    });
    const nsrVnd = calcNsr(
      lines.map((line) => ({
        itemType: normalizeItemType(line.item_type),
        netVnd: moneyOf(
          normalizeItemType(line.item_type) === 'fee' ? line.final_price_vnd : 0,
        ),
      })),
    );
    let costLabor: number | null = 0;
    let costOut: number | null = 0;
    let costOther: number | null = 0;
    let sawCost = false;
    let missing = false;
    for (const line of feeLines) {
      const labor = line.cost_labor_vnd;
      const out = line.cost_outsource_vnd;
      const other = line.cost_other_vnd;
      if (labor == null && out == null && other == null) {
        missing = true;
        continue;
      }
      sawCost = true;
      costLabor = (costLabor ?? 0) + (labor ?? 0);
      costOut = (costOut ?? 0) + (out ?? 0);
      costOther = (costOther ?? 0) + (other ?? 0);
    }
    if (!sawCost) {
      costLabor = null;
      costOut = null;
      costOther = null;
      missing = feeLines.length > 0;
    }
    const direct =
      missing || !sawCost
        ? null
        : moneyOf((costLabor ?? 0) + (costOut ?? 0) + (costOther ?? 0));
    const gmBps = nsrVnd === 0n || direct == null ? null : calcGmBps(nsrVnd, direct);
    return {
      feeVnd,
      mediaVnd,
      discountVnd,
      taxVnd,
      payableVnd,
      nsrVnd,
      directCostVnd: direct,
      gmBps,
      costLaborVnd: costLabor,
      costOutsourceVnd: costOut,
      costOtherVnd: costOther,
      costMissing: missing || !sawCost,
    };
  }

  private lineIsDraft(line: QuoteBuilderLineRow): boolean {
    return catalogStatus(line.catalog_snapshot_json) === 'draft';
  }

  private presentLines(
    proposalId: number,
    lines: QuoteBuilderLineRow[],
    flags: { cost_missing: boolean },
    actor: QuoteBuilderActor,
  ) {
    const mapped = lines.map((line) => {
      const row: Record<string, unknown> = { ...line };
      if (!actor.hasFinance) return stripFinance(row);
      return row;
    });
    const out: Record<string, unknown> = {
      proposal_id: proposalId,
      lines: mapped,
      flags,
    };
    return (actor.hasFinance ? out : stripFinance(out)) as QuoteBuilderLinesResult;
  }

  private async requireQuoteProposal(id: number): Promise<QuoteProposalHeader> {
    const proposal = await this.versions.getProposal(id);
    if (!proposal) throw new NotFoundException({ error: 'quote_not_found' });
    if (!isQuoteOsProposal(proposal)) {
      throw new NotFoundException({ error: 'not_a_quote' });
    }
    if (proposal.archived_at) {
      throw new ConflictException({ error: 'quote_archived' });
    }
    return proposal;
  }

  private async requireWritableProposal(
    id: number,
    opts?: { critical?: boolean },
  ): Promise<QuoteProposalHeader> {
    const proposal = await this.requireQuoteProposal(id);
    const version = proposal.current_version_id
      ? await this.versions.getVersion(proposal.current_version_id)
      : null;
    const status = String(proposal.status ?? '').trim().toLowerCase();
    const state = String(version?.state ?? '').trim().toLowerCase();
    if (opts?.critical && (state === 'approved' || state === 'published')) {
      throw new ConflictException({ error: 'revision_required' });
    }
    if (state === 'working' && (status === 'draft' || REVISION_PARENT_STATUSES.has(status))) {
      return proposal;
    }
    if (!version && status === 'draft') return proposal;
    if (status !== 'draft') {
      throw new ConflictException({ error: 'quote_not_draft' });
    }
    return proposal;
  }

  private assertWorkingVersion(version: { state?: string } | null): void {
    if (!version || String(version.state ?? '').trim().toLowerCase() !== 'working') {
      throw new ConflictException({ error: 'version_not_working' });
    }
  }

  private assertMutableVersion(
    version: { state?: string } | null,
    opts?: { critical?: boolean },
  ): void {
    const state = String(version?.state ?? '').trim().toLowerCase();
    if (state === 'working') return;
    if (opts?.critical && (state === 'approved' || state === 'published')) {
      throw new ConflictException({ error: 'revision_required' });
    }
    throw new ConflictException({ error: 'version_not_working' });
  }

  private assertStaff(actor: QuoteBuilderActor): void {
    if (actor.staffAuthVia === 'internal') return;
    if (!(Number(actor.staffId) > 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
  }

  private parseIfMatch(ifMatch: string | undefined): number {
    const raw = String(ifMatch ?? '').trim();
    if (!raw) bad('if_match_required');
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) bad('if_match_required');
    return n;
  }
}
