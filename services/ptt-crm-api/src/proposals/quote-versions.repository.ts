import { Inject, Injectable } from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import { QT_TENANT_ID } from './quote-settings.repository';
import {
  diffQuoteVersions,
  type QuoteCompareSnapshot,
  type QuoteVersionDiff,
} from './quote-version-diff.util';

export type { QuoteVersionDiff };

export type QuoteHeaderPatch = {
  title?: string;
  objective?: string;
  audience?: string;
  campaign_period?: string;
  valid_until?: string | null;
};

export type QuoteProposalHeader = {
  id: number;
  quote_code: string | null;
  current_version_id: string | null;
  row_version: number;
  status: string;
  title: string;
  objective: string;
  audience: string;
  campaign_period: string;
  agency_client_id: string | null;
  customer_id: number | null;
  valid_until: string | null;
  owner_staff_id: number | null;
  archived_at: string | null;
};

export type QuoteVersionRow = {
  id: string;
  proposal_id: number;
  n: number;
  state: string;
  snapshot_json: Record<string, unknown>;
  fee_vnd: number;
  media_vnd: number;
  discount_vnd: number;
  tax_vnd: number;
  payable_vnd: number;
  nsr_vnd: number | null;
  direct_cost_vnd: number | null;
  gm_bps: number | null;
  created_by: number;
};

export type QuoteBuilderLineWrite = {
  dv_code: string;
  sku_code?: string | null;
  package_tier: string;
  service_slug: string;
  reference_price_min: number;
  reference_price_max: number;
  final_price_vnd: number;
  scope_notes?: string;
  item_type: string;
  qty: number;
  unit_price_vnd: number;
  discount_vnd: number;
  media_amount_vnd: number;
  tax_vnd: number;
  cost_labor_vnd: number | null;
  cost_outsource_vnd: number | null;
  cost_other_vnd: number | null;
  client_visible: boolean;
  catalog_snapshot_json: Record<string, unknown>;
};

export type QuoteBuilderLineRow = QuoteBuilderLineWrite & {
  id: number;
  proposal_id: number;
  sort_order: number;
};

export type QuotePaymentWrite = {
  seq: number;
  pct_bps: number;
  amount_vnd: bigint | number;
  milestone: string;
};

export type QuotePaymentRow = {
  id: string;
  version_id: string;
  seq: number;
  pct_bps: number;
  amount_vnd: number;
  milestone: string;
};

export type QuoteCatalogRow = {
  dv_code: string;
  slug: string;
  name: string;
  active: boolean;
  status: string;
  service_slug: string;
  tier_pricing: Record<string, unknown>;
};

export type QuoteVersionTotals = {
  fee_vnd: bigint;
  media_vnd: bigint;
  discount_vnd: bigint;
  tax_vnd: bigint;
  payable_vnd: bigint;
  nsr_vnd: bigint | null;
  direct_cost_vnd: bigint | null;
  gm_bps: number | null;
};

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value) {
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

function mapProposal(row: Record<string, unknown>): QuoteProposalHeader {
  return {
    id: num(row.id),
    quote_code: row.quote_code == null ? null : String(row.quote_code),
    current_version_id: row.current_version_id == null ? null : String(row.current_version_id),
    row_version: num(row.row_version, 1),
    status: String(row.status ?? 'draft'),
    title: String(row.title ?? ''),
    objective: String(row.objective ?? ''),
    audience: String(row.audience ?? ''),
    campaign_period: String(row.campaign_period ?? ''),
    agency_client_id: row.agency_client_id == null ? null : String(row.agency_client_id),
    customer_id: nullableNum(row.customer_id),
    valid_until: row.valid_until == null ? null : String(row.valid_until),
    owner_staff_id: nullableNum(row.owner_staff_id),
    archived_at: row.archived_at == null || row.archived_at === '' ? null : String(row.archived_at),
  };
}

function mapVersion(row: Record<string, unknown>): QuoteVersionRow {
  return {
    id: String(row.id ?? ''),
    proposal_id: num(row.proposal_id),
    n: num(row.n, 1),
    state: String(row.state ?? 'working'),
    snapshot_json: asObject(row.snapshot_json),
    fee_vnd: num(row.fee_vnd),
    media_vnd: num(row.media_vnd),
    discount_vnd: num(row.discount_vnd),
    tax_vnd: num(row.tax_vnd),
    payable_vnd: num(row.payable_vnd),
    nsr_vnd: nullableNum(row.nsr_vnd),
    direct_cost_vnd: nullableNum(row.direct_cost_vnd),
    gm_bps: nullableNum(row.gm_bps),
    created_by: num(row.created_by),
  };
}

function mapLine(row: Record<string, unknown>): QuoteBuilderLineRow {
  return {
    id: num(row.id),
    proposal_id: num(row.proposal_id),
    dv_code: String(row.dv_code ?? ''),
    sku_code: row.sku_code == null ? null : String(row.sku_code),
    package_tier: String(row.package_tier ?? ''),
    service_slug: String(row.service_slug ?? ''),
    reference_price_min: num(row.reference_price_min),
    reference_price_max: num(row.reference_price_max),
    final_price_vnd: num(row.final_price_vnd),
    scope_notes: String(row.scope_notes ?? ''),
    sort_order: num(row.sort_order),
    item_type: String(row.item_type ?? 'fee'),
    qty: num(row.qty, 1),
    unit_price_vnd: num(row.unit_price_vnd),
    discount_vnd: num(row.discount_vnd),
    media_amount_vnd: num(row.media_amount_vnd),
    tax_vnd: num(row.tax_vnd),
    cost_labor_vnd: nullableNum(row.cost_labor_vnd),
    cost_outsource_vnd: nullableNum(row.cost_outsource_vnd),
    cost_other_vnd: nullableNum(row.cost_other_vnd),
    client_visible: row.client_visible !== false && row.client_visible !== 'f',
    catalog_snapshot_json: asObject(row.catalog_snapshot_json),
  };
}

function mapPayment(row: Record<string, unknown>): QuotePaymentRow {
  return {
    id: String(row.id ?? ''),
    version_id: String(row.version_id ?? ''),
    seq: num(row.seq),
    pct_bps: num(row.pct_bps),
    amount_vnd: num(row.amount_vnd),
    milestone: String(row.milestone ?? ''),
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

function mapCatalog(row: Record<string, unknown>): QuoteCatalogRow {
  const active = row.active !== false && row.active !== 'f';
  const rawStatus = String(row.status ?? '').trim().toLowerCase();
  return {
    dv_code: String(row.dv_code ?? '').toUpperCase(),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    active,
    status: rawStatus || (active ? 'active' : 'draft'),
    service_slug: String(row.service_slug ?? row.slug ?? ''),
    tier_pricing: asObject(row.tier_pricing),
  };
}

@Injectable()
export class QuoteVersionsRepository {
  constructor(@Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort) {}

  run(query?: QuoteQueryFn): QuoteQueryFn {
    return query ?? ((sql, params) => this.db.query(sql, params));
  }

  async withTransaction<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) return this.db.withTransaction(fn);
    return fn((sql, params) => this.db.query(sql, params));
  }

  async getProposal(id: number, query?: QuoteQueryFn): Promise<QuoteProposalHeader | null> {
    const result = await this.run(query)(
      `SELECT id, quote_code, current_version_id, row_version, status, title, objective,
              audience, campaign_period, agency_client_id, customer_id, valid_until, owner_staff_id,
              archived_at
         FROM crm_proposals
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapProposal(result.rows[0]) : null;
  }

  async updateHeader(
    id: number,
    patch: QuoteHeaderPatch,
    expectedRowVersion: number,
    query?: QuoteQueryFn,
  ): Promise<QuoteProposalHeader | null> {
    const current = await this.getProposal(id, query);
    if (!current) return null;
    const result = await this.run(query)(
      `UPDATE crm_proposals
          SET title = $1,
              objective = $2,
              audience = $3,
              campaign_period = $4,
              valid_until = $5,
              updated_at = $6,
              row_version = row_version + 1
        WHERE row_version = $7
          AND id = $8
        RETURNING id, quote_code, current_version_id, row_version, status, title, objective,
                  audience, campaign_period, agency_client_id, customer_id, valid_until, owner_staff_id,
                  archived_at`,
      [
        patch.title ?? current.title,
        patch.objective ?? current.objective,
        patch.audience ?? current.audience,
        patch.campaign_period ?? current.campaign_period,
        patch.valid_until !== undefined ? patch.valid_until : current.valid_until,
        new Date().toISOString(),
        expectedRowVersion,
        id,
      ],
    );
    return result.rows[0] ? mapProposal(result.rows[0]) : null;
  }

  async getVersion(vid: string, query?: QuoteQueryFn): Promise<QuoteVersionRow | null> {
    const result = await this.run(query)(
      `SELECT id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
              tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by
         FROM crm_quote_versions
        WHERE id::text = $1
        LIMIT 1`,
      [vid],
    );
    return result.rows[0] ? mapVersion(result.rows[0]) : null;
  }

  async createWorkingVersion(
    proposalId: number,
    createdBy: number,
    query?: QuoteQueryFn,
  ): Promise<QuoteVersionRow> {
    const result = await this.run(query)(
      `INSERT INTO crm_quote_versions (proposal_id, n, state, snapshot_json, created_by)
       VALUES ($1, 1, 'working', '{}', $2)
       RETURNING id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
                 tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by`,
      [proposalId, createdBy],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('version_insert_failed');
    }
    await this.run(query)(
      `UPDATE crm_proposals
          SET current_version_id = $1, updated_at = $2
        WHERE id = $3
          AND current_version_id IS NULL`,
      [row.id, new Date().toISOString(), proposalId],
    );
    return mapVersion(row);
  }

  async listVersions(proposalId: number, query?: QuoteQueryFn): Promise<QuoteVersionRow[]> {
    const result = await this.run(query)(
      `SELECT id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
              tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by
         FROM crm_quote_versions
        WHERE proposal_id = $1
        ORDER BY n ASC`,
      [proposalId],
    );
    return result.rows.map(mapVersion);
  }

  async getVersionByN(
    proposalId: number,
    n: number,
    query?: QuoteQueryFn,
  ): Promise<QuoteVersionRow | null> {
    const result = await this.run(query)(
      `SELECT id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
              tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by
         FROM crm_quote_versions
        WHERE proposal_id = $1
          AND n = $2
        LIMIT 1`,
      [proposalId, n],
    );
    return result.rows[0] ? mapVersion(result.rows[0]) : null;
  }

  async createNextWorkingVersion(
    proposalId: number,
    createdBy: number,
    query?: QuoteQueryFn,
  ): Promise<QuoteVersionRow> {
    const write = async (q: QuoteQueryFn) => {
      const versions = await this.listVersions(proposalId, q);
      const source = [...versions].sort((a, b) => b.n - a.n)[0] ?? null;
      const nextN = (source?.n ?? 0) + 1;
      const snapshot = cloneJson(source?.snapshot_json ?? {});
      delete (snapshot as { compare?: unknown }).compare;
      const result = await q(
        `INSERT INTO crm_quote_versions (
           proposal_id, n, state, snapshot_json, created_by,
           fee_vnd, media_vnd, discount_vnd, tax_vnd, payable_vnd,
           nsr_vnd, direct_cost_vnd, gm_bps
         ) VALUES ($1, $2, 'working', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
                   tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by`,
        [
          proposalId,
          nextN,
          snapshot,
          createdBy,
          source?.fee_vnd ?? 0,
          source?.media_vnd ?? 0,
          source?.discount_vnd ?? 0,
          source?.tax_vnd ?? 0,
          source?.payable_vnd ?? 0,
          source?.nsr_vnd ?? null,
          source?.direct_cost_vnd ?? null,
          source?.gm_bps ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('version_insert_failed');
      const created = mapVersion(row);
      if (source) {
        await this.copyVersionChildren(source.id, created.id, q);
      }
      await q(`UPDATE crm_proposals SET current_version_id = $1, updated_at = $2 WHERE id = $3`, [
        created.id,
        new Date().toISOString(),
        proposalId,
      ]);
      return created;
    };
    if (query) return write(query);
    return this.withTransaction(write);
  }

  async compareVersions(
    proposalId: number,
    fromN: number,
    toN: number,
    query?: QuoteQueryFn,
  ): Promise<QuoteVersionDiff[]> {
    const write = async (q: QuoteQueryFn) => {
      const from = await this.getVersionByN(proposalId, fromN, q);
      const to = await this.getVersionByN(proposalId, toN, q);
      if (!from || !to) throw new Error('version_not_found');
      const left = await this.toCompareSnapshot(from, q);
      const right = await this.toCompareSnapshot(to, q);
      const items = diffQuoteVersions(left, right);
      if (String(to.state).toLowerCase() === 'working') {
        const nextSnap = { ...cloneJson(to.snapshot_json), compare: { from_n: fromN, to_n: toN, items } };
        await q(
          `UPDATE crm_quote_versions SET snapshot_json = $1 WHERE id::text = $2 RETURNING id`,
          [nextSnap, to.id],
        );
      }
      return items;
    };
    if (query) return write(query);
    return this.withTransaction(write);
  }

  async listLines(proposalId: number, query?: QuoteQueryFn): Promise<QuoteBuilderLineRow[]> {
    const result = await this.run(query)(
      `SELECT * FROM crm_quote_line_item
        WHERE proposal_id = $1
        ORDER BY sort_order ASC, id ASC`,
      [proposalId],
    );
    return result.rows.map(mapLine);
  }

  async replaceLines(
    proposalId: number,
    lines: QuoteBuilderLineWrite[],
    query?: QuoteQueryFn,
  ): Promise<QuoteBuilderLineRow[]> {
    const write = async (q: QuoteQueryFn) => {
      await q(`DELETE FROM crm_quote_line_item WHERE proposal_id = $1`, [proposalId]);
      const inserted: QuoteBuilderLineRow[] = [];
      for (const [index, line] of lines.entries()) {
        const result = await q(
          `INSERT INTO crm_quote_line_item (
             proposal_id, dv_code, sku_code, package_tier, service_slug,
             reference_price_min, reference_price_max, final_price_vnd,
             scope_notes, sort_order, item_type, qty, unit_price_vnd, discount_vnd,
             media_amount_vnd, tax_vnd, cost_labor_vnd, cost_outsource_vnd, cost_other_vnd,
             client_visible, catalog_snapshot_json
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
           )
           RETURNING *`,
          [
            proposalId,
            line.dv_code,
            line.sku_code ?? null,
            line.package_tier,
            line.service_slug,
            line.reference_price_min,
            line.reference_price_max,
            line.final_price_vnd,
            String(line.scope_notes ?? ''),
            index,
            line.item_type,
            line.qty,
            line.unit_price_vnd,
            line.discount_vnd,
            line.media_amount_vnd,
            line.tax_vnd,
            line.cost_labor_vnd,
            line.cost_outsource_vnd,
            line.cost_other_vnd,
            line.client_visible,
            line.catalog_snapshot_json,
          ],
        );
        if (result.rows[0]) inserted.push(mapLine(result.rows[0]));
      }
      return inserted;
    };
    if (query) return write(query);
    return this.withTransaction(write);
  }

  async updateTotals(
    vid: string,
    totals: QuoteVersionTotals,
    snapshot: Record<string, unknown>,
    query?: QuoteQueryFn,
  ): Promise<QuoteVersionRow | null> {
    const result = await this.run(query)(
      `UPDATE crm_quote_versions
          SET fee_vnd = $1,
              media_vnd = $2,
              discount_vnd = $3,
              tax_vnd = $4,
              payable_vnd = $5,
              nsr_vnd = $6,
              direct_cost_vnd = $7,
              gm_bps = $8,
              snapshot_json = $9
        WHERE id::text = $10
        RETURNING id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
                  tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by`,
      [
        totals.fee_vnd.toString(),
        totals.media_vnd.toString(),
        totals.discount_vnd.toString(),
        totals.tax_vnd.toString(),
        totals.payable_vnd.toString(),
        totals.nsr_vnd == null ? null : totals.nsr_vnd.toString(),
        totals.direct_cost_vnd == null ? null : totals.direct_cost_vnd.toString(),
        totals.gm_bps,
        snapshot,
        vid,
      ],
    );
    return result.rows[0] ? mapVersion(result.rows[0]) : null;
  }

  async setProposalPayable(proposalId: number, payableVnd: bigint, query?: QuoteQueryFn): Promise<void> {
    await this.run(query)(
      `UPDATE crm_proposals SET total_vnd = $1, updated_at = $2 WHERE id = $3`,
      [payableVnd.toString(), new Date().toISOString(), proposalId],
    );
  }

  async listPayments(vid: string, query?: QuoteQueryFn): Promise<QuotePaymentRow[]> {
    const result = await this.run(query)(
      `SELECT id, version_id, seq, pct_bps, amount_vnd, milestone
         FROM crm_quote_payment_schedules
        WHERE version_id::text = $1
        ORDER BY seq ASC`,
      [vid],
    );
    return result.rows.map(mapPayment);
  }

  async replacePayments(
    vid: string,
    rows: QuotePaymentWrite[],
    query?: QuoteQueryFn,
  ): Promise<QuotePaymentRow[]> {
    const write = async (q: QuoteQueryFn) => {
      await q(`DELETE FROM crm_quote_payment_schedules WHERE version_id::text = $1`, [vid]);
      const inserted: QuotePaymentRow[] = [];
      for (const row of rows) {
        const result = await q(
          `INSERT INTO crm_quote_payment_schedules (version_id, seq, pct_bps, amount_vnd, milestone)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, version_id, seq, pct_bps, amount_vnd, milestone`,
          [vid, row.seq, row.pct_bps, row.amount_vnd.toString(), row.milestone],
        );
        if (result.rows[0]) inserted.push(mapPayment(result.rows[0]));
      }
      return inserted;
    };
    if (query) return write(query);
    return this.withTransaction(write);
  }

  async loadSettings(query?: QuoteQueryFn): Promise<{ vat_bps: number; payment_template: string }> {
    const result = await this.run(query)(
      `SELECT vat_bps, payment_template
         FROM crm_quote_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [QT_TENANT_ID],
    );
    const row = result.rows[0] ?? {};
    return {
      vat_bps: num(row.vat_bps, 800),
      payment_template: String(row.payment_template ?? '50/30/20'),
    };
  }

  async listKpis(vid: string, query?: QuoteQueryFn): Promise<Record<string, unknown>[]> {
    const result = await this.run(query)(
      `SELECT id, version_id, option_key, name, class, value_text, source, assumption
         FROM crm_quote_kpis
        WHERE version_id::text = $1
        ORDER BY name ASC`,
      [vid],
    );
    return result.rows;
  }

  async listClauses(vid: string, query?: QuoteQueryFn): Promise<Record<string, unknown>[]> {
    const result = await this.run(query)(
      `SELECT id, version_id, template_key, body, diverged
         FROM crm_quote_clauses
        WHERE version_id::text = $1
        ORDER BY template_key ASC`,
      [vid],
    );
    return result.rows;
  }

  private async copyVersionChildren(fromVid: string, toVid: string, query: QuoteQueryFn): Promise<void> {
    const payments = await this.listPayments(fromVid, query);
    if (payments.length) {
      await this.replacePayments(
        toVid,
        payments.map((row) => ({
          seq: row.seq,
          pct_bps: row.pct_bps,
          amount_vnd: row.amount_vnd,
          milestone: row.milestone,
        })),
        query,
      );
    }
    const kpis = await this.listKpis(fromVid, query);
    for (const kpi of kpis) {
      await query(
        `INSERT INTO crm_quote_kpis (version_id, option_key, name, class, value_text, source, assumption)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          toVid,
          kpi.option_key ?? null,
          kpi.name,
          kpi.class,
          kpi.value_text,
          kpi.source ?? null,
          kpi.assumption ?? null,
        ],
      );
    }
    const clauses = await this.listClauses(fromVid, query);
    for (const clause of clauses) {
      await query(
        `INSERT INTO crm_quote_clauses (version_id, template_key, body, diverged)
         VALUES ($1, $2, $3, $4)`,
        [toVid, clause.template_key, clause.body, clause.diverged === true],
      );
    }
  }

  private async toCompareSnapshot(
    version: QuoteVersionRow,
    query?: QuoteQueryFn,
  ): Promise<QuoteCompareSnapshot> {
    const snap = cloneJson(version.snapshot_json ?? {});
    const working = String(version.state).toLowerCase() === 'working';
    const lines = working
      ? (await this.listLines(version.proposal_id, query)).map((line) => ({
          qty: line.qty,
          unit_price_vnd: line.unit_price_vnd,
          final_price_vnd: line.final_price_vnd,
          discount_vnd: line.discount_vnd,
          tax_vnd: line.tax_vnd,
          cost_labor_vnd: line.cost_labor_vnd,
          cost_outsource_vnd: line.cost_outsource_vnd,
          cost_other_vnd: line.cost_other_vnd,
          scope_notes: line.scope_notes,
        }))
      : ((snap.lines as QuoteCompareSnapshot['lines']) ?? []);
    const payments = (await this.listPayments(version.id, query)).map((row) => ({
      seq: row.seq,
      pct_bps: row.pct_bps,
      amount_vnd: row.amount_vnd,
      milestone: row.milestone,
    }));
    const kpis = (await this.listKpis(version.id, query)).map((row) => ({
      name: String(row.name ?? ''),
      value_text: String(row.value_text ?? ''),
      client_visible: row.client_visible !== false && row.client_visible !== 'f',
    }));
    const clauses = (await this.listClauses(version.id, query)).map((row) => ({
      template_key: String(row.template_key ?? ''),
      body: String(row.body ?? ''),
    }));
    return {
      title: snap.title == null ? undefined : String(snap.title),
      lines: lines.length ? lines : ((snap.lines as QuoteCompareSnapshot['lines']) ?? []),
      discount_vnd: version.discount_vnd,
      tax_vnd: version.tax_vnd,
      kpis: kpis.length ? kpis : ((snap.kpis as QuoteCompareSnapshot['kpis']) ?? []),
      payments: payments.length ? payments : ((snap.payments as QuoteCompareSnapshot['payments']) ?? []),
      clauses: clauses.length ? clauses : ((snap.clauses as QuoteCompareSnapshot['clauses']) ?? []),
    };
  }

  async loadCatalog(dvCode: string, query?: QuoteQueryFn): Promise<QuoteCatalogRow | null> {
    const result = await this.run(query)(
      `SELECT c.dv_code, c.slug, c.name, c.active,
              CASE WHEN c.active THEN 'active' ELSE 'draft' END AS status,
              COALESCE(p.tier_pricing, '{}') AS tier_pricing,
              COALESCE(p.service_slug, c.slug) AS service_slug
         FROM crm_catalog_services c
         LEFT JOIN ops_service_profile p ON upper(trim(p.dv_code)) = upper(trim(c.dv_code))
        WHERE upper(trim(c.dv_code)) = upper(trim($1))
           OR upper(trim(c.slug)) = upper(trim($1))
        LIMIT 1`,
      [dvCode],
    );
    if (result.rows[0]) return mapCatalog(result.rows[0]);
    const profile = await this.run(query)(
      `SELECT dv_code, service_slug AS slug, name, true AS active, 'active' AS status,
              tier_pricing, service_slug
         FROM ops_service_profile
        WHERE upper(trim(dv_code)) = upper(trim($1))
        LIMIT 1`,
      [dvCode],
    );
    return profile.rows[0] ? mapCatalog(profile.rows[0]) : null;
  }
}
