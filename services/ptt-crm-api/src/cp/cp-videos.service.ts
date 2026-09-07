import { HttpException, Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import { cpScopeSql, CpScope } from './cp-scope.util';

export const CP_VIDEOS_QUERY = 'CP_VIDEOS_QUERY';
const INPUT_MODES = ['prompt', 'script', 'url', 'template'] as const;
const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

export interface CpVideosQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpVideoScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpVideoDraftInput = {
  id?: string;
  project_id?: string;
  deliverable_id?: string | null;
  name?: string;
  input_mode?: string;
  prompt?: string | null;
  script_json?: unknown;
  config_json?: unknown;
  brand_kit_version_id?: string | null;
};

export type CpVideoVersionPatch = {
  qc_status?: string | null;
  qc_json?: unknown;
  approval_status?: string | null;
};

@Injectable()
export class CpVideosRepository implements CpVideosQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpVideosService {
  constructor(
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
    @Optional() private readonly audit?: CpAuditRepository,
  ) {}

  patch(
    id: string,
    input: CpVideoDraftInput,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    return this.patchDraft(id, input, scope);
  }

  async list(scope: CpVideoScope = DEFAULT_SCOPE) {
    const allowed = projectScope(scope, 2);
    const result = await this.db.query(
      `SELECT d.*
         FROM crm_cp_video_drafts d
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND ${allowed.sql}
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50`,
      [CP_TENANT_ID, ...allowed.params],
    );
    return { items: result.rows };
  }

  async get(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const draftId = requiredUuid(id, 'invalid_video_id');
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT d.*
         FROM crm_cp_video_drafts d
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND d.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, draftId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  async getVersion(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const versionId = requiredUuid(id, 'invalid_version_id');
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT v.*, d.name AS draft_name, d.project_id, d.brand_kit_version_id
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND v.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, versionId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  async upsertDraft(
    input: CpVideoDraftInput,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ): Promise<Record<string, unknown>> {
    if (input.id) return this.patchDraft(input.id, input, scope);

    const projectId = requiredUuid(input.project_id, 'project_id_required');
    const project = await this.loadProject(projectId, scope);
    const name = requiredText(input.name, 'name_required');
    const inputMode = parseInputMode(input.input_mode ?? 'prompt');
    const result = await this.db.query(
      `INSERT INTO crm_cp_video_drafts (
         project_id, agency_client_id, deliverable_id, name, input_mode,
         prompt, script_json, config_json, brand_kit_version_id, autosaved_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb, $8::jsonb,
         $9::uuid, now()
       )
       RETURNING *`,
      [
        projectId,
        project.agency_client_id,
        optionalUuid(input.deliverable_id, 'invalid_deliverable_id'),
        name,
        inputMode,
        nullableText(input.prompt),
        json(input.script_json, null),
        json(input.config_json, {}),
        optionalUuid(input.brand_kit_version_id, 'invalid_brand_kit_version_id'),
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async patchDraft(
    id: string,
    input: CpVideoDraftInput,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ): Promise<Record<string, unknown>> {
    const current = await this.get(id, scope);
    const result = await this.db.query(
      `UPDATE crm_cp_video_drafts
          SET name = $2,
              input_mode = $3,
              prompt = $4,
              script_json = $5::jsonb,
              config_json = $6::jsonb,
              brand_kit_version_id = $7::uuid,
              revision = revision + 1,
              autosaved_at = now()
        WHERE id = $1::uuid
        RETURNING *`,
      [
        current.id,
        input.name === undefined ? current.name : requiredText(input.name, 'name_required'),
        input.input_mode === undefined
          ? current.input_mode
          : parseInputMode(input.input_mode),
        input.prompt === undefined ? current.prompt : nullableText(input.prompt),
        json(input.script_json, current.script_json ?? null),
        json(input.config_json, current.config_json ?? {}),
        input.brand_kit_version_id === undefined
          ? current.brand_kit_version_id ?? null
          : optionalUuid(input.brand_kit_version_id, 'invalid_brand_kit_version_id'),
      ],
    );
    const updated = result.rows[0] ?? cpThrow(404, { error: 'not_found' });
    await this.invalidateApprovalIfNeeded(updated, scope);
    return updated;
  }

  async patchVersion(
    id: string,
    patch: CpVideoVersionPatch,
  ): Promise<Record<string, unknown>> {
    const versionId = requiredUuid(id, 'invalid_version_id');
    const found = await this.db.query(
      `SELECT * FROM crm_cp_video_versions
        WHERE id = $1::uuid
        LIMIT 1`,
      [versionId],
    );
    const version = found.rows[0] ?? cpThrow(404, { error: 'not_found' });
    if (version.immutable === true) cpThrow(409, { error: 'immutable' });

    const updated = await this.db.query(
      `UPDATE crm_cp_video_versions
          SET qc_status = $2, qc_json = $3::jsonb, approval_status = $4
        WHERE id = $1::uuid
        RETURNING *`,
      [
        versionId,
        patch.qc_status === undefined ? version.qc_status ?? null : nullableText(patch.qc_status),
        json(patch.qc_json, version.qc_json ?? null),
        patch.approval_status === undefined
          ? version.approval_status
          : nullableText(patch.approval_status),
      ],
    );
    return updated.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async invalidateApprovalIfNeeded(
    draft: Record<string, unknown>,
    scope: CpVideoScope,
  ) {
    const found = await this.db.query(
      `SELECT v.*
         FROM crm_cp_video_versions v
        WHERE v.draft_id = $1::uuid
        ORDER BY v.version_n DESC, v.id DESC
        LIMIT 1`,
      [draft.id],
    );
    const version = found.rows[0];
    if (!version) return;
    const previous = String(version.approval_status ?? '');
    if (!previous || previous === 'internal_review' || previous === 'rejected') return;

    await this.db.query(
      `UPDATE crm_cp_video_versions
          SET approval_status = $2
        WHERE id = $1::uuid`,
      [version.id, 'internal_review'],
    );
    await this.audit?.insert({
      actor_id: scope.staffId > 0 ? scope.staffId : null,
      action: 'approval_invalidated',
      resource_type: 'video_version',
      resource_id: String(version.id),
      payload_json: {
        previous,
        draft_id: String(draft.id),
      },
    });
  }

  private async loadProject(projectId: string, scope: CpVideoScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT p.* FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, projectId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }
}

function projectScope(scope: CpVideoScope, startAt: number) {
  const raw = cpScopeSql({
    scope: scope.scope,
    staffId: scope.staffId,
    teamIds: scope.teamIds ?? [],
  });
  const token = raw.sql.includes('$teams') ? '$teams' : '$staff';
  return {
    sql: raw.sql.replaceAll(token, `$${startAt}`),
    params: raw.params,
  };
}

function parseInputMode(value: unknown): (typeof INPUT_MODES)[number] {
  const mode = String(value ?? '').trim();
  if (!(INPUT_MODES as readonly string[]).includes(mode)) {
    cpThrow(400, { error: 'invalid_input_mode' });
  }
  return mode as (typeof INPUT_MODES)[number];
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error });
  }
  return id;
}

function optionalUuid(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  return requiredUuid(value, error);
}

function json(value: unknown, fallback: unknown): string {
  return JSON.stringify(value === undefined ? fallback : value);
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
