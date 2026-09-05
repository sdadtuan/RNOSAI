import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { computeAmSlaDues } from './am-sla.util';
import { isUuid } from './am-tasks.service';

export const AM_SLA_DEFAULT_ESCALATE: Record<string, string> = {
  '70': 'lead',
  '90': 'director',
  '100': 'executive',
};

export const AM_SLA_DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export type AmSlaPolicy = {
  id: string;
  name: string;
  first_response_minutes: number;
  resolve_minutes: number;
  pause_on_waiting_client: boolean;
  escalate_json: Record<string, string>;
  workday_start: string;
  workday_end: string;
  workdays: number[];
  holidays: string[];
};

export type AmCreateSlaInput = {
  name?: string;
  first_response_minutes?: number;
  resolve_minutes?: number;
  pause_on_waiting_client?: boolean;
  escalate_json?: Record<string, string>;
  workday_start?: string;
  workday_end?: string;
  workdays?: number[];
  holidays?: string[];
};

export type AmPatchSlaInput = Partial<AmCreateSlaInput>;

export type AmSlaPoliciesDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const SLA_COLS = `
  id::text AS id,
  name,
  first_response_minutes,
  resolve_minutes,
  pause_on_waiting_client,
  escalate_json,
  workday_start,
  workday_end,
  workdays,
  holidays
`;

@Injectable()
export class AmSlaPoliciesRepository implements OnModuleDestroy, AmSlaPoliciesDb {
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
export class AmSlaPoliciesService {
  constructor(
    private readonly db: AmSlaPoliciesRepository,
    private readonly audit: AmAuditRepository,
  ) {}

  async list(): Promise<{ items: AmSlaPolicy[] }> {
    try {
      const result = await this.db.query(
        `SELECT ${SLA_COLS}
           FROM crm_am_sla_policies
          WHERE tenant_id = $1
          ORDER BY name ASC`,
        [AM_TENANT_ID],
      );
      return { items: result.rows.map(mapPolicy) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async get(id: string): Promise<AmSlaPolicy> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_sla_policy_id' });
    try {
      const result = await this.db.query(
        `SELECT ${SLA_COLS}
           FROM crm_am_sla_policies
          WHERE tenant_id = $1 AND id = $2::uuid
          LIMIT 1`,
        [AM_TENANT_ID, id],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return mapPolicy(row);
    } catch (err) {
      if ((err as { status?: number }).status) throw err;
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
      throw err;
    }
  }

  async create(body: AmCreateSlaInput, staffId = 0): Promise<AmSlaPolicy> {
    const row = normalizeSla(body, null);
    const result = await this.db.query(
      `INSERT INTO crm_am_sla_policies (
         tenant_id, name, first_response_minutes, resolve_minutes,
         pause_on_waiting_client, escalate_json, workday_start, workday_end,
         workdays, holidays
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${SLA_COLS}`,
      [
        AM_TENANT_ID,
        row.name,
        row.first_response_minutes,
        row.resolve_minutes,
        row.pause_on_waiting_client,
        row.escalate_json,
        row.workday_start,
        row.workday_end,
        row.workdays,
        row.holidays,
      ],
    );
    const created = mapPolicy(result.rows[0] ?? row);
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'sla.create',
      entity_type: 'sla_policy',
      entity_id: created.id,
      payload_json: { name: created.name },
    });
    return created;
  }

  async patch(id: string, body: AmPatchSlaInput, staffId = 0): Promise<AmSlaPolicy> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_sla_policy_id' });
    const existing = await this.get(id);
    const row = normalizeSla(body, existing);
    const result = await this.db.query(
      `UPDATE crm_am_sla_policies
          SET name = $3,
              first_response_minutes = $4,
              resolve_minutes = $5,
              pause_on_waiting_client = $6,
              escalate_json = $7,
              workday_start = $8,
              workday_end = $9,
              workdays = $10,
              holidays = $11
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING ${SLA_COLS}`,
      [
        AM_TENANT_ID,
        id,
        row.name,
        row.first_response_minutes,
        row.resolve_minutes,
        row.pause_on_waiting_client,
        row.escalate_json,
        row.workday_start,
        row.workday_end,
        row.workdays,
        row.holidays,
      ],
    );
    const outRow = result.rows[0];
    if (!outRow) amThrow(404, { error: 'not_found' });
    const out = mapPolicy(outRow);
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'sla.patch',
      entity_type: 'sla_policy',
      entity_id: out.id,
      payload_json: { name: out.name, holidays: out.holidays },
    });
    return out;
  }

  computeDues(policy: AmSlaPolicy, from = new Date()) {
    return computeAmSlaDues(from, policy);
  }
}

function normalizeSla(body: AmCreateSlaInput, existing: AmSlaPolicy | null): Omit<AmSlaPolicy, 'id'> {
  const name = String(body.name ?? existing?.name ?? '').trim();
  if (!name) amThrow(400, { error: 'name_required' });
  const first =
    body.first_response_minutes != null
      ? requireMinutes(body.first_response_minutes, 'invalid_first_response_minutes')
      : existing?.first_response_minutes;
  const resolve =
    body.resolve_minutes != null
      ? requireMinutes(body.resolve_minutes, 'invalid_resolve_minutes')
      : existing?.resolve_minutes;
  if (first == null) amThrow(400, { error: 'first_response_minutes_required' });
  if (resolve == null) amThrow(400, { error: 'resolve_minutes_required' });
  return {
    name,
    first_response_minutes: first,
    resolve_minutes: resolve,
    pause_on_waiting_client:
      body.pause_on_waiting_client != null
        ? Boolean(body.pause_on_waiting_client)
        : (existing?.pause_on_waiting_client ?? true),
    escalate_json: parseEscalate(body.escalate_json, existing?.escalate_json),
    workday_start: parseClock(body.workday_start, existing?.workday_start ?? '08:30'),
    workday_end: parseClock(body.workday_end, existing?.workday_end ?? '17:30'),
    workdays: parseWorkdays(body.workdays, existing?.workdays ?? AM_SLA_DEFAULT_WORKDAYS),
    holidays: parseHolidays(body.holidays, existing?.holidays ?? []),
  };
}

function mapPolicy(row: Record<string, unknown>): AmSlaPolicy {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    first_response_minutes: Number(row.first_response_minutes ?? 0),
    resolve_minutes: Number(row.resolve_minutes ?? 0),
    pause_on_waiting_client: row.pause_on_waiting_client !== false,
    escalate_json: parseEscalate(row.escalate_json, AM_SLA_DEFAULT_ESCALATE),
    workday_start: parseClock(row.workday_start, '08:30'),
    workday_end: parseClock(row.workday_end, '17:30'),
    workdays: parseWorkdays(row.workdays, AM_SLA_DEFAULT_WORKDAYS),
    holidays: parseHolidays(row.holidays, []),
  };
}

function requireMinutes(raw: unknown, error: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) amThrow(400, { error });
  return n;
}

function parseClock(raw: unknown, fallback: string): string {
  if (raw == null || String(raw).trim() === '') return fallback;
  const value = String(raw).trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(value)) amThrow(400, { error: 'invalid_workday_clock' });
  return value;
}

function parseWorkdays(raw: unknown, fallback: number[]): number[] {
  if (raw == null) return fallback;
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const days = raw.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return days.length ? days : fallback;
}

function parseHolidays(raw: unknown, fallback: string[]): string[] {
  if (raw == null) return fallback;
  if (!Array.isArray(raw)) amThrow(400, { error: 'invalid_holidays' });
  const dates = raw
    .map((value) => {
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      const s = String(value ?? '').trim();
      return s.length >= 10 ? s.slice(0, 10) : '';
    })
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  return [...new Set(dates)];
}

function parseEscalate(
  raw: unknown,
  fallback: Record<string, string> = AM_SLA_DEFAULT_ESCALATE,
): Record<string, string> {
  if (raw == null || raw === '') return { ...fallback };
  const obj = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ...fallback };
  const out: Record<string, string> = { ...fallback };
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value != null && String(value).trim() !== '') out[key] = String(value).trim();
  }
  return out;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}
