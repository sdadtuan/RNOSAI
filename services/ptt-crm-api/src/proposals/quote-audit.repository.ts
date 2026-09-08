import { Inject, Injectable } from '@nestjs/common';
import { QT_TENANT_ID } from './quote-settings.repository';

export const QT_QUOTE_QUERY = 'QT_QUOTE_QUERY';

export interface QuoteQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type QuoteActivityInsert = {
  proposal_id: number;
  version_id?: string | null;
  actor_staff_id?: number | null;
  actor_kind?: string;
  action: string;
  resource?: string | null;
  snapshot_json?: Record<string, unknown> | null;
};

export type QuoteActivityRow = {
  id: string;
  proposal_id: number;
  version_id: string | null;
  actor_staff_id: number | null;
  actor_kind: string;
  action: string;
  resource: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
};

export type QuoteActivityListQuery = {
  proposal_id?: number;
  actor_staff_id?: number;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
};

const SECRET_KEY = /otp|token/i;

export function sanitizeActivitySnapshot(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeActivitySnapshot(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
  }
  return new Date().toISOString();
}

function mapActivity(row: Record<string, unknown>): QuoteActivityRow {
  return {
    id: String(row.id ?? ''),
    proposal_id: Number(row.proposal_id ?? 0),
    version_id: row.version_id == null ? null : String(row.version_id),
    actor_staff_id: row.actor_staff_id == null ? null : Number(row.actor_staff_id),
    actor_kind: String(row.actor_kind ?? 'staff'),
    action: String(row.action ?? ''),
    resource: row.resource == null ? null : String(row.resource),
    snapshot: sanitizeActivitySnapshot(row.snapshot_json ?? row.snapshot ?? {}),
    created_at: iso(row.created_at),
  };
}

@Injectable()
export class QuoteAuditRepository {
  constructor(@Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort) {}

  async insert(input: QuoteActivityInsert): Promise<QuoteActivityRow> {
    const snapshot = sanitizeActivitySnapshot(input.snapshot_json ?? {});
    const result = await this.db.query(
      `INSERT INTO crm_quote_activity (
         tenant_id, proposal_id, version_id, actor_staff_id, actor_kind, action, resource, snapshot_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, proposal_id, version_id, actor_staff_id, actor_kind, action, resource,
                 snapshot_json, created_at`,
      [
        QT_TENANT_ID,
        input.proposal_id,
        input.version_id ?? null,
        input.actor_staff_id ?? null,
        input.actor_kind ?? 'staff',
        input.action,
        input.resource ?? null,
        snapshot,
      ],
    );
    return mapActivity(
      result.rows[0] ?? {
        proposal_id: input.proposal_id,
        action: input.action,
        snapshot_json: snapshot,
      },
    );
  }

  async list(query: QuoteActivityListQuery = {}): Promise<QuoteActivityRow[]> {
    const params: unknown[] = [QT_TENANT_ID];
    const where = ['tenant_id = $1'];
    if (query.proposal_id != null) {
      params.push(query.proposal_id);
      where.push(`proposal_id = $${params.length}`);
    }
    if (query.actor_staff_id != null) {
      params.push(query.actor_staff_id);
      where.push(`actor_staff_id = $${params.length}`);
    }
    if (query.action) {
      params.push(query.action);
      where.push(`action = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      where.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (query.to) {
      params.push(query.to);
      where.push(`created_at < $${params.length}::timestamptz + INTERVAL '1 day'`);
    }
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    params.push(limit);
    const result = await this.db.query(
      `SELECT id, proposal_id, version_id, actor_staff_id, actor_kind, action, resource,
              snapshot_json, created_at
         FROM crm_quote_activity
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return result.rows.map(mapActivity);
  }
}
