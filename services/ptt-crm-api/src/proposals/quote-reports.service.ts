import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  QT_QUOTE_QUERY,
  QuoteAuditRepository,
  QuoteQueryPort,
} from './quote-audit.repository';
import { resolveQuoteCatalogGroup } from './quote-catalog.service';
import { parseLostReason, type QtLostReason } from './quote-lost-reason.util';
import { qtScopeSql } from './quote-scope.util';
import type { QuoteScope, QuoteStatus } from './quote.types';

export const QT_REPORT_TABS = [
  'executive',
  'funnel',
  'margin',
  'loss',
  'engagement',
] as const;

export type QuoteReportTab = (typeof QT_REPORT_TABS)[number];

const TAB_ALIASES: Record<string, QuoteReportTab> = {
  executive: 'executive',
  'rpt-01': 'executive',
  funnel: 'funnel',
  'rpt-02': 'funnel',
  margin: 'margin',
  'rpt-03': 'margin',
  loss: 'loss',
  'rpt-04': 'loss',
  engagement: 'engagement',
  'rpt-05': 'engagement',
};

const SENT_REACHED: readonly QuoteStatus[] = [
  'sent',
  'viewed',
  'negotiation',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
  'superseded',
];

const VIEWED_CURRENT: readonly QuoteStatus[] = ['viewed', 'negotiation', 'accepted'];

export type QuoteReportQuery = {
  scope: QuoteScope;
  staffId: number;
  teamIds: number[];
  hasFinance: boolean;
  tab?: string;
  from?: string;
  to?: string;
};

type QuoteRow = {
  id: number;
  status: QuoteStatus;
  quote_code: string | null;
  payable_vnd: number | null;
  nsr_vnd: number | null;
  media_vnd: number | null;
  lost_reason: QtLostReason | null;
};

type LineRow = {
  proposal_id: number;
  item_type: string;
  dv_code: string;
  service_slug: string;
  name: string;
  net_vnd: number | null;
  cost_vnd: number | null;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStatus(value: unknown): QuoteStatus {
  return String(value ?? 'draft') as QuoteStatus;
}

function parseTab(value: string | undefined): QuoteReportTab {
  const key = String(value ?? '').trim().toLowerCase();
  return TAB_ALIASES[key] ?? 'executive';
}

function bindScope(
  scope: ReturnType<typeof qtScopeSql>,
  startAt: number,
): { sql: string; params: unknown[] } {
  let sql = scope.sql;
  const params: unknown[] = [];
  let index = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${index++}`);
    params.push(scope.params[scope.params.length > 1 ? 1 : 0]);
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${index}`);
    params.push(scope.params[0]);
  }
  return { sql, params };
}

function sumMoney(values: Array<number | null>): number | null {
  const money = values.filter((value): value is number => value != null);
  return money.length ? money.reduce((sum, value) => sum + value, 0) : null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function quoteIdsOf(quotes: QuoteRow[]): number[] {
  return quotes.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0);
}

function reachedViewed(row: QuoteRow, viewedIds: Set<number>): boolean {
  return VIEWED_CURRENT.includes(row.status) || viewedIds.has(row.id);
}

function csvCell(value: unknown): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

@Injectable()
export class QuoteReportsService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly audit: QuoteAuditRepository,
  ) {}

  async get(query: QuoteReportQuery): Promise<Record<string, unknown>> {
    const tab = parseTab(query.tab);
    if (tab === 'margin' && !query.hasFinance) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_quote.finance' });
    }
    const quotes = await this.loadQuotes(query);
    const viewedIds = new Set(
      (await this.loadViews(query, quoteIdsOf(quotes))).map((event) => event.proposal_id),
    );
    if (tab === 'funnel') return this.funnel(quotes, viewedIds);
    if (tab === 'margin') return this.margin(query, quotes);
    if (tab === 'loss') return this.loss(quotes);
    if (tab === 'engagement') return this.engagement(query, quotes);
    return this.executive(query, quotes, viewedIds);
  }

  async export(
    query: QuoteReportQuery,
  ): Promise<{ csv: string; filename: string }> {
    const tab = parseTab(query.tab);
    const report = await this.get(query);
    const csv = serializeReportCsv(report);
    const quotes = await this.loadQuotes(query);
    const proposalId = quotes[0]?.id ?? 0;
    if (!(Number.isFinite(proposalId) && proposalId > 0)) {
      return { csv, filename: `quote-report-${tab}.csv` };
    }
    await this.audit.insert({
      proposal_id: proposalId,
      actor_staff_id: query.staffId > 0 ? query.staffId : null,
      actor_kind: 'staff',
      action: 'report_export',
      resource: 'report',
      snapshot_json: {
        tab,
        from: query.from ?? null,
        to: query.to ?? null,
        scope: query.scope,
      },
    });
    return { csv, filename: `quote-report-${tab}.csv` };
  }

  private async executive(
    query: QuoteReportQuery,
    quotes: QuoteRow[],
    viewedIds: Set<number>,
  ): Promise<Record<string, unknown>> {
    const sent = quotes.filter((row) => SENT_REACHED.includes(row.status));
    const viewed = quotes.filter((row) => reachedViewed(row, viewedIds));
    const accepted = quotes.filter((row) => row.status === 'accepted');
    return {
      tab: 'executive',
      sent_count: sent.length,
      sent_value_vnd: sumMoney(sent.map((row) => row.payable_vnd)),
      sent_to_viewed: ratio(viewed.length, sent.length),
      sent_to_accepted: ratio(accepted.length, sent.length),
      avg_approval_hours: await this.avgApprovalHours(query, quoteIdsOf(quotes)),
      last_updated: new Date().toISOString(),
    };
  }

  private funnel(quotes: QuoteRow[], viewedIds: Set<number>): Record<string, unknown> {
    const draft = quotes.length;
    const sent = quotes.filter((row) => SENT_REACHED.includes(row.status)).length;
    const viewed = quotes.filter((row) => reachedViewed(row, viewedIds)).length;
    const accepted = quotes.filter((row) => row.status === 'accepted').length;
    return {
      tab: 'funnel',
      steps: [
        { step: 'draft', count: draft, denominator: draft, rate: ratio(draft, draft) },
        { step: 'sent', count: sent, denominator: draft, rate: ratio(sent, draft) },
        { step: 'viewed', count: viewed, denominator: sent, rate: ratio(viewed, sent) },
        { step: 'accepted', count: accepted, denominator: sent, rate: ratio(accepted, sent) },
      ],
    };
  }

  private async margin(
    query: QuoteReportQuery,
    quotes: QuoteRow[],
  ): Promise<Record<string, unknown>> {
    const lines = await this.loadLines(query);
    const byGroup = new Map<
      string,
      { nsr: number | null; cost: number | null }
    >();
    for (const line of lines) {
      if (line.item_type !== 'fee') continue;
      const group = resolveQuoteCatalogGroup(line.dv_code, line.name, line.service_slug);
      const current = byGroup.get(group) ?? { nsr: null, cost: null };
      if (line.net_vnd != null) current.nsr = (current.nsr ?? 0) + line.net_vnd;
      if (line.cost_vnd != null) current.cost = (current.cost ?? 0) + line.cost_vnd;
      byGroup.set(group, current);
    }
    const groups = [...byGroup.entries()].map(([group, money]) => ({
      group,
      nsr_vnd: money.nsr,
      direct_cost_vnd: money.cost,
      gm:
        money.nsr != null && money.nsr > 0 && money.cost != null
          ? (money.nsr - money.cost) / money.nsr
          : null,
    }));
    return {
      tab: 'margin',
      groups,
      agency_revenue_vnd: sumMoney(quotes.map((row) => row.nsr_vnd)),
    };
  }

  private loss(quotes: QuoteRow[]): Record<string, unknown> {
    const rejected = quotes.filter((row) => row.status === 'rejected');
    const counts = new Map<string, number>();
    for (const row of rejected) {
      const reason = row.lost_reason ?? 'other';
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    const total = rejected.length;
    return {
      tab: 'loss',
      reasons: [...counts.entries()].map(([reason, count]) => ({
        reason,
        count,
        share: ratio(count, total),
      })),
    };
  }

  private async engagement(
    query: QuoteReportQuery,
    quotes: QuoteRow[],
  ): Promise<Record<string, unknown>> {
    const ids = quoteIdsOf(quotes);
    const events = await this.loadViews(query, ids);
    const comments = await this.loadComments(query, ids);
    const byQuote = new Map<
      number,
      { first: string | null; last: string | null; section: string | null; comments: number }
    >();
    for (const quote of quotes) {
      byQuote.set(quote.id, {
        first: null,
        last: null,
        section: null,
        comments: comments.get(quote.id) ?? 0,
      });
    }
    const scoped = new Set(ids);
    for (const event of events) {
      if (!scoped.has(event.proposal_id)) continue;
      const current = byQuote.get(event.proposal_id) ?? {
        first: null,
        last: null,
        section: null,
        comments: comments.get(event.proposal_id) ?? 0,
      };
      if (!current.first || (event.created_at && event.created_at < current.first)) {
        current.first = event.created_at;
      }
      if (!current.last || (event.created_at && event.created_at > current.last)) {
        current.last = event.created_at;
        if (event.section) current.section = event.section;
      } else if (!current.section && event.section) {
        current.section = event.section;
      }
      byQuote.set(event.proposal_id, current);
    }
    return {
      tab: 'engagement',
      items: [...byQuote.entries()]
        .filter(([, row]) => row.first || row.last || row.comments > 0)
        .map(([id, row]) => {
          const quote = quotes.find((item) => item.id === id);
          return {
            proposal_id: id,
            quote_code: quote?.quote_code ?? null,
            first_view: row.first,
            last_view: row.last,
            section: row.section,
            comment_count: row.comments || null,
          };
        }),
    };
  }

  private async avgApprovalHours(
    query: QuoteReportQuery,
    quoteIds: number[],
  ): Promise<number | null> {
    if (!quoteIds.length) return null;
    const scoped = new Set(quoteIds);
    const submitted = new Map<number, number>();
    const approved = new Map<number, number>();
    try {
      const result = await this.db.query(
        `SELECT proposal_id, action, created_at
           FROM crm_quote_activity
          WHERE action IN ('quote.approval_submitted', 'quote.approval_approved')
            AND proposal_id = ANY($3::int[])
            AND ($1::text IS NULL OR created_at >= $1::timestamptz)
            AND ($2::text IS NULL OR created_at < $2::timestamptz + INTERVAL '1 day')`,
        [query.from ?? null, query.to ?? null, quoteIds],
      );
      for (const row of result.rows) {
        const id = Number(row.proposal_id ?? 0);
        const at = Date.parse(String(row.created_at ?? ''));
        if (!Number.isFinite(id) || id <= 0 || !scoped.has(id) || !Number.isFinite(at)) continue;
        if (String(row.action) === 'quote.approval_submitted') submitted.set(id, at);
        if (String(row.action) === 'quote.approval_approved') approved.set(id, at);
      }
    } catch {
      return null;
    }
    const hours: number[] = [];
    for (const [id, start] of submitted) {
      const end = approved.get(id);
      if (end == null || end < start) continue;
      hours.push((end - start) / 3_600_000);
    }
    return hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null;
  }

  private async loadQuotes(query: QuoteReportQuery): Promise<QuoteRow[]> {
    try {
      await this.db.query(`ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS lost_reason TEXT`);
    } catch {
      /* memory / already present */
    }
    const scope = bindScope(
      qtScopeSql({
        scope: query.scope,
        staffId: query.staffId,
        teamIds: query.teamIds,
      }),
      3,
    );
    const result = await this.db.query(
      `SELECT p.id, p.status, p.quote_code, p.lost_reason,
              v.payable_vnd, v.nsr_vnd, v.media_vnd
         FROM crm_proposals p
         LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
        WHERE ${scope.sql}
          AND ($1::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                >= $1::timestamptz)
          AND ($2::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                < $2::timestamptz + INTERVAL '1 day')
        ORDER BY p.id DESC`,
      [query.from ?? null, query.to ?? null, ...scope.params],
    );
    return result.rows.map((row) => ({
      id: Number(row.id ?? 0),
      status: asStatus(row.status),
      quote_code: row.quote_code == null ? null : String(row.quote_code),
      payable_vnd: finiteNumber(row.payable_vnd),
      nsr_vnd: finiteNumber(row.nsr_vnd),
      media_vnd: finiteNumber(row.media_vnd),
      lost_reason: parseLostReason(row.lost_reason),
    }));
  }

  private async loadLines(query: QuoteReportQuery): Promise<LineRow[]> {
    const scope = bindScope(
      qtScopeSql({
        scope: query.scope,
        staffId: query.staffId,
        teamIds: query.teamIds,
      }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT l.proposal_id, l.item_type, l.dv_code, l.service_slug,
                COALESCE(l.catalog_snapshot_json->>'name', l.dv_code) AS name,
                CASE WHEN l.item_type = 'fee'
                     THEN COALESCE(l.final_price_vnd, l.unit_price_vnd * COALESCE(l.qty, 1) - COALESCE(l.discount_vnd, 0))
                     ELSE NULL
                END AS net_vnd,
                CASE
                  WHEN l.cost_labor_vnd IS NULL AND l.cost_outsource_vnd IS NULL
                       AND l.cost_other_vnd IS NULL THEN NULL
                  ELSE COALESCE(l.cost_labor_vnd, 0) + COALESCE(l.cost_outsource_vnd, 0)
                       + COALESCE(l.cost_other_vnd, 0)
                END AS cost_vnd
           FROM crm_quote_line_item l
           JOIN crm_proposals p ON p.id = l.proposal_id
           LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
          WHERE ${scope.sql}
            AND ($1::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                  >= $1::timestamptz)
            AND ($2::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                  < $2::timestamptz + INTERVAL '1 day')`,
        [query.from ?? null, query.to ?? null, ...scope.params],
      );
      return result.rows.map((row) => mapLine(row));
    } catch {
      return [];
    }
  }

  private async loadViews(
    query: QuoteReportQuery,
    quoteIds: number[],
  ): Promise<Array<{ proposal_id: number; created_at: string | null; section: string | null }>> {
    if (!quoteIds.length) return [];
    const scoped = new Set(quoteIds);
    try {
      const result = await this.db.query(
        `SELECT p.id AS proposal_id, e.created_at, e.section_key
           FROM crm_quote_view_events e
           JOIN crm_quote_shares s ON s.id = e.share_id
           JOIN crm_quote_versions v ON v.id = s.version_id
           JOIN crm_proposals p ON p.id = v.proposal_id
          WHERE p.id = ANY($3::int[])
            AND ($1::text IS NULL OR e.created_at >= $1::timestamptz)
            AND ($2::text IS NULL OR e.created_at < $2::timestamptz + INTERVAL '1 day')
          ORDER BY e.created_at`,
        [query.from ?? null, query.to ?? null, quoteIds],
      );
      return result.rows
        .map((row) => ({
          proposal_id: Number(row.proposal_id ?? 0),
          created_at: row.created_at == null ? null : String(row.created_at),
          section: row.section_key == null || row.section_key === '' ? null : String(row.section_key),
        }))
        .filter((row) => scoped.has(row.proposal_id));
    } catch {
      return [];
    }
  }

  private async loadComments(
    query: QuoteReportQuery,
    quoteIds: number[],
  ): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (!quoteIds.length) return counts;
    const scoped = new Set(quoteIds);
    try {
      const result = await this.db.query(
        `SELECT v.proposal_id, COUNT(*)::int AS comment_count
           FROM crm_quote_comments c
           JOIN crm_quote_versions v ON v.id = c.version_id
          WHERE v.proposal_id = ANY($3::int[])
            AND ($1::text IS NULL OR c.created_at >= $1::timestamptz)
            AND ($2::text IS NULL OR c.created_at < $2::timestamptz + INTERVAL '1 day')
          GROUP BY v.proposal_id`,
        [query.from ?? null, query.to ?? null, quoteIds],
      );
      for (const row of result.rows) {
        const id = Number(row.proposal_id ?? 0);
        const count = finiteNumber(row.comment_count);
        if (id > 0 && scoped.has(id) && count != null) counts.set(id, count);
      }
    } catch {
      return counts;
    }
    return counts;
  }
}

function mapLine(row: Record<string, unknown>): LineRow {
  const itemType = String(row.item_type ?? 'fee');
  const net =
    itemType === 'fee'
      ? finiteNumber(row.net_vnd ?? row.final_price_vnd)
      : finiteNumber(row.net_vnd);
  const cost =
    finiteNumber(row.cost_vnd) ??
    sumMoney([
      finiteNumber(row.cost_labor_vnd),
      finiteNumber(row.cost_outsource_vnd),
      finiteNumber(row.cost_other_vnd),
    ]);
  return {
    proposal_id: Number(row.proposal_id ?? 0),
    item_type: itemType,
    dv_code: String(row.dv_code ?? ''),
    service_slug: String(row.service_slug ?? ''),
    name: String(row.name ?? row.dv_code ?? ''),
    net_vnd: net,
    cost_vnd: cost,
  };
}

function serializeReportCsv(report: Record<string, unknown>): string {
  const rows: string[] = ['key,value'];
  const walk = (prefix: string, value: unknown) => {
    if (value == null) {
      rows.push(`${csvCell(prefix)},`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(prefix ? `${prefix}.${index}` : String(index), item));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${key}` : key, inner);
      }
      return;
    }
    rows.push(`${csvCell(prefix)},${csvCell(value)}`);
  };
  walk('', report);
  return rows.join('\n');
}

export { parseTab };
