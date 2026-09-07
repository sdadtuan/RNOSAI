import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpScope } from './cp-scope.util';

const KIT_SCOPE_TYPES = ['tenant', 'client', 'project'] as const;
const DEFAULT_SCOPE: CpBrandScope = { scope: 'all', staffId: 0, teamIds: [] };

export type CpBrandScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpCreateKitInput = {
  scope_type?: string;
  agency_client_id?: string | null;
  project_id?: string | null;
  name?: string;
};

export type CpBrandVersion = Record<string, unknown> & {
  id?: string;
  n: number;
  payload_json: Record<string, unknown>;
};

export const CP_BRAND_ENFORCEMENTS = ['block_render', 'block_publish', 'warning'] as const;
export const CP_PREVIEW_RATIOS = ['9:16', '1:1', '4:5', '16:9'] as const;
export const CP_OVERLAY_CLIP_LENGTH = 42;

export type CpBrandEnforcement = (typeof CP_BRAND_ENFORCEMENTS)[number];

export type CpBrandRuleContext = {
  output_type?: string | null;
  channel?: string | null;
  ratio?: string | null;
  has_claim?: boolean | null;
  scope?: string | null;
};

export type CpBrandRuleEval = {
  enforcement: CpBrandEnforcement | null;
  actions: unknown[];
};

export type CpCreateRuleInput = {
  condition_json?: unknown;
  action_json?: unknown;
  enforcement?: string;
  kit_version_id?: string | null;
  n?: number;
};

export type CpPreviewInput = {
  overlay?: string | null;
  foreground?: string | null;
  background?: string | null;
  n?: number;
};

export type CpBrandPreviewItem = {
  ratio: (typeof CP_PREVIEW_RATIOS)[number];
  warnings: string[];
};

export interface CpBrandQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpBrandRepository implements CpBrandQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async transaction<T>(work: (tx: CpBrandQueryPort) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    const tx: CpBrandQueryPort = {
      query: (sql, params) => client.query(sql, params),
    };
    try {
      await client.query('BEGIN');
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpBrandService {
  constructor(private readonly db: CpBrandRepository) {}

  async createKit(input: CpCreateKitInput, scope: CpBrandScope = DEFAULT_SCOPE) {
    const scopeType = kitScopeType(input.scope_type);
    const name = requiredText(input.name, 'name_required');
    let clientId: string | null = null;
    let projectId: string | null = null;

    if (scopeType === 'client') {
      clientId = requiredUuid(
        input.agency_client_id,
        'agency_client_id_required',
        'invalid_agency_client_id',
      );
      await this.requireClient(clientId);
    }
    if (scopeType === 'project') {
      projectId = requiredUuid(input.project_id, 'project_id_required', 'invalid_project_id');
      await this.requireProject(projectId, scope);
    }

    const result = await this.db.query(
      `INSERT INTO crm_cp_brand_kits (
         tenant_id, scope_type, agency_client_id, project_id, name
       ) VALUES ($1, $2, $3::uuid, $4::uuid, $5)
       RETURNING *`,
      [CP_TENANT_ID, scopeType, clientId, projectId, name],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async listKits(scope: CpBrandScope = DEFAULT_SCOPE) {
    const allowed = kitScope(scope, 2);
    const result = await this.db.query(
      `SELECT k.*,
              (SELECT MAX(v.n) FROM crm_cp_brand_kit_versions v WHERE v.kit_id = k.id)
                AS latest_version
         FROM crm_cp_brand_kits k
        WHERE k.tenant_id = $1 AND ${allowed.sql}
        ORDER BY k.name, k.id`,
      [CP_TENANT_ID, ...allowed.params],
    );
    return { items: result.rows };
  }

  async getKit(id: string, scope: CpBrandScope = DEFAULT_SCOPE) {
    const kitId = requiredUuid(id, 'invalid_kit_id', 'invalid_kit_id');
    return this.loadKit(kitId, scope);
  }

  async listVersions(id: string, scope: CpBrandScope = DEFAULT_SCOPE) {
    const kit = await this.getKit(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_brand_kit_versions
        WHERE kit_id = $1::uuid
        ORDER BY n DESC`,
      [kit.id],
    );
    return { items: result.rows };
  }

  async getVersion(id: string, n: number, scope: CpBrandScope = DEFAULT_SCOPE) {
    const kit = await this.getKit(id, scope);
    const version = positiveVersion(n);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_brand_kit_versions
        WHERE kit_id = $1::uuid AND n = $2
        LIMIT 1`,
      [kit.id, version],
    );
    return (result.rows[0] as CpBrandVersion | undefined) ?? cpThrow(404, { error: 'not_found' });
  }

  async saveVersion(
    id: string,
    payload: unknown,
    scope: CpBrandScope = DEFAULT_SCOPE,
  ): Promise<CpBrandVersion> {
    const kitId = requiredUuid(id, 'invalid_kit_id', 'invalid_kit_id');
    if (payload === undefined) cpThrow(400, { error: 'payload_required' });

    return this.db.transaction(async (tx) => {
      const kit = await this.loadKit(kitId, scope, tx, true);
      const result = await tx.query(
        `INSERT INTO crm_cp_brand_kit_versions (kit_id, n, payload_json)
         SELECT $1::uuid, COALESCE(MAX(n), 0) + 1, $2::jsonb
           FROM crm_cp_brand_kit_versions
          WHERE kit_id = $1::uuid
         RETURNING *`,
        [kit.id, JSON.stringify(payload)],
      );
      return (result.rows[0] as CpBrandVersion | undefined) ??
        cpThrow(500, { error: 'insert_failed' });
    });
  }

  async restoreVersion(
    id: string,
    n: number,
    scope: CpBrandScope = DEFAULT_SCOPE,
  ): Promise<CpBrandVersion> {
    const version = await this.getVersion(id, n, scope);
    return this.saveVersion(id, version.payload_json, scope);
  }

  async evaluateRules(
    kitVersionId: string,
    ctx: CpBrandRuleContext = {},
  ): Promise<CpBrandRuleEval> {
    const versionId = requiredUuid(
      kitVersionId,
      'invalid_kit_version_id',
      'invalid_kit_version_id',
    );
    const result = await this.db.query(
      `SELECT enforcement, action_json, condition_json
         FROM crm_cp_brand_rules
        WHERE kit_version_id = $1::uuid`,
      [versionId],
    );
    return evaluateRuleSet(result.rows, ctx);
  }

  async listRules(id: string, scope: CpBrandScope = DEFAULT_SCOPE, n?: number) {
    const version = n == null
      ? await this.latestVersion(id, scope)
      : await this.getVersion(id, n, scope);
    if (!version?.id) return { items: [] };
    const result = await this.db.query(
      `SELECT * FROM crm_cp_brand_rules
        WHERE kit_version_id = $1::uuid
        ORDER BY id`,
      [version.id],
    );
    return { items: result.rows };
  }

  async createRule(
    id: string,
    input: CpCreateRuleInput,
    scope: CpBrandScope = DEFAULT_SCOPE,
  ) {
    const enforcement = requiredEnforcement(input.enforcement);
    const version = input.kit_version_id
      ? await this.requireKitVersion(id, input.kit_version_id, scope)
      : input.n != null
        ? await this.getVersion(id, input.n, scope)
        : await this.latestVersion(id, scope);
    if (!version?.id) cpThrow(400, { error: 'version_required' });
    const result = await this.db.query(
      `INSERT INTO crm_cp_brand_rules (
         kit_version_id, condition_json, action_json, enforcement
       ) VALUES ($1::uuid, $2::jsonb, $3::jsonb, $4)
       RETURNING *`,
      [
        version.id,
        JSON.stringify(input.condition_json ?? {}),
        JSON.stringify(input.action_json ?? {}),
        enforcement,
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async preview(
    id: string,
    input: CpPreviewInput = {},
    scope: CpBrandScope = DEFAULT_SCOPE,
  ): Promise<{ items: CpBrandPreviewItem[] }> {
    const version = input.n == null
      ? await this.latestVersion(id, scope)
      : await this.getVersion(id, input.n, scope);
    const payload = objectValue(version?.payload_json);
    const palette = Array.isArray(payload.palette)
      ? payload.palette.filter((color): color is string => typeof color === 'string')
      : [];
    const foreground = colorText(input.foreground) || colorText(palette[1]) || '#111827';
    const background = colorText(input.background) || colorText(palette[0]) || '#ffffff';
    const overlay = input.overlay != null
      ? String(input.overlay)
      : overlayFromPayload(payload);
    const warnings: string[] = [];
    if (contrastRatio(foreground, background) < 4.5) warnings.push('contrast');
    if (overlay.length > CP_OVERLAY_CLIP_LENGTH) warnings.push('clipping');
    return {
      items: CP_PREVIEW_RATIOS.map((ratio) => ({ ratio, warnings: [...warnings] })),
    };
  }

  private async latestVersion(id: string, scope: CpBrandScope): Promise<CpBrandVersion | undefined> {
    const kit = await this.getKit(id, scope);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_brand_kit_versions
        WHERE kit_id = $1::uuid
        ORDER BY n DESC
        LIMIT 1`,
      [kit.id],
    );
    return result.rows[0] as CpBrandVersion | undefined;
  }

  private async requireKitVersion(
    kitId: string,
    versionId: string,
    scope: CpBrandScope,
  ): Promise<CpBrandVersion> {
    const kit = await this.getKit(kitId, scope);
    const id = requiredUuid(versionId, 'invalid_kit_version_id', 'invalid_kit_version_id');
    const result = await this.db.query(
      `SELECT * FROM crm_cp_brand_kit_versions
        WHERE kit_id = $1::uuid AND id = $2::uuid
        LIMIT 1`,
      [kit.id, id],
    );
    return (result.rows[0] as CpBrandVersion | undefined) ?? cpThrow(404, { error: 'not_found' });
  }

  private async requireClient(clientId: string): Promise<void> {
    const result = await this.db.query(
      `SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`,
      [clientId],
    );
    if (!result.rows[0]) cpThrow(400, { error: 'client_not_found' });
  }

  private async requireProject(projectId: string, scope: CpBrandScope): Promise<void> {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT p.id::text FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, projectId, ...allowed.params],
    );
    if (!result.rows[0]) cpThrow(404, { error: 'not_found' });
  }

  private async loadKit(
    kitId: string,
    scope: CpBrandScope,
    db: CpBrandQueryPort = this.db,
    forUpdate = false,
  ) {
    const allowed = kitScope(scope, 3);
    const result = await db.query(
      `SELECT k.* FROM crm_cp_brand_kits k
        WHERE k.tenant_id = $1 AND k.id = $2::uuid AND ${allowed.sql}
        LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
      [CP_TENANT_ID, kitId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }
}

function kitScope(scope: CpBrandScope, startAt: number) {
  if (scope.scope === 'all') return { sql: 'TRUE', params: [] as unknown[] };
  const projects = projectScope(scope, startAt);
  return {
    sql: `(k.scope_type = 'tenant' OR EXISTS (
      SELECT 1 FROM crm_cp_projects p
       WHERE p.tenant_id = k.tenant_id
         AND (
           (k.scope_type = 'client' AND p.agency_client_id = k.agency_client_id)
           OR (k.scope_type = 'project' AND p.id = k.project_id)
         )
         AND ${projects.sql}
    ))`,
    params: projects.params,
  };
}

function projectScope(scope: CpBrandScope, startAt: number) {
  if (scope.scope === 'all') return { sql: 'TRUE', params: [] as unknown[] };
  if (scope.scope === 'team' && scope.teamIds?.length) {
    return {
      sql: `(EXISTS (
        SELECT 1
          FROM crm_staff owner
          JOIN staff_users su ON lower(trim(su.email)) = lower(trim(owner.email))
          JOIN staff_user_teams sut ON sut.user_id = su.id
         WHERE owner.id = p.owner_staff_id AND sut.team_id = ANY($${startAt})
      ) OR EXISTS (
        SELECT 1
          FROM crm_cp_project_members m
          JOIN crm_staff member_staff ON member_staff.id = m.staff_id
          JOIN staff_users su ON lower(trim(su.email)) = lower(trim(member_staff.email))
          JOIN staff_user_teams sut ON sut.user_id = su.id
         WHERE m.project_id = p.id AND sut.team_id = ANY($${startAt})
      ))`,
      params: [scope.teamIds],
    };
  }
  return {
    sql: `(p.owner_staff_id = $${startAt} OR EXISTS (
      SELECT 1 FROM crm_cp_project_members m
       WHERE m.project_id = p.id AND m.staff_id = $${startAt}
    ))`,
    params: [scope.staffId],
  };
}

function kitScopeType(value: unknown): (typeof KIT_SCOPE_TYPES)[number] {
  const scope = String(value ?? '').trim();
  if (!(KIT_SCOPE_TYPES as readonly string[]).includes(scope)) {
    cpThrow(400, { error: 'invalid_scope_type' });
  }
  return scope as (typeof KIT_SCOPE_TYPES)[number];
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function requiredUuid(value: unknown, missingError: string, invalidError: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error: missingError });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error: invalidError });
  }
  return id;
}

function positiveVersion(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) cpThrow(400, { error: 'invalid_version' });
  return n;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}

const ENFORCEMENT_RANK: Record<CpBrandEnforcement, number> = {
  warning: 1,
  block_publish: 2,
  block_render: 3,
};

export function evaluateRuleSet(
  rules: Array<{
    enforcement?: unknown;
    action_json?: unknown;
    condition_json?: unknown;
  }>,
  ctx: CpBrandRuleContext = {},
): CpBrandRuleEval {
  let enforcement: CpBrandEnforcement | null = null;
  const actions: unknown[] = [];
  for (const rule of rules) {
    if (!conditionMatches(rule.condition_json, ctx)) continue;
    const next = optionalEnforcement(rule.enforcement);
    if (next && (enforcement == null || ENFORCEMENT_RANK[next] > ENFORCEMENT_RANK[enforcement])) {
      enforcement = next;
    }
    if (rule.action_json !== undefined) actions.push(rule.action_json);
  }
  return { enforcement, actions };
}

function conditionMatches(condition: unknown, ctx: CpBrandRuleContext): boolean {
  const cond = objectValue(condition);
  if (!fieldMatches(cond.output_type, ctx.output_type)) return false;
  if (!fieldMatches(cond.channel, ctx.channel)) return false;
  if (!fieldMatches(cond.ratio, ctx.ratio)) return false;
  if (!fieldMatches(cond.scope, ctx.scope)) return false;
  if (cond.has_claim !== undefined && cond.has_claim !== null && cond.has_claim !== '') {
    if (Boolean(cond.has_claim) !== Boolean(ctx.has_claim)) return false;
  }
  return true;
}

function fieldMatches(expected: unknown, actual: unknown): boolean {
  if (expected === undefined || expected === null || expected === '' || expected === 'all') {
    return true;
  }
  if (Array.isArray(expected)) {
    return expected.map((item) => String(item)).includes(String(actual ?? ''));
  }
  return String(expected) === String(actual ?? '');
}

function requiredEnforcement(value: unknown): CpBrandEnforcement {
  return optionalEnforcement(value) ?? cpThrow(400, { error: 'invalid_enforcement' });
}

function optionalEnforcement(value: unknown): CpBrandEnforcement | null {
  const text = String(value ?? '').trim();
  return (CP_BRAND_ENFORCEMENTS as readonly string[]).includes(text)
    ? text as CpBrandEnforcement
    : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function colorText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function overlayFromPayload(payload: Record<string, unknown>): string {
  const motion = objectValue(payload.motion);
  const disclaimer = objectValue(payload.disclaimer);
  const cta = objectValue(payload.cta);
  return [motion.caption_style, disclaimer.text, cta.label]
    .filter((item): item is string => typeof item === 'string')
    .join('');
}

function contrastRatio(foreground: string, background: string): number {
  const left = relativeLuminance(foreground);
  const right = relativeLuminance(background);
  if (left == null || right == null) return 21;
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string): number | null {
  const hex = color.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
