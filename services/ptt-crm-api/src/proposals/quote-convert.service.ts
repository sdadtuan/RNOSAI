import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from '../invoices/invoices.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { skuFromDvTier } from '../spc/spc-sku.util';
import { ProposalsPgRepository } from './proposals-pg.repository';
import { QT_QUOTE_QUERY, QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import { normalizeQuoteTier } from './quote-pricing.util';

export type QuoteConvertActor = {
  staffId: number;
  staffAuthVia?: 'internal' | 'jwt';
  idempotencyKey?: string;
};

export type QuoteConvertLifecycle = {
  line_id: number;
  lifecycle_id: number;
  dv_code: string;
};

export type QuoteConvertResult = {
  conversion_id: string;
  lifecycles: QuoteConvertLifecycle[];
  invoice_draft_ids: number[];
  optional_handoff: [];
};

const TARGET_LIFECYCLE = 'lifecycle_bundle';
const TARGET_INVOICE = 'invoice_schedule';

function bad(error: string): never {
  throw new BadRequestException({ error });
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function asPayload(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class QuoteConvertService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly repo: ProposalsPgRepository,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly invoices: InvoicesService,
  ) {}

  async convert(
    proposalId: number,
    vid: string,
    actor: QuoteConvertActor,
  ): Promise<QuoteConvertResult> {
    const key = String(actor.idempotencyKey ?? '').trim();
    if (!key) bad('idempotency_key_required');
    if (actor.staffAuthVia !== 'internal' && !(Number(actor.staffId) > 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }

    const proposal = await this.repo.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    if (proposal.status !== 'accepted') {
      throw new BadRequestException({ error: 'quote_not_accepted' });
    }

    return this.inTx(async (query) => {
      await query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`qt-convert:${vid}`]);

      const existing = await this.loadConversion(vid, TARGET_LIFECYCLE, query);
      if (existing) {
        const invoiceRow = await this.loadConversion(vid, TARGET_INVOICE, query);
        return this.replay(existing, invoiceRow);
      }

      const version = await this.loadVersion(vid, query);
      if (!version || Number(version.proposal_id) !== proposalId) {
        throw new NotFoundException({ error: 'version_not_found' });
      }

      const lines = await this.repo.listLines(proposalId);
      if (!lines.length) bad('quote_lines_required_for_accept');

      const lifecycles: QuoteConvertLifecycle[] = [];
      for (const line of lines) {
        if (line.lifecycle_id) {
          lifecycles.push({
            line_id: line.id,
            lifecycle_id: line.lifecycle_id,
            dv_code: line.dv_code,
          });
          continue;
        }
        const created = await this.lifecycle.create({
          customer_id: proposal.customer_id,
          service_slug: line.service_slug,
        });
        const note = `Quote #${proposalId} · ${line.dv_code} ${line.package_tier} · ${line.final_price_vnd.toLocaleString('vi-VN')} VND`;
        await this.repo.activateLifecycle(created.id, 'onboard', note);
        await this.repo.setLineLifecycle(line.id, created.id);
        const skuCode =
          line.sku_code?.trim() ||
          skuFromDvTier(line.dv_code, normalizeQuoteTier(line.package_tier) ?? 'standard');
        try {
          await this.lifecycle.setCommercialSku(created.id, skuCode);
        } catch {
          await this.repo.setLifecycleSkuCode(created.id, skuCode);
        }
        lifecycles.push({
          line_id: line.id,
          lifecycle_id: created.id,
          dv_code: line.dv_code,
        });
      }

      if (lifecycles.length === 1) {
        await this.repo.setProposalLifecycle(proposalId, lifecycles[0].lifecycle_id);
      }

      const invoiceDraftIds = await this.createInvoiceDrafts(
        proposal.customer_id,
        proposal.total_vnd,
        vid,
        query,
      );

      const result: QuoteConvertResult = {
        conversion_id: '',
        lifecycles,
        invoice_draft_ids: invoiceDraftIds,
        optional_handoff: [],
      };

      try {
        const bundle = await this.insertConversion(
          vid,
          TARGET_LIFECYCLE,
          String(lifecycles[0]?.lifecycle_id ?? ''),
          { ...result, idempotency_key: key },
          query,
        );
        result.conversion_id = String(bundle.id);
        await this.insertConversion(
          vid,
          TARGET_INVOICE,
          String(invoiceDraftIds[0] ?? ''),
          { invoice_draft_ids: invoiceDraftIds, idempotency_key: key },
          query,
        );
        return result;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const replayed = await this.loadConversion(vid, TARGET_LIFECYCLE, query);
        if (replayed) {
          const invoiceRow = await this.loadConversion(vid, TARGET_INVOICE, query);
          return this.replay(replayed, invoiceRow);
        }
        throw err;
      }
    });
  }

  private inTx<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) return this.db.withTransaction(fn);
    return fn((sql, params) => this.db.query(sql, params));
  }

  private async loadVersion(
    vid: string,
    query: QuoteQueryFn,
  ): Promise<{ id: string; proposal_id: number; payable_vnd: number } | null> {
    const result = await query(
      `SELECT id, proposal_id, payable_vnd
         FROM crm_quote_versions
        WHERE id::text = $1
        LIMIT 1`,
      [vid],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      proposal_id: Number(row.proposal_id),
      payable_vnd: Number(row.payable_vnd ?? 0),
    };
  }

  private async loadConversion(
    vid: string,
    targetType: string,
    query: QuoteQueryFn,
  ): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT id, version_id, target_type, target_id, payload_json
         FROM crm_quote_conversions
        WHERE version_id::text = $1 AND target_type = $2
        LIMIT 1`,
      [vid, targetType],
    );
    return result.rows[0] ?? null;
  }

  private replay(
    row: Record<string, unknown>,
    invoiceRow?: Record<string, unknown> | null,
  ): QuoteConvertResult {
    const payload = asPayload(row.payload_json);
    const invoicePayload = asPayload(invoiceRow?.payload_json);
    const lifecycles = Array.isArray(payload.lifecycles)
      ? (payload.lifecycles as QuoteConvertLifecycle[])
      : [];
    const invoiceDraftIds = this.idsFrom(
      payload.invoice_draft_ids ?? invoicePayload.invoice_draft_ids ?? invoiceRow?.target_id,
    );
    return {
      conversion_id: String(payload.conversion_id || row.id || ''),
      lifecycles,
      invoice_draft_ids: invoiceDraftIds,
      optional_handoff: [],
    };
  }

  private idsFrom(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    }
    const single = Number(value);
    return Number.isFinite(single) && single > 0 ? [single] : [];
  }

  private async insertConversion(
    vid: string,
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
    query: QuoteQueryFn,
  ): Promise<{ id: string }> {
    const result = await query(
      `INSERT INTO crm_quote_conversions (version_id, target_type, target_id, payload_json)
       VALUES ($1, $2, $3, $4)
       RETURNING id, version_id, target_type, target_id, payload_json`,
      [vid, targetType, targetId, payload],
    );
    const row = result.rows[0];
    if (!row) bad('conversion_insert_failed');
    return { id: String(row.id) };
  }

  private async createInvoiceDrafts(
    customerId: number,
    fallbackAmount: number,
    vid: string,
    query: QuoteQueryFn,
  ): Promise<number[]> {
    const existingConv = await this.loadConversion(vid, TARGET_INVOICE, query);
    if (existingConv) {
      const fromPayload = this.idsFrom(
        asPayload(existingConv.payload_json).invoice_draft_ids ?? existingConv.target_id,
      );
      if (fromPayload.length) return fromPayload;
    }
    const existingDrafts = await query(
      `SELECT id FROM crm_invoices WHERE notes = $1 ORDER BY id ASC`,
      [`Quote convert ${vid}`],
    );
    const reused = existingDrafts.rows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (reused.length) return reused;

    const payments = await query(
      `SELECT id, seq, pct_bps, amount_vnd, milestone
         FROM crm_quote_payment_schedules
        WHERE version_id::text = $1
        ORDER BY seq ASC`,
      [vid],
    );
    const amounts =
      payments.rows.length > 0
        ? payments.rows.map((row) => Math.max(0, Number(row.amount_vnd ?? 0)))
        : [Math.max(0, Number(fallbackAmount ?? 0))];
    const ids: number[] = [];
    for (const amount of amounts) {
      if (this.invoices?.create) {
        const created = await this.invoices.create({
          customer_id: customerId,
          amount_vnd: amount,
          notes: `Quote convert ${vid}`,
        });
        ids.push(Number(created.invoice.id));
        continue;
      }
      const inserted = await query(
        `INSERT INTO crm_invoices (customer_id, status, amount_vnd, paid_vnd, notes, invoice_number)
         VALUES ($1, 'draft', $2, 0, $3, '')
         RETURNING id`,
        [customerId, amount, `Quote convert ${vid}`],
      );
      ids.push(Number(inserted.rows[0]?.id ?? 0));
    }
    return ids.filter((id) => Number.isFinite(id) && id > 0);
  }
}
