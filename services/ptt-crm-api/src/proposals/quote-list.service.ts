import { Inject, Injectable } from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import { qtScopeSql } from './quote-scope.util';
import { QT_OPEN_STATUSES } from './quote-overview.service';
import type { QuoteScope, QuoteStatus } from './quote.types';

const ALL_STATUSES: QuoteStatus[] = [
  'draft',
  'in_review',
  'pending_approval',
  'returned',
  'approved',
  'sent',
  'viewed',
  'negotiation',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
  'superseded',
  'archived',
];

const PAGE_SIZES = [25, 50, 100] as const;

export type QuoteListQuery = {
  scope: QuoteScope;
  staffId: number;
  teamIds: number[];
  hasFinance: boolean;
  status?: string;
  q?: string;
  expiring?: boolean | string;
  pending_my_approval?: boolean | string;
  page?: number | string;
  page_size?: number | string;
};

export type QuoteListItem = {
  id: number;
  quote_code: string | null;
  version_n: number | null;
  client_name: string | null;
  lead_code: string | null;
  option: null;
  payable_vnd: number | null;
  fee_vnd: number | null;
  gm_bps: number | null;
  status: QuoteStatus;
  valid_until: string | null;
  owner: { staff_id: number | null; name: string | null };
};

export type QuoteListResult = {
  items: QuoteListItem[];
  page: number;
  page_size: number;
  total: number;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStatus(value: unknown): QuoteStatus {
  const status = String(value ?? 'draft');
  return (ALL_STATUSES as string[]).includes(status) ? (status as QuoteStatus) : 'draft';
}

function truthy(value: unknown): boolean {
  if (value === true) return true;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function pageSizeOf(value: unknown): number {
  const n = Number(value ?? 25);
  if (PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number])) return n;
  return 25;
}

function pageOf(value: unknown): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
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

function leadCode(leadId: number | null): string | null {
  if (leadId == null || leadId <= 0) return null;
  return `LD-${leadId}`;
}

function stripForbidden(value: QuoteListResult): QuoteListResult {
  return JSON.parse(
    JSON.stringify(value, (key, inner) =>
      /cost_|nsr|direct_cost/i.test(key) ? undefined : inner,
    ),
  ) as QuoteListResult;
}

@Injectable()
export class QuoteListService {
  constructor(@Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort) {}

  async list(query: QuoteListQuery): Promise<QuoteListResult> {
    const page = pageOf(query.page);
    const pageSize = pageSizeOf(query.page_size);
    const { where, params } = this.buildWhere(query);
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS n
         FROM crm_proposals p
         LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
         LEFT JOIN clients c ON c.id = p.agency_client_id
        WHERE ${where}`,
      params,
    );
    const total = finiteNumber(count.rows[0]?.n) ?? 0;
    const offset = (page - 1) * pageSize;
    const listed = await this.db.query(
      `SELECT p.id, p.quote_code, p.title, p.status, p.valid_until AS proposal_valid_until,
              p.owner_staff_id, p.lead_id, p.co_owner_staff_ids,
              v.n, v.payable_vnd, v.fee_vnd, v.gm_bps, v.valid_until,
              v.direct_cost_vnd, v.nsr_vnd,
              c.name AS client_name,
              cs.name AS owner_name
         FROM crm_proposals p
         LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
         LEFT JOIN clients c ON c.id = p.agency_client_id
         LEFT JOIN crm_staff cs ON cs.id = p.owner_staff_id
        WHERE ${where}
        ORDER BY p.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );
    const items = listed.rows.map((row) => this.mapRow(row, query.hasFinance));
    return stripForbidden({ items, page, page_size: pageSize, total });
  }

  private buildWhere(query: QuoteListQuery): { where: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const status = String(query.status ?? '').trim();
    if (status && (ALL_STATUSES as string[]).includes(status)) {
      params.push(status);
      clauses.push(`p.status = $${params.length}`);
    }
    const q = String(query.q ?? '').trim();
    if (q) {
      params.push(q);
      const idx = params.length;
      clauses.push(
        `(p.quote_code ILIKE '%' || $${idx} || '%'
          OR COALESCE(p.title, '') ILIKE '%' || $${idx} || '%'
          OR COALESCE(c.name, '') ILIKE '%' || $${idx} || '%'
          OR COALESCE(p.lead_id::text, '') ILIKE '%' || $${idx} || '%')`,
      );
    }
    if (truthy(query.pending_my_approval)) {
      clauses.push(`p.status = 'pending_approval'`);
    }
    if (truthy(query.expiring)) {
      const open = QT_OPEN_STATUSES.map((s) => `'${s}'`).join(', ');
      clauses.push(
        `COALESCE(v.valid_until, NULLIF(p.valid_until, '')::timestamptz)
           BETWEEN now() AND now() + INTERVAL '7 days'
         AND p.status IN (${open})`,
      );
    }

    const bound = bindScope(
      qtScopeSql({
        scope: query.scope,
        staffId: query.staffId,
        teamIds: query.teamIds,
      }),
      params.length + 1,
    );
    clauses.push(bound.sql);
    params.push(...bound.params);
    return { where: clauses.join(' AND '), params };
  }

  private mapRow(row: Record<string, unknown>, hasFinance: boolean): QuoteListItem {
    const leadId = finiteNumber(row.lead_id);
    return {
      id: Number(row.id ?? 0),
      quote_code: row.quote_code == null ? null : String(row.quote_code),
      version_n: finiteNumber(row.n ?? row.version_n),
      client_name: row.client_name == null ? null : String(row.client_name),
      lead_code: leadCode(leadId),
      option: null,
      payable_vnd: finiteNumber(row.payable_vnd),
      fee_vnd: finiteNumber(row.fee_vnd),
      gm_bps: hasFinance ? finiteNumber(row.gm_bps) : null,
      status: asStatus(row.status),
      valid_until:
        row.valid_until != null && row.valid_until !== ''
          ? String(row.valid_until)
          : row.proposal_valid_until != null && row.proposal_valid_until !== ''
            ? String(row.proposal_valid_until)
            : null,
      owner: {
        staff_id: finiteNumber(row.owner_staff_id),
        name: row.owner_name == null ? null : String(row.owner_name),
      },
    };
  }
}
