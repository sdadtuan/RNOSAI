import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { isUuid } from './am-tasks.service';

export type AmDelegation = {
  id: string;
  from_staff_id: number;
  to_staff_id: number;
  starts_on: string;
  ends_on: string;
  reason: string | null;
};

export type AmCreateDelegationInput = {
  from_staff_id?: number;
  to_staff_id: number;
  starts_on: string;
  ends_on: string;
  reason?: string;
};

export type AmDelegationStaff = {
  id: number;
  email: string;
  display_name: string;
};

export type AmDelegationsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const DELEGATION_RETURNING = `
  id::text AS id,
  from_staff_id,
  to_staff_id,
  starts_on,
  ends_on,
  reason
`;

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function dayStr(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value ?? '');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function staffId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function requireDay(raw: unknown, error: string): string {
  const day = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) amThrow(400, { error });
  return day;
}

function mapDelegation(row: Record<string, unknown>): AmDelegation {
  return {
    id: String(row.id ?? ''),
    from_staff_id: Number(row.from_staff_id ?? 0),
    to_staff_id: Number(row.to_staff_id ?? 0),
    starts_on: dayStr(row.starts_on),
    ends_on: dayStr(row.ends_on),
    reason: row.reason == null || row.reason === '' ? null : String(row.reason),
  };
}

@Injectable()
export class AmDelegationsRepository implements OnModuleDestroy, AmDelegationsDb {
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
export class AmDelegationsService {
  constructor(
    private readonly db: AmDelegationsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async list(
    actorStaffId: number,
    caps: StaffSectionCap[] = [],
  ): Promise<{ items: AmDelegation[]; staff: AmDelegationStaff[] }> {
    const canManage = this.canManage(caps);
    let items: AmDelegation[] = [];
    try {
      const result = await this.db.query(
        `SELECT ${DELEGATION_RETURNING}
           FROM crm_am_delegations
          WHERE tenant_id = $1
            AND ends_on >= CURRENT_DATE
            AND ($2 OR from_staff_id = $3 OR to_staff_id = $3)
          ORDER BY starts_on, ends_on, id`,
        [AM_TENANT_ID, canManage, actorStaffId],
      );
      items = result.rows.map(mapDelegation);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    return { items, staff: await this.listStaff() };
  }

  async create(
    input: AmCreateDelegationInput,
    actorStaffId: number,
    caps: StaffSectionCap[] = [],
  ): Promise<AmDelegation> {
    const toRaw = staffId(input.to_staff_id);
    if (toRaw == null) amThrow(400, { error: 'to_staff_id_invalid' });
    const fromProvided = input.from_staff_id != null;
    const fromRaw = fromProvided ? staffId(input.from_staff_id) : actorStaffId;
    if (fromRaw == null || fromRaw <= 0) amThrow(400, { error: 'from_staff_id_invalid' });
    if (fromRaw === toRaw) amThrow(400, { error: 'delegation_self' });

    const canManage = this.canManage(caps);
    if (fromRaw !== actorStaffId && !canManage) {
      amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'manage' });
    }

    const startsOn = requireDay(input.starts_on, 'invalid_starts_on');
    const endsOn = requireDay(input.ends_on, 'invalid_ends_on');
    if (endsOn < startsOn) amThrow(400, { error: 'ends_before_starts' });

    const toStaffId = await this.requireCrmStaffId(toRaw, 'to_staff_id');
    const fromStaffId =
      fromRaw === actorStaffId && !fromProvided
        ? fromRaw
        : await this.requireCrmStaffId(fromRaw, 'from_staff_id');
    if (fromStaffId === toStaffId) amThrow(400, { error: 'delegation_self' });

    const reason = String(input.reason ?? '').trim() || null;
    try {
      const inserted = await this.db.query(
        `INSERT INTO crm_am_delegations (
           tenant_id, from_staff_id, to_staff_id, starts_on, ends_on, reason, created_by_staff_id
         ) VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
         RETURNING ${DELEGATION_RETURNING}`,
        [AM_TENANT_ID, fromStaffId, toStaffId, startsOn, endsOn, reason, actorStaffId > 0 ? actorStaffId : fromStaffId],
      );
      const row = inserted.rows[0];
      if (!row) amThrow(500, { error: 'insert_failed' });
      return mapDelegation(row);
    } catch (err) {
      if (isMissingRelation(err)) amThrow(503, { error: 'delegations_table_missing' });
      throw err;
    }
  }

  async cancel(id: string, actorStaffId: number, caps: StaffSectionCap[] = []): Promise<AmDelegation> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_delegation_id' });
    const canManage = this.canManage(caps);
    try {
      const current = await this.db.query(
        `SELECT ${DELEGATION_RETURNING}
           FROM crm_am_delegations
          WHERE tenant_id = $1 AND id = $2::uuid
          LIMIT 1`,
        [AM_TENANT_ID, id],
      );
      const row = current.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      const mapped = mapDelegation(row);
      if (!canManage && mapped.from_staff_id !== actorStaffId) {
        amThrow(403, { error: 'missing_cap', section: 'crm_am', action: 'manage' });
      }
      const updated = await this.db.query(
        `UPDATE crm_am_delegations
            SET starts_on = LEAST(starts_on, (CURRENT_DATE - 1)),
                ends_on = (CURRENT_DATE - 1)
          WHERE tenant_id = $1
            AND id = $2::uuid
            AND ends_on >= CURRENT_DATE
          RETURNING ${DELEGATION_RETURNING}`,
        [AM_TENANT_ID, id],
      );
      const next = updated.rows[0];
      if (!next) amThrow(409, { error: 'already_ended' });
      return mapDelegation(next);
    } catch (err) {
      if (isMissingRelation(err)) amThrow(503, { error: 'delegations_table_missing' });
      throw err;
    }
  }

  private canManage(caps: StaffSectionCap[]): boolean {
    return this.staffAuth.hasCap(caps, 'crm_am', 'manage');
  }

  private async listStaff(): Promise<AmDelegationStaff[]> {
    try {
      const result = await this.db.query(
        `SELECT cs.id,
                cs.email,
                COALESCE(NULLIF(trim(cs.name), ''), NULLIF(trim(u.display_name), ''), cs.email) AS display_name
           FROM crm_staff cs
           LEFT JOIN staff_users u ON lower(trim(cs.email)) = lower(trim(u.email))
          WHERE cs.active = TRUE
            AND cs.email IS NOT NULL
            AND trim(cs.email) <> ''
          ORDER BY display_name, cs.id`,
      );
      return result.rows
        .map((row) => {
          const id = staffId(row.id);
          if (id == null) return null;
          return {
            id,
            email: String(row.email ?? ''),
            display_name: String(row.display_name ?? row.email ?? ''),
          };
        })
        .filter((row): row is AmDelegationStaff => row != null);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      return [];
    }
  }

  private async requireCrmStaffId(rawId: number, field: string): Promise<number> {
    try {
      const direct = await this.db.query(`SELECT id FROM crm_staff WHERE id = $1 LIMIT 1`, [rawId]);
      const directId = staffId(direct.rows[0]?.id);
      if (directId) return directId;
      const mapped = await this.db.query(
        `SELECT cs.id
           FROM staff_users u
           JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
          WHERE u.id = $1
          LIMIT 1`,
        [rawId],
      );
      const mappedId = staffId(mapped.rows[0]?.id);
      if (mappedId) return mappedId;
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    amThrow(400, { error: `${field}_invalid` });
  }
}
