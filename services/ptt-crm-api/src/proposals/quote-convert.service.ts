import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { CpProjectsService } from '../cp/cp-projects.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { skuFromDvTier } from '../spc/spc-sku.util';
import { VdProjectService } from '../video-sop/project/vd-project.service';
import { ProposalsPgRepository } from './proposals-pg.repository';
import { QT_QUOTE_QUERY, QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import { VID_TPL_01 } from './quote-catalog.service';
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

export type QuoteConvertHandoff = {
  vd_project_id?: number;
  template_key?: string;
  cp_project_id?: string;
};

export type QuoteConvertResult = {
  conversion_id: string;
  lifecycles: QuoteConvertLifecycle[];
  invoice_draft_ids: number[];
  optional_handoff: QuoteConvertHandoff[];
};

const VIDEO_KINDS = new Set(['human_video', 'brand_film']);

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
    @Optional() private readonly vdProjects?: VdProjectService,
    @Optional() private readonly cpProjects?: CpProjectsService,
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

      const lines = await this.repo.listLines(proposalId, { quoteOs: true });
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

      const optionalHandoff = (await this.isHandoffVideo(query))
        ? await this.buildVideoHandoff({
            proposalId,
            proposal,
            vid,
            actor,
            lines,
            lifecycles,
            snapshot: version.snapshot_json,
          })
        : [];

      const result: QuoteConvertResult = {
        conversion_id: '',
        lifecycles,
        invoice_draft_ids: invoiceDraftIds,
        optional_handoff: optionalHandoff,
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
  ): Promise<{
    id: string;
    proposal_id: number;
    payable_vnd: number;
    snapshot_json: Record<string, unknown>;
  } | null> {
    const result = await query(
      `SELECT id, proposal_id, payable_vnd, snapshot_json
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
      snapshot_json: asPayload(row.snapshot_json),
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
      optional_handoff: this.handoffsFrom(payload.optional_handoff),
    };
  }

  private handoffsFrom(value: unknown): QuoteConvertHandoff[] {
    if (!Array.isArray(value)) return [];
    const out: QuoteConvertHandoff[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const handoff: QuoteConvertHandoff = {};
      const vdId = Number(rec.vd_project_id);
      if (Number.isFinite(vdId) && vdId > 0) handoff.vd_project_id = vdId;
      const template = String(rec.template_key ?? '').trim();
      if (template) handoff.template_key = template;
      const cpId = rec.cp_project_id == null ? '' : String(rec.cp_project_id).trim();
      if (cpId) handoff.cp_project_id = cpId;
      if (handoff.vd_project_id || handoff.cp_project_id || handoff.template_key) {
        out.push(handoff);
      }
    }
    return out;
  }

  private async isHandoffVideo(query: QuoteQueryFn): Promise<boolean> {
    try {
      await query(
        `ALTER TABLE crm_quote_settings
           ADD COLUMN IF NOT EXISTS handoff_video BOOLEAN NOT NULL DEFAULT FALSE`,
      );
    } catch {
      /* missing table or insufficient DDL — fall through to read */
    }
    try {
      const result = await query(
        `SELECT handoff_video, policy_json FROM crm_quote_settings LIMIT 1`,
      );
      const row = result.rows[0];
      if (!row) return false;
      if (row.handoff_video === true || row.handoff_video === 't' || row.handoff_video === 'true') {
        return true;
      }
      const policy = asPayload(row.policy_json);
      return policy.handoff_video === true || policy.handoff_video === 't';
    } catch {
      return false;
    }
  }

  private lineKind(
    line: { id: number; catalog_snapshot_json?: Record<string, unknown> },
    snapshot: Record<string, unknown>,
  ): string {
    const fromLine = asPayload(line.catalog_snapshot_json).kind;
    if (typeof fromLine === 'string' && fromLine.trim()) return fromLine.trim();
    const rows = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    const match = rows.find((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const rec = row as Record<string, unknown>;
      return Number(rec.id ?? rec.line_id) === Number(line.id);
    }) as Record<string, unknown> | undefined;
    const nested = asPayload(match?.catalog_snapshot_json);
    const kind = match?.kind ?? nested.kind;
    return typeof kind === 'string' ? kind.trim() : '';
  }

  private async buildVideoHandoff(input: {
    proposalId: number;
    proposal: { agency_client_id?: string | null };
    vid: string;
    actor: QuoteConvertActor;
    lines: Array<{
      id: number;
      dv_code: string;
      catalog_snapshot_json?: Record<string, unknown>;
    }>;
    lifecycles: QuoteConvertLifecycle[];
    snapshot: Record<string, unknown>;
  }): Promise<QuoteConvertHandoff[]> {
    const out: QuoteConvertHandoff[] = [];
    for (const created of input.lifecycles) {
      const line = input.lines.find((row) => row.id === created.line_id);
      const kind = line ? this.lineKind(line, input.snapshot) : '';
      const production =
        created.dv_code === 'DV12' || VIDEO_KINDS.has(kind);
      const aiVideo = kind === 'ai_video';
      if (!production && !aiVideo) continue;

      const handoff: QuoteConvertHandoff = {};
      if (production && this.vdProjects) {
        const project = await this.linkOrCreateVdProject({
          proposalId: input.proposalId,
          clientId: input.proposal.agency_client_id,
          vid: input.vid,
          lineId: created.line_id,
          lifecycleId: created.lifecycle_id,
          dvCode: created.dv_code,
        });
        if (project) {
          handoff.vd_project_id = project.id;
          handoff.template_key = VID_TPL_01;
        }
      }
      if (aiVideo) {
        const cpId = await this.optionalCpProject({
          proposalId: input.proposalId,
          clientId: input.proposal.agency_client_id,
          actor: input.actor,
          lifecycleId: created.lifecycle_id,
          dvCode: created.dv_code,
        });
        if (cpId) handoff.cp_project_id = cpId;
      }
      if (handoff.vd_project_id || handoff.cp_project_id) out.push(handoff);
    }
    return out;
  }

  private async linkOrCreateVdProject(input: {
    proposalId: number;
    clientId?: string | null;
    vid: string;
    lineId: number;
    lifecycleId: number;
    dvCode: string;
  }): Promise<{ id: number } | null> {
    if (!this.vdProjects) return null;
    const existing = await this.vdProjects.listByLifecycle(input.lifecycleId);
    if (existing[0]) return { id: existing[0].id };
    const row = await this.vdProjects.repo.insertProject({
      lifecycle_id: input.lifecycleId,
      client_id: input.clientId != null ? String(input.clientId) : null,
      cmkt_item_id: null,
      title: `Quote #${input.proposalId} · ${input.dvCode} · ${VID_TPL_01}`,
      stage: 'brief_draft',
      status: 'active',
      created_by: `quote-convert:${input.vid}`,
    });
    await this.vdProjects.repo.insertBrief(row.id, {
      template_key: VID_TPL_01,
      quote_version_id: input.vid,
      line_id: input.lineId,
    });
    return { id: row.id };
  }

  private async optionalCpProject(input: {
    proposalId: number;
    clientId?: string | null;
    actor: QuoteConvertActor;
    lifecycleId: number;
    dvCode: string;
  }): Promise<string | undefined> {
    if (!this.cpProjects) return undefined;
    const clientId = String(input.clientId ?? '').trim();
    const owner = Number(input.actor.staffId);
    if (!clientId || !(owner > 0)) return undefined;
    try {
      const created = await this.cpProjects.create(
        {
          name: `Quote #${input.proposalId} · ${input.dvCode}`,
          agency_client_id: clientId,
          owner_staff_id: owner,
          lifecycle_id: String(input.lifecycleId),
        },
        owner,
      );
      const id = created?.id;
      return id != null && String(id).trim() ? String(id) : undefined;
    } catch {
      return undefined;
    }
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
