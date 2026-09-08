import { Inject, Injectable } from '@nestjs/common';
import {
  QT_QUOTE_QUERY,
  QuoteActivityListQuery,
  QuoteActivityRow,
  QuoteAuditRepository,
  QuoteQueryPort,
} from './quote-audit.repository';
import { QT_TENANT_ID } from './quote-settings.repository';
import { qtScopeSql } from './quote-scope.util';
import {
  emptyKpis,
  QT_KPI_KEYS,
  type QuoteScope,
  type QuoteStatus,
} from './quote.types';

export const QT_WIN_RATE_FORMULA = 'accepted/(accepted+rejected)' as const;

export const QT_OPEN_STATUSES: readonly QuoteStatus[] = [
  'draft',
  'in_review',
  'pending_approval',
  'returned',
  'approved',
  'sent',
  'viewed',
  'negotiation',
];

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

export type QuoteOverviewQuery = {
  scope: QuoteScope;
  staffId: number;
  teamIds: number[];
  hasFinance: boolean;
  from?: string;
  to?: string;
  owner?: string;
};

export type QuoteActionRow = {
  severity: string;
  title: string;
  impact: string;
  owner_staff_id: number | null;
  sla: string | null;
  href: string;
  resource_type: string;
  resource_id: string;
};

export type QuoteOverview = {
  last_updated: string;
  kpis: ReturnType<typeof emptyKpis>;
  win_rate_formula: typeof QT_WIN_RATE_FORMULA;
  by_status: Array<{ status: QuoteStatus; count: number; payable_vnd: number | null }>;
  health: {
    below_floor: number;
    discount_over_cap: number;
    cost_missing: number;
    viewed_no_reply: number;
  };
};

type QuoteRow = {
  id: number;
  status: QuoteStatus;
  quote_code: string | null;
  owner_staff_id: number | null;
  payable_vnd: number | null;
  nsr_vnd: number | null;
  direct_cost_vnd: number | null;
  gm_bps: number | null;
  discount_vnd: number;
  fee_vnd: number;
  media_vnd: number;
  valid_until: string | null;
  version_state: string | null;
  updated_at: string | null;
};

type CommercialSettings = { gm_floor_bps: number; discount_auto_bps: number };

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStatus(value: unknown): QuoteStatus {
  const status = String(value ?? 'draft');
  return (ALL_STATUSES as string[]).includes(status) ? (status as QuoteStatus) : 'draft';
}

function mapQuoteRow(row: Record<string, unknown>): QuoteRow {
  return {
    id: Number(row.id ?? 0),
    status: asStatus(row.status),
    quote_code: row.quote_code == null ? null : String(row.quote_code),
    owner_staff_id: finiteNumber(row.owner_staff_id),
    payable_vnd: finiteNumber(row.payable_vnd),
    nsr_vnd: finiteNumber(row.nsr_vnd),
    direct_cost_vnd: finiteNumber(row.direct_cost_vnd),
    gm_bps: finiteNumber(row.gm_bps),
    discount_vnd: finiteNumber(row.discount_vnd) ?? 0,
    fee_vnd: finiteNumber(row.fee_vnd) ?? 0,
    media_vnd: finiteNumber(row.media_vnd) ?? 0,
    valid_until:
      row.valid_until != null && row.valid_until !== ''
        ? String(row.valid_until)
        : row.proposal_valid_until != null && row.proposal_valid_until !== ''
          ? String(row.proposal_valid_until)
          : null,
    version_state: row.version_state == null ? null : String(row.version_state),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
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

function isOpen(status: QuoteStatus): boolean {
  return QT_OPEN_STATUSES.includes(status);
}

function daysUntil(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return Math.ceil((at - now) / 86_400_000);
}

function hoursSince(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return (now - at) / 3_600_000;
}

function discountOverCap(row: QuoteRow, capBps: number): boolean {
  const base = row.fee_vnd + row.media_vnd;
  if (base <= 0 || row.discount_vnd <= 0) return false;
  return row.discount_vnd * 10000 > base * capBps;
}

function computeKpis(rows: QuoteRow[], hasFinance: boolean): ReturnType<typeof emptyKpis> {
  const kpis = emptyKpis();
  kpis.pending_approval_count = rows.filter(
    (row) => row.status === 'pending_approval' || row.version_state === 'submitted',
  ).length;

  const open = rows.filter((row) => isOpen(row.status));
  if (open.length === 0) {
    kpis.open_quote_value = null;
  } else {
    kpis.open_quote_value = open.reduce((sum, row) => sum + (row.payable_vnd ?? 0), 0);
  }

  const accepted = rows.filter((row) => row.status === 'accepted').length;
  const rejected = rows.filter((row) => row.status === 'rejected').length;
  const decided = accepted + rejected;
  kpis.quote_win_rate = decided > 0 ? accepted / decided : null;

  if (!hasFinance) {
    kpis.forecast_gross_margin = null;
    return kpis;
  }

  const withNsr = open.filter((row) => row.nsr_vnd != null && row.nsr_vnd > 0);
  if (withNsr.length) {
    const nsr = withNsr.reduce((sum, row) => sum + (row.nsr_vnd ?? 0), 0);
    const cost = withNsr.reduce((sum, row) => sum + (row.direct_cost_vnd ?? 0), 0);
    kpis.forecast_gross_margin = nsr > 0 ? (nsr - cost) / nsr : null;
    return kpis;
  }
  const withGm = open.filter((row) => row.gm_bps != null);
  kpis.forecast_gross_margin = withGm.length
    ? withGm.reduce((sum, row) => sum + (row.gm_bps ?? 0), 0) / withGm.length / 10000
    : null;
  return kpis;
}

function computeByStatus(rows: QuoteRow[]): QuoteOverview['by_status'] {
  return ALL_STATUSES.map((status) => {
    const group = rows.filter((row) => row.status === status);
    if (!group.length) return { status, count: 0, payable_vnd: null };
    const money = group
      .map((row) => row.payable_vnd)
      .filter((value): value is number => value != null);
    return {
      status,
      count: group.length,
      payable_vnd: money.length ? money.reduce((sum, value) => sum + value, 0) : null,
    };
  });
}

function computeHealth(rows: QuoteRow[], settings: CommercialSettings): QuoteOverview['health'] {
  const open = rows.filter((row) => isOpen(row.status));
  return {
    below_floor: open.filter(
      (row) => row.gm_bps != null && row.gm_bps < settings.gm_floor_bps,
    ).length,
    discount_over_cap: open.filter((row) => discountOverCap(row, settings.discount_auto_bps)).length,
    cost_missing: open.filter((row) => row.direct_cost_vnd == null).length,
    viewed_no_reply: rows.filter((row) => row.status === 'viewed').length,
  };
}

function quoteHref(id: number): string {
  return `/crm/proposals/${id}`;
}

function actionFor(row: QuoteRow, settings: CommercialSettings): QuoteActionRow[] {
  const actions: QuoteActionRow[] = [];
  const code = row.quote_code ?? `quote #${row.id}`;
  const base = {
    owner_staff_id: row.owner_staff_id,
    href: quoteHref(row.id),
    resource_type: 'quote',
    resource_id: String(row.id),
  };

  if (row.status === 'pending_approval' || row.version_state === 'submitted') {
    const age = hoursSince(row.updated_at);
    actions.push({
      ...base,
      severity: age != null && age >= 24 ? 'critical' : 'high',
      title: `${code} chờ phê duyệt`,
      impact: 'pending_approval',
      sla: age != null && age >= 24 ? `+${Math.floor(age)}h` : '24h',
    });
  }

  const until = daysUntil(row.valid_until);
  if (until != null && until <= 7 && isOpen(row.status)) {
    actions.push({
      ...base,
      severity: until <= 3 ? 'high' : 'medium',
      title: `${code} hết hạn`,
      impact: `valid_until ${until}d`,
      sla: `${until}d`,
    });
  }

  if (row.status === 'viewed') {
    actions.push({
      ...base,
      severity: 'high',
      title: `${code} đã xem chưa phản hồi`,
      impact: 'viewed_no_reply',
      sla: '48h',
    });
  }

  if (isOpen(row.status) && row.direct_cost_vnd == null) {
    actions.push({
      ...base,
      severity: 'medium',
      title: `${code} thiếu cost`,
      impact: 'cost_missing',
      sla: null,
    });
  }

  if (isOpen(row.status) && discountOverCap(row, settings.discount_auto_bps)) {
    actions.push({
      ...base,
      severity: 'medium',
      title: `${code} discount vượt cap`,
      impact: 'discount_over_cap',
      sla: '12h',
    });
  }

  if (isOpen(row.status) && row.gm_bps != null && row.gm_bps < settings.gm_floor_bps) {
    actions.push({
      ...base,
      severity: 'critical',
      title: `${code} GM dưới floor`,
      impact: 'below_floor',
      sla: null,
    });
  }

  return actions;
}

function stripNsr<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, inner) => (key.toLowerCase().includes('nsr') ? undefined : inner)),
  ) as T;
}

export function toActivityCsv(items: QuoteActivityRow[]): string {
  const header = 'created_at,actor_staff_id,actor_kind,action,resource,snapshot';
  const lines = items.map((item) =>
    [
      item.created_at,
      item.actor_staff_id ?? '',
      item.actor_kind,
      item.action,
      item.resource ?? '',
      JSON.stringify(item.snapshot).replaceAll('"', '""'),
    ]
      .map((cell) => `"${cell}"`)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

@Injectable()
export class QuoteOverviewService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly audit: QuoteAuditRepository,
  ) {}

  async getOverview(query: QuoteOverviewQuery): Promise<QuoteOverview> {
    const [rows, settings] = await Promise.all([
      this.loadQuotes(query),
      this.loadSettings(),
    ]);
    const kpis = computeKpis(rows, query.hasFinance);
    for (const key of QT_KPI_KEYS) {
      if (!(key in kpis)) kpis[key] = null;
    }
    return stripNsr({
      last_updated: new Date().toISOString(),
      kpis,
      win_rate_formula: QT_WIN_RATE_FORMULA,
      by_status: computeByStatus(rows),
      health: computeHealth(rows, settings),
    });
  }

  async getActions(query: QuoteOverviewQuery): Promise<QuoteActionRow[]> {
    const [rows, settings] = await Promise.all([
      this.loadQuotes(query),
      this.loadSettings(),
    ]);
    return rows.flatMap((row) => actionFor(row, settings));
  }

  async listActivity(
    query: QuoteActivityListQuery = {},
  ): Promise<{ items: QuoteActivityRow[] }> {
    return { items: await this.audit.list(query) };
  }

  private async loadSettings(): Promise<CommercialSettings> {
    const result = await this.db.query(
      `SELECT gm_floor_bps, discount_auto_bps
         FROM crm_quote_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [QT_TENANT_ID],
    );
    const row = result.rows[0] ?? {};
    return {
      gm_floor_bps: finiteNumber(row.gm_floor_bps) ?? 2500,
      discount_auto_bps: finiteNumber(row.discount_auto_bps) ?? 500,
    };
  }

  private async loadQuotes(query: QuoteOverviewQuery): Promise<QuoteRow[]> {
    const scope = bindScope(
      qtScopeSql({
        scope: query.scope,
        staffId: query.staffId,
        teamIds: query.teamIds,
      }),
      4,
    );
    const result = await this.db.query(
      `SELECT p.id, p.status, p.owner_staff_id, p.quote_code, p.updated_at,
              p.valid_until AS proposal_valid_until,
              v.payable_vnd, v.nsr_vnd, v.direct_cost_vnd, v.gm_bps,
              v.discount_vnd, v.fee_vnd, v.media_vnd, v.valid_until,
              v.state AS version_state
         FROM crm_proposals p
         LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
        WHERE ${scope.sql}
          AND ($1::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                >= $1::timestamptz)
          AND ($2::text IS NULL OR COALESCE(v.created_at, NULLIF(p.created_at, '')::timestamptz)
                < $2::timestamptz + INTERVAL '1 day')
          AND ($3::text IS NULL OR p.owner_staff_id::text = $3)
        ORDER BY p.id DESC`,
      [query.from ?? null, query.to ?? null, query.owner ?? null, ...scope.params],
    );
    return result.rows.map(mapQuoteRow);
  }
}
