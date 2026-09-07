import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { cpScopeSql, CpScope } from './cp-scope.util';

export const CP_EXPERIMENTS_QUERY = 'CP_EXPERIMENTS_QUERY';
const DEFAULT_SCOPE: CpExperimentScope = { scope: 'all', staffId: 0, teamIds: [] };

export interface CpExperimentsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpExperimentScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpExperimentInput = {
  project_id?: string;
  name?: string;
  variants_json?: unknown;
};

export type CpExperimentVariantInput = {
  draft_id?: string;
  source_version_id?: string;
  label?: string;
  name?: string;
};

@Injectable()
export class CpExperimentsRepository implements CpExperimentsQueryPort, OnModuleDestroy {
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
export class CpExperimentsService {
  constructor(
    @Inject(CP_EXPERIMENTS_QUERY) private readonly db: CpExperimentsQueryPort,
  ) {}

  async list(projectId: string, scope: CpExperimentScope = DEFAULT_SCOPE) {
    const project = await this.loadProject(projectId, scope);
    const result = await this.db.query(
      `SELECT e.*
         FROM crm_cp_experiments e
        WHERE e.project_id = $1::uuid
        ORDER BY e.id`,
      [project.id],
    );
    return { items: result.rows };
  }

  async get(id: string, scope: CpExperimentScope = DEFAULT_SCOPE) {
    const experimentId = requiredUuid(id, 'invalid_experiment_id');
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT e.*
         FROM crm_cp_experiments e
         JOIN crm_cp_projects p ON p.id = e.project_id
        WHERE p.tenant_id = $1 AND e.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, experimentId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  async create(
    input: CpExperimentInput,
    scope: CpExperimentScope = DEFAULT_SCOPE,
  ) {
    const project = await this.loadProject(input.project_id, scope);
    const name = requiredText(input.name, 'name_required');
    const variants = parseVariants(input.variants_json);
    const result = await this.db.query(
      `INSERT INTO crm_cp_experiments (project_id, name, variants_json)
       VALUES ($1::uuid, $2, $3::jsonb)
       RETURNING *`,
      [project.id, name, JSON.stringify(variants)],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async createVariant(
    experimentId: string,
    input: CpExperimentVariantInput,
    scope: CpExperimentScope = DEFAULT_SCOPE,
  ) {
    const experiment = await this.get(experimentId, scope);
    const draft = await this.loadDraft(input.draft_id, String(experiment.project_id), scope);
    const source = input.source_version_id
      ? await this.loadVersion(input.source_version_id, String(draft.id))
      : null;
    const snapshot = {
      ...(source ? asRecord(source.snapshot_json) : { draft }),
      experiment_id: experiment.id,
    };
    const nextN = await this.nextVersionN(String(draft.id));
    const inserted = await this.db.query(
      `INSERT INTO crm_cp_video_versions (
         draft_id, version_n, snapshot_json, qc_status, approval_status,
         immutable, output_uri, pricing_version
       ) VALUES (
         $1::uuid, $2, $3::jsonb, NULL, 'internal_review', FALSE, NULL, NULL
       )
       RETURNING *`,
      [draft.id, nextN, JSON.stringify(snapshot)],
    );
    const version = inserted.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    const variants = [
      ...parseVariants(experiment.variants_json),
      {
        version_id: version.id,
        draft_id: draft.id,
        label: requiredText(input.label ?? input.name, 'label_required'),
      },
    ];
    const updated = await this.db.query(
      `UPDATE crm_cp_experiments
          SET variants_json = $2::jsonb
        WHERE id = $1::uuid
        RETURNING *`,
      [experiment.id, JSON.stringify(variants)],
    );
    return {
      experiment: updated.rows[0] ?? { ...experiment, variants_json: variants },
      version,
    };
  }

  private async nextVersionN(draftId: string) {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(version_n), 0) + 1 AS next_n
         FROM crm_cp_video_versions
        WHERE draft_id = $1::uuid`,
      [draftId],
    );
    const next = Number(result.rows[0]?.next_n ?? 1);
    return Number.isFinite(next) && next > 0 ? next : 1;
  }

  private async loadVersion(id: string, draftId: string) {
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_video_versions
        WHERE id = $1::uuid AND draft_id = $2::uuid
        LIMIT 1`,
      [requiredUuid(id, 'invalid_version_id'), draftId],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadDraft(
    draftId: unknown,
    projectId: string,
    scope: CpExperimentScope,
  ) {
    const allowed = projectScope(scope, 4);
    const result = await this.db.query(
      `SELECT d.*
         FROM crm_cp_video_drafts d
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND d.id = $2::uuid AND d.project_id = $3::uuid
          AND ${allowed.sql}
        LIMIT 1`,
      [
        CP_TENANT_ID,
        requiredUuid(draftId, 'draft_id_required'),
        projectId,
        ...allowed.params,
      ],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadProject(projectId: unknown, scope: CpExperimentScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT p.* FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, requiredUuid(projectId, 'project_id_required'), ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }
}

function projectScope(scope: CpExperimentScope, startAt: number) {
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

function parseVariants(value: unknown): Record<string, unknown>[] {
  if (value == null || value === '') return [];
  if (!Array.isArray(value)) cpThrow(400, { error: 'invalid_variants' });
  return value.filter((item): item is Record<string, unknown> => (
    item != null && typeof item === 'object' && !Array.isArray(item)
  ));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error });
  }
  return id;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
