import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export const AM_FIELD_TYPES = ['text', 'number', 'date', 'bool', 'select'] as const;
export type AmFieldType = (typeof AM_FIELD_TYPES)[number];
const API_KEY_RE = /^[a-z][a-z0-9_]*$/;

export type AmCustomField = {
  id: string;
  api_key: string;
  label: string;
  field_type: AmFieldType;
  industry_slug: string | null;
  required: boolean;
  filterable: boolean;
  reportable: boolean;
  access_json: AmFieldAccess | null;
  constraints_json: AmFieldConstraints | null;
  published: boolean;
};

export type AmFieldAccess = { view?: string[]; edit?: string[] };
export type AmFieldConstraints = { min?: number; max?: number };

export type AmCreateFieldInput = {
  label?: string;
  api_key?: string;
  field_type?: string;
  industry_slug?: string | null;
  required?: boolean;
  filterable?: boolean;
  reportable?: boolean;
  access_json?: AmFieldAccess | null;
  constraints_json?: AmFieldConstraints | null;
};

export type AmPatchFieldInput = Partial<AmCreateFieldInput>;

export type AmFieldValuesBody = { values?: Record<string, unknown> };

export type AmFieldValuesOut = { values: Record<string, unknown> };

export type AmFieldsReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmFieldsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const FIELD_COLS = `
  id::text AS id,
  api_key,
  label,
  field_type,
  industry_slug,
  required,
  filterable,
  reportable,
  access_json,
  constraints_json,
  published
`;

@Injectable()
export class AmFieldsRepository implements OnModuleDestroy, AmFieldsDb {
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
export class AmFieldsService {
  constructor(
    private readonly db: AmFieldsRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
  ) {}

  async list(industry?: string): Promise<{ items: AmCustomField[] }> {
    const slug = industry != null && String(industry).trim() !== '' ? String(industry).trim() : null;
    const params: unknown[] = [AM_TENANT_ID];
    let sql = `SELECT ${FIELD_COLS}
           FROM crm_am_custom_fields
          WHERE tenant_id = $1`;
    if (slug) {
      params.push(slug);
      sql += ` AND (industry_slug IS NULL OR industry_slug = $${params.length})`;
    }
    sql += ' ORDER BY label ASC, api_key ASC';
    try {
      const result = await this.db.query(sql, params);
      return { items: result.rows.map(mapField) };
    } catch (err) {
      if (isMissingRelation(err) || isMissingColumn(err)) return { items: [] };
      throw err;
    }
  }

  async create(body: AmCreateFieldInput, staffId = 0): Promise<AmCustomField> {
    const label = requireText(body.label, 'label_required');
    const apiKey = parseApiKey(body.api_key);
    const fieldType = parseFieldType(body.field_type);
    const row = {
      api_key: apiKey,
      label,
      field_type: fieldType,
      industry_slug: emptyToNull(body.industry_slug),
      required: Boolean(body.required),
      filterable: Boolean(body.filterable),
      reportable: Boolean(body.reportable),
      access_json: parseAccess(body.access_json),
      constraints_json: parseConstraints(body.constraints_json),
      published: false,
    };
    try {
      const result = await this.db.query(
        `INSERT INTO crm_am_custom_fields (
           tenant_id, api_key, label, field_type, industry_slug, required,
           filterable, reportable, access_json, constraints_json, published
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
         RETURNING ${FIELD_COLS}`,
        [
          AM_TENANT_ID,
          row.api_key,
          row.label,
          row.field_type,
          row.industry_slug,
          row.required,
          row.filterable,
          row.reportable,
          row.access_json,
          row.constraints_json,
        ],
      );
      const created = mapField(result.rows[0] ?? row);
      await this.audit.insert({
        actor_staff_id: staffId || null,
        action: 'field.create',
        entity_type: 'custom_field',
        entity_id: created.id,
        payload_json: { api_key: created.api_key },
      });
      return created;
    } catch (err) {
      if (isUniqueViolation(err)) amThrow(409, { error: 'api_key_taken' });
      throw err;
    }
  }

  async patch(id: string, body: AmPatchFieldInput, staffId = 0): Promise<AmCustomField> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_field_id' });
    const existing = await this.loadField(id);
    if (body.api_key != null && String(body.api_key).trim() !== existing.api_key) {
      if (existing.published) amThrow(409, { error: 'api_key_immutable' });
    }
    const next = {
      api_key:
        body.api_key != null && String(body.api_key).trim() !== ''
          ? parseApiKey(body.api_key)
          : existing.api_key,
      label: body.label != null ? requireText(body.label, 'label_required') : existing.label,
      field_type: body.field_type != null ? parseFieldType(body.field_type) : existing.field_type,
      industry_slug:
        body.industry_slug !== undefined ? emptyToNull(body.industry_slug) : existing.industry_slug,
      required: body.required != null ? Boolean(body.required) : existing.required,
      filterable: body.filterable != null ? Boolean(body.filterable) : existing.filterable,
      reportable: body.reportable != null ? Boolean(body.reportable) : existing.reportable,
      access_json: body.access_json !== undefined ? parseAccess(body.access_json) : existing.access_json,
      constraints_json:
        body.constraints_json !== undefined
          ? parseConstraints(body.constraints_json)
          : existing.constraints_json,
    };
    try {
      const result = await this.db.query(
        `UPDATE crm_am_custom_fields
            SET api_key = $3,
                label = $4,
                field_type = $5,
                industry_slug = $6,
                required = $7,
                filterable = $8,
                reportable = $9,
                access_json = $10,
                constraints_json = $11
          WHERE tenant_id = $1 AND id = $2::uuid
          RETURNING ${FIELD_COLS}`,
        [
          AM_TENANT_ID,
          id,
          next.api_key,
          next.label,
          next.field_type,
          next.industry_slug,
          next.required,
          next.filterable,
          next.reportable,
          next.access_json,
          next.constraints_json,
        ],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      const out = mapField(row);
      await this.audit.insert({
        actor_staff_id: staffId || null,
        action: 'field.patch',
        entity_type: 'custom_field',
        entity_id: out.id,
        payload_json: { api_key: out.api_key },
      });
      return out;
    } catch (err) {
      if ((err as { status?: number }).status) throw err;
      if (isUniqueViolation(err)) amThrow(409, { error: 'api_key_taken' });
      throw err;
    }
  }

  async publish(id: string, staffId = 0): Promise<AmCustomField> {
    if (!isUuid(id)) amThrow(400, { error: 'invalid_field_id' });
    await this.loadField(id);
    const result = await this.db.query(
      `UPDATE crm_am_custom_fields
          SET published = TRUE
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING ${FIELD_COLS}`,
      [AM_TENANT_ID, id],
    );
    const row = result.rows[0];
    if (!row) amThrow(404, { error: 'not_found' });
    const out = mapField(row);
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'field.publish',
      entity_type: 'custom_field',
      entity_id: out.id,
      payload_json: { api_key: out.api_key },
    });
    return out;
  }

  async getValues(req: AmFieldsReq, agencyClientId: string): Promise<AmFieldValuesOut> {
    const clientId = requireClientId(agencyClientId);
    const actor = await this.resolveActor(req);
    const scoped = await this.requireScopedClient(actor, clientId);
    const fields = await this.loadIndustryFields(scoped.industry);
    const allowed = fields.filter((field) =>
      canAccessField(field, 'view', actor.caps, actor.internal),
    );
    const values = await this.readValues(clientId, allowed);
    return { values };
  }

  async putValues(
    req: AmFieldsReq,
    agencyClientId: string,
    body: AmFieldValuesBody,
  ): Promise<AmFieldValuesOut> {
    const clientId = requireClientId(agencyClientId);
    const actor = await this.resolveActor(req);
    const scoped = await this.requireScopedClient(actor, clientId);
    const fields = await this.loadIndustryFields(scoped.industry);
    const incoming = body?.values && typeof body.values === 'object' ? body.values : {};
    const byKey = new Map(fields.map((field) => [field.api_key, field]));
    const byId = new Map(fields.map((field) => [field.id, field]));

    for (const field of fields) {
      if (!field.required) continue;
      const raw = incoming[field.api_key] ?? incoming[field.id];
      if (isEmptyValue(raw)) amThrow(400, { error: 'field_required', api_key: field.api_key });
    }

    for (const [key, raw] of Object.entries(incoming)) {
      const field = byKey.get(key) ?? byId.get(key);
      if (!field) continue;
      if (!canAccessField(field, 'edit', actor.caps, actor.internal)) {
        amThrow(403, { error: 'field_forbidden', api_key: field.api_key });
      }
      const value = coerceValue(field, raw);
      await this.db.query(
        `INSERT INTO crm_am_field_values (agency_client_id, field_id, value_json)
         VALUES ($1::uuid, $2::uuid, $3::jsonb)
         ON CONFLICT (agency_client_id, field_id)
         DO UPDATE SET value_json = EXCLUDED.value_json`,
        [clientId, field.id, JSON.stringify(value)],
      );
    }

    const allowed = fields.filter((field) =>
      canAccessField(field, 'view', actor.caps, actor.internal),
    );
    return { values: await this.readValues(clientId, allowed) };
  }

  private async loadField(id: string): Promise<AmCustomField> {
    try {
      const result = await this.db.query(
        `SELECT ${FIELD_COLS}
           FROM crm_am_custom_fields
          WHERE tenant_id = $1 AND id = $2::uuid
          LIMIT 1`,
        [AM_TENANT_ID, id],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return mapField(row);
    } catch (err) {
      if ((err as { status?: number }).status) throw err;
      if (isMissingRelation(err) || isMissingColumn(err)) amThrow(404, { error: 'not_found' });
      throw err;
    }
  }

  private async loadIndustryFields(industry: string | null): Promise<AmCustomField[]> {
    const params: unknown[] = [AM_TENANT_ID];
    let sql = `SELECT ${FIELD_COLS}
           FROM crm_am_custom_fields
          WHERE tenant_id = $1 AND published IS TRUE`;
    if (industry) {
      params.push(industry);
      sql += ` AND (industry_slug IS NULL OR industry_slug = $${params.length})`;
    } else {
      sql += ' AND industry_slug IS NULL';
    }
    const result = await this.db.query(sql, params);
    return result.rows.map(mapField);
  }

  private async readValues(
    clientId: string,
    fields: AmCustomField[],
  ): Promise<Record<string, unknown>> {
    if (!fields.length) return {};
    const result = await this.db.query(
      `SELECT f.api_key, v.value_json
         FROM crm_am_field_values v
         JOIN crm_am_custom_fields f ON f.id = v.field_id
        WHERE v.agency_client_id = $1::uuid
          AND v.field_id = ANY($2::uuid[])`,
      [clientId, fields.map((field) => field.id)],
    );
    const out: Record<string, unknown> = {};
    for (const row of result.rows) {
      out[String(row.api_key)] = row.value_json;
    }
    return out;
  }

  private async requireScopedClient(
    actor: { scope: AmScope; staffId: number; teamIds: number[] },
    clientId: string,
  ): Promise<{ agency_client_id: string; industry: string | null }> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    try {
      const result = await this.db.query(
        `SELECT e.agency_client_id::text AS agency_client_id,
                COALESCE(NULLIF(e.industry_override, ''), c.industry_slug) AS industry
           FROM crm_am_account_ext e
           INNER JOIN clients c ON c.id = e.agency_client_id
          WHERE e.tenant_id = $1 AND e.agency_client_id = $2::uuid AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      const row = result.rows[0];
      if (!row) amThrow(404, { error: 'not_found' });
      return {
        agency_client_id: String(row.agency_client_id),
        industry: row.industry != null ? String(row.industry) : null,
      };
    } catch (err) {
      if ((err as { status?: number }).status) throw err;
      if (isMissingRelation(err)) amThrow(404, { error: 'not_found' });
      throw err;
    }
  }

  private async resolveActor(req: AmFieldsReq): Promise<{
    staffId: number;
    scope: AmScope;
    teamIds: number[];
    caps: StaffSectionCap[];
    internal: boolean;
  }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return {
        staffId,
        scope: resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true }),
        teamIds: [],
        caps: [],
        internal: true,
      };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [], caps: [], internal: false };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested: 'all', hasViewAll, canTeam });
    const teamIds = scope === 'team' ? await this.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds, caps: me.caps, internal: false };
  }

  private async loadTeamIds(staffId: number): Promise<number[]> {
    if (staffId <= 0) return [];
    try {
      const result = await this.db.query(
        `SELECT t.id
           FROM crm_staff cs
           JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
           JOIN staff_user_teams sut ON sut.user_id = u.id
           JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
          WHERE cs.id = $1`,
        [staffId],
      );
      return result.rows
        .map((row) => Number(row.id))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}

function mapField(row: Record<string, unknown>): AmCustomField {
  const type = String(row.field_type ?? 'text');
  return {
    id: String(row.id ?? ''),
    api_key: String(row.api_key ?? ''),
    label: String(row.label ?? ''),
    field_type: (AM_FIELD_TYPES as readonly string[]).includes(type)
      ? (type as AmFieldType)
      : 'text',
    industry_slug: row.industry_slug != null && String(row.industry_slug).trim() !== ''
      ? String(row.industry_slug)
      : null,
    required: Boolean(row.required),
    filterable: Boolean(row.filterable),
    reportable: Boolean(row.reportable),
    access_json: parseAccess(row.access_json),
    constraints_json: parseConstraints(row.constraints_json),
    published: Boolean(row.published),
  };
}

function parseApiKey(raw: unknown): string {
  const key = String(raw ?? '').trim();
  if (!API_KEY_RE.test(key)) amThrow(400, { error: 'invalid_api_key' });
  return key;
}

function parseFieldType(raw: unknown): AmFieldType {
  const type = String(raw ?? '').trim();
  if (!(AM_FIELD_TYPES as readonly string[]).includes(type)) {
    amThrow(400, { error: 'invalid_field_type' });
  }
  return type as AmFieldType;
}

function parseAccess(raw: unknown): AmFieldAccess | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return parseAccess(JSON.parse(raw));
    } catch {
      amThrow(400, { error: 'invalid_access_json' });
    }
  }
  if (typeof raw !== 'object') amThrow(400, { error: 'invalid_access_json' });
  const obj = raw as Record<string, unknown>;
  const view = Array.isArray(obj.view) ? obj.view.map((v) => String(v)) : undefined;
  const edit = Array.isArray(obj.edit) ? obj.edit.map((v) => String(v)) : undefined;
  return view || edit ? { view, edit } : {};
}

function parseConstraints(raw: unknown): AmFieldConstraints | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return parseConstraints(JSON.parse(raw));
    } catch {
      amThrow(400, { error: 'invalid_constraints_json' });
    }
  }
  if (typeof raw !== 'object') amThrow(400, { error: 'invalid_constraints_json' });
  const obj = raw as Record<string, unknown>;
  const min = obj.min == null || obj.min === '' ? undefined : Number(obj.min);
  const max = obj.max == null || obj.max === '' ? undefined : Number(obj.max);
  if (min != null && !Number.isFinite(min)) amThrow(400, { error: 'invalid_constraints_json' });
  if (max != null && !Number.isFinite(max)) amThrow(400, { error: 'invalid_constraints_json' });
  return { min, max };
}

function coerceValue(field: AmCustomField, raw: unknown): unknown {
  if (raw == null || raw === '') return null;
  if (field.field_type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) amThrow(400, { error: 'invalid_field_value', api_key: field.api_key });
    const min = field.constraints_json?.min;
    const max = field.constraints_json?.max;
    if (min != null && n < min) amThrow(400, { error: 'field_constraint', api_key: field.api_key });
    if (max != null && n > max) amThrow(400, { error: 'field_constraint', api_key: field.api_key });
    return n;
  }
  if (field.field_type === 'bool') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    amThrow(400, { error: 'invalid_field_value', api_key: field.api_key });
  }
  return raw;
}

function canAccessField(
  field: AmCustomField,
  mode: 'view' | 'edit',
  caps: StaffSectionCap[],
  internal: boolean,
): boolean {
  if (internal) return true;
  const needed = field.access_json?.[mode] ?? (mode === 'edit' ? ['crm_am.edit'] : ['crm_am.view']);
  return needed.some((token) => {
    const last = token.lastIndexOf('.');
    if (last <= 0) return false;
    const section = token.slice(0, last);
    const action = token.slice(last + 1);
    return caps.some((cap) => cap.section === section && cap.action === action);
  });
}

function isEmptyValue(raw: unknown): boolean {
  if (raw == null) return true;
  if (typeof raw === 'string') return raw.trim() === '';
  return false;
}

function requireText(raw: unknown, error: string): string {
  const value = String(raw ?? '').trim();
  if (!value) amThrow(400, { error });
  return value;
}

function emptyToNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

function requireClientId(raw: string): string {
  const clientId = String(raw ?? '').trim();
  if (!clientId) amThrow(400, { error: 'agency_client_id_required' });
  if (!isUuid(clientId)) amThrow(400, { error: 'invalid_agency_client_id' });
  return clientId;
}

function bindScopeSql(
  fragment: { sql: string; params: unknown[] },
  startAt: number,
): { sql: string; params: unknown[] } {
  let sql = fragment.sql;
  const params: unknown[] = [];
  let i = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${i++}`);
    params.push(fragment.params[0]);
    if (sql.includes('$staff')) {
      sql = sql.replaceAll('$staff', `$${i++}`);
      params.push(fragment.params[1] ?? fragment.params[0]);
    }
    return { sql, params };
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${i}`);
    params.push(fragment.params[0]);
  }
  return { sql, params };
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isMissingColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42703' || /column .* does not exist/i.test(e.message ?? '');
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}
