import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';

export const AM_MAX_SAVED_VIEWS = 10;

export type AmSavedView = {
  id: string;
  name: string;
  shared: boolean;
  page: string;
  query_json: Record<string, unknown>;
  owner_staff_id: number;
  created_at: string;
};

export type AmCreateViewBody = {
  name: string;
  shared?: boolean;
  page?: string;
  query_json?: Record<string, unknown>;
};

export type AmViewActor = {
  staffId: number;
  caps: StaffSectionCap[];
};

export type AmViewsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function asQueryJson(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function mapView(row: Record<string, unknown>): AmSavedView {
  const created = row.created_at;
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    shared: Boolean(row.shared),
    page: String(row.page ?? 'accounts'),
    query_json: asQueryJson(row.query_json),
    owner_staff_id: Number(row.owner_staff_id ?? 0),
    created_at:
      created instanceof Date ? created.toISOString() : String(created ?? ''),
  };
}

@Injectable()
export class AmViewsRepository implements OnModuleDestroy, AmViewsDb {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> {
    return this.db.query(sql, params);
  }
}

@Injectable()
export class AmViewsService {
  constructor(
    private readonly db: AmViewsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  canShare(caps: StaffSectionCap[]): boolean {
    const has = (action: string) => this.staffAuth.hasCap(caps ?? [], 'crm_am', action);
    return has('manage') || (has('assign') && has('view_all'));
  }

  async list(staffId: number): Promise<{ items: AmSavedView[] }> {
    if (staffId <= 0) return { items: [] };
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, name, shared, page, query_json, owner_staff_id, created_at
           FROM crm_am_saved_views
          WHERE tenant_id = $1 AND (owner_staff_id = $2 OR shared = TRUE)
          ORDER BY shared ASC, created_at DESC`,
        [AM_TENANT_ID, staffId],
      );
      return { items: result.rows.map((row) => mapView(row)) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async create(body: AmCreateViewBody, actor: AmViewActor): Promise<AmSavedView> {
    const name = String(body.name ?? '').trim();
    if (!name) amThrow(400, { error: 'name_required' });
    const shared = Boolean(body.shared);
    if (shared && !this.canShare(actor.caps ?? [])) {
      amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'manage' });
    }
    const page = String(body.page ?? 'accounts').trim() || 'accounts';
    const queryJson = asQueryJson(body.query_json);
    const count = await this.countOwn(actor.staffId);
    if (count >= AM_MAX_SAVED_VIEWS) {
      amThrow(400, { error: 'view_limit', max: AM_MAX_SAVED_VIEWS });
    }
    const result = await this.db.query(
      `INSERT INTO crm_am_saved_views (
         tenant_id, owner_staff_id, name, shared, page, query_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id::text AS id, name, shared, page, query_json, owner_staff_id, created_at`,
      [AM_TENANT_ID, actor.staffId, name, shared, page, JSON.stringify(queryJson)],
    );
    const row = result.rows[0];
    if (!row) amThrow(500, { error: 'view_insert_failed' });
    return mapView(row);
  }

  private async countOwn(staffId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count
         FROM crm_am_saved_views
        WHERE tenant_id = $1 AND owner_staff_id = $2`,
      [AM_TENANT_ID, staffId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
