import { HttpException, Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import {
  buildScenesFromPlaybook,
  regenerateScene as regeneratePlaybookScene,
} from './cp-playbook-script.engine';
import { CpPlaybookVars } from './cp-playbook.types';
import { cpScopeSql, CpScope } from './cp-scope.util';

export const CP_VIDEOS_QUERY = 'CP_VIDEOS_QUERY';
const INPUT_MODES = ['prompt', 'script', 'url', 'template'] as const;
const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

export interface CpVideosQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  transaction?<T>(work: (tx: CpVideosQueryPort) => Promise<T>): Promise<T>;
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

export type CpSceneInput = {
  idx?: number;
  title?: string | null;
  t_start?: number | null;
  t_end?: number | null;
  visual?: string | null;
  vo?: string | null;
  overlay?: string | null;
  locked?: boolean;
  qc?: string | null;
};

export type CpTimelinePatch = {
  scenes?: Array<CpSceneInput & { idx: number }>;
  music?: {
    source?: string | null;
    t_start?: number | null;
    t_end?: number | null;
    volume?: number | null;
  } | null;
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

  async transaction<T>(work: (tx: CpVideosQueryPort) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    const tx: CpVideosQueryPort = {
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

  async get(id: string, scope: CpVideoScope = DEFAULT_SCOPE): Promise<Record<string, unknown>> {
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
    const draft = result.rows[0] ?? cpThrow(404, { error: 'not_found' });
    return {
      ...draft,
      has_completed_version: await this.hasCompletedVersion(String(draft.id)),
      latest_version_id: await this.latestVersionId(String(draft.id)),
    };
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
    const nextConfig = lockCompletedLanguage(
      current.config_json,
      input.config_json === undefined ? current.config_json : input.config_json,
      Boolean(current.has_completed_version),
    );
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
        JSON.stringify(nextConfig),
        input.brand_kit_version_id === undefined
          ? current.brand_kit_version_id ?? null
          : optionalUuid(input.brand_kit_version_id, 'invalid_brand_kit_version_id'),
      ],
    );
    const updated = result.rows[0] ?? cpThrow(404, { error: 'not_found' });
    await this.invalidateApprovalIfNeeded(updated, scope);
    return {
      ...updated,
      has_completed_version: Boolean(current.has_completed_version),
    };
  }

  async listScenes(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const draft = await this.get(id, scope);
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_scenes
        WHERE draft_id = $1::uuid
        ORDER BY idx ASC`,
      [draft.id],
    );
    return { items: result.rows };
  }

  async putScenes(
    id: string,
    input: { scenes?: CpSceneInput[] },
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const draft = await this.get(id, scope);
    const scenes = parseScenes(input?.scenes);
    const write = async (tx: CpVideosQueryPort) => {
      await tx.query(
        `DELETE FROM crm_cp_scenes WHERE draft_id = $1::uuid`,
        [draft.id],
      );
      const items: Record<string, unknown>[] = [];
      for (const scene of scenes) {
        const inserted = await tx.query(
          `INSERT INTO crm_cp_scenes (
             draft_id, idx, title, t_start, t_end, visual, vo, overlay, locked, qc
           ) VALUES (
             $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10
           )
           RETURNING *`,
          [
            draft.id,
            scene.idx,
            scene.title,
            scene.t_start,
            scene.t_end,
            scene.visual,
            scene.vo,
            scene.overlay,
            scene.locked,
            scene.qc,
          ],
        );
        items.push(inserted.rows[0] ?? scene);
      }
      return { items };
    };
    if (this.db.transaction) return this.db.transaction(write);
    return write(this.db);
  }

  async patchTimeline(
    id: string,
    input: CpTimelinePatch,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const draft = await this.get(id, scope);
    const write = async (tx: CpVideosQueryPort) => {
      const scenes: Record<string, unknown>[] = [];
      for (const patch of input.scenes ?? []) {
        const idx = requiredIdx(patch.idx);
        const found = await tx.query(
          `SELECT *
             FROM crm_cp_scenes
            WHERE draft_id = $1::uuid AND idx = $2
            LIMIT 1`,
          [draft.id, idx],
        );
        const current = found.rows[0] ?? cpThrow(404, { error: 'not_found' });
        const updated = await tx.query(
          `UPDATE crm_cp_scenes
              SET t_start = $3, t_end = $4
            WHERE draft_id = $1::uuid AND idx = $2
            RETURNING *`,
          [
            draft.id,
            idx,
            patch.t_start === undefined ? current.t_start ?? null : optionalNumber(patch.t_start, 'invalid_t_start'),
            patch.t_end === undefined ? current.t_end ?? null : optionalNumber(patch.t_end, 'invalid_t_end'),
          ],
        );
        scenes.push(updated.rows[0] ?? current);
      }
      const listed = scenes.length
        ? scenes
        : (await tx.query(
          `SELECT * FROM crm_cp_scenes WHERE draft_id = $1::uuid ORDER BY idx ASC`,
          [draft.id],
        )).rows;
      const config = asRecord(draft.config_json);
      if (input.music !== undefined) config.music = input.music;
      const bumped = await tx.query(
        `UPDATE crm_cp_video_drafts
            SET revision = revision + 1,
                config_json = $2::jsonb,
                autosaved_at = now()
          WHERE id = $1::uuid
          RETURNING *`,
        [draft.id, JSON.stringify(config)],
      );
      const draftRow = bumped.rows[0] ?? draft;
      return {
        revision: draftRow.revision,
        scenes: listed,
        music: config.music ?? null,
      };
    };
    if (this.db.transaction) return this.db.transaction(write);
    return write(this.db);
  }

  async regenerateScene(
    id: string,
    idx: string | number,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const draft = await this.get(id, scope);
    const sceneIdx = requiredIdx(idx);
    const found = await this.db.query(
      `SELECT *
         FROM crm_cp_scenes
        WHERE draft_id = $1::uuid AND idx = $2
        LIMIT 1`,
      [draft.id, sceneIdx],
    );
    const scene = found.rows[0] ?? cpThrow(404, { error: 'not_found' });
    if (isLocked(scene.locked)) return scene;

    const playbook = playbookFromDraft(draft);
    const generated = playbook.playbook_id
      ? regeneratePlaybookScene(
        playbook.playbook_id,
        sceneIdx,
        playbook.playbook_vars,
        {
          locked: isLocked(scene.locked),
          visual: nullableText(scene.visual),
          vo: nullableText(scene.vo),
          overlay: nullableText(scene.overlay),
        },
      )
      : stubRegeneratedCopy(sceneIdx);
    const updated = await this.db.query(
      `UPDATE crm_cp_scenes
          SET visual = $3, vo = $4, overlay = $5
        WHERE draft_id = $1::uuid AND idx = $2 AND locked = false
        RETURNING *`,
      [draft.id, sceneIdx, generated.visual, generated.vo, generated.overlay],
    );
    return updated.rows[0] ?? scene;
  }

  async autoScript(
    id: string,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const draft = await this.get(id, scope);
    const playbook = playbookFromDraft(draft);
    if (!playbook.playbook_id) cpThrow(400, { error: 'playbook_required' });

    const scenes = buildScenesFromPlaybook(playbook.playbook_id, playbook.playbook_vars);
    const saved = await this.putScenes(id, {
      scenes: scenes.map((scene) => ({
        idx: scene.idx,
        title: scene.title,
        t_start: scene.t_start,
        t_end: scene.t_end,
        visual: scene.visual,
        vo: scene.vo,
        overlay: scene.overlay,
        locked: scene.locked ?? false,
      })),
    }, scope);

    const scriptJson = {
      playbook_id: playbook.playbook_id,
      beats: scenes.map((scene) => ({
        idx: scene.idx,
        beat: scene.beat ?? scene.title,
        vo: scene.vo,
        overlay: scene.overlay,
      })),
    };
    const config = mergePlaybookConfig(draft.config_json, playbook);
    const patched = await this.patchDraft(id, {
      script_json: scriptJson,
      config_json: config,
    }, scope);

    return {
      draft: patched,
      scenes: saved.items,
      script_json: scriptJson,
    };
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

    const invalidate = async (tx: CpVideosQueryPort) => {
      await tx.query(
        `UPDATE crm_cp_video_versions
            SET approval_status = $2
          WHERE id = $1::uuid`,
        [version.id, 'internal_review'],
      );
      if (this.audit) {
        await this.audit.insert({
          actor_id: scope.staffId > 0 ? scope.staffId : null,
          action: 'approval_invalidated',
          resource_type: 'video_version',
          resource_id: String(version.id),
          payload_json: {
            previous,
            draft_id: String(draft.id),
          },
        }, tx);
      }
    };

    if (this.db.transaction) {
      await this.db.transaction(invalidate);
    } else {
      await invalidate(this.db);
    }
  }

  private async latestVersionId(draftId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT v.id AS latest_version_id
         FROM crm_cp_video_versions v
        WHERE v.draft_id = $1::uuid
        ORDER BY v.version_n DESC, v.id DESC
        LIMIT 1`,
      [draftId],
    );
    const id = result.rows[0]?.latest_version_id ?? result.rows[0]?.id;
    return id == null ? null : String(id);
  }

  private async hasCompletedVersion(draftId: string) {
    const result = await this.db.query(
      `SELECT v.id, v.immutable
         FROM crm_cp_video_versions v
        WHERE v.draft_id = $1::uuid AND v.immutable = true
        LIMIT 1`,
      [draftId],
    );
    return result.rows.some((row) => row.immutable === true);
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

function parseScenes(value: unknown): Array<Required<Pick<CpSceneInput, 'idx'>> & CpSceneInput> {
  if (value == null) return [];
  if (!Array.isArray(value)) cpThrow(400, { error: 'invalid_scenes' });
  const seen = new Set<number>();
  return value.map((item, index) => {
    const scene = item && typeof item === 'object' && !Array.isArray(item)
      ? item as CpSceneInput
      : cpThrow(400, { error: 'invalid_scenes' });
    const idx = scene.idx === undefined ? index : requiredIdx(scene.idx);
    if (seen.has(idx)) cpThrow(400, { error: 'duplicate_scene_idx' });
    seen.add(idx);
    return {
      idx,
      title: nullableText(scene.title),
      t_start: optionalNumber(scene.t_start, 'invalid_t_start'),
      t_end: optionalNumber(scene.t_end, 'invalid_t_end'),
      visual: nullableText(scene.visual),
      vo: nullableText(scene.vo),
      overlay: clipOverlay(nullableText(scene.overlay)),
      locked: Boolean(scene.locked),
      qc: nullableText(scene.qc),
    };
  });
}

function requiredIdx(value: unknown): number {
  const idx = Number(value);
  if (!Number.isInteger(idx) || idx < 0) cpThrow(400, { error: 'invalid_scene_idx' });
  return idx;
}

function optionalNumber(value: unknown, error: string): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) cpThrow(400, { error });
  return number;
}

function clipOverlay(value: string | null, max = 42): string | null {
  if (value == null) return null;
  return value.slice(0, max);
}

function stubRegeneratedCopy(idx: number) {
  return {
    visual: `Regenerated visual ${idx}`,
    vo: `Regenerated VO ${idx}`,
    overlay: `Scene ${idx}`,
  };
}

function isLocked(value: unknown): boolean {
  return value === true || value === 't' || value === 'true';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function lockCompletedLanguage(
  current: unknown,
  next: unknown,
  completed: boolean,
): Record<string, unknown> {
  const merged = {
    ...asRecord(current),
    ...asRecord(next === undefined ? current : next),
  };
  if (!completed) return merged;
  merged.language = Object.prototype.hasOwnProperty.call(asRecord(current), 'language')
    ? asRecord(current).language
    : null;
  return merged;
}

function playbookFromDraft(draft: Record<string, unknown>): {
  playbook_id: string | null;
  playbook_vars: CpPlaybookVars;
} {
  return asPlaybookConfig(draft.config_json);
}

function asPlaybookConfig(value: unknown): {
  playbook_id: string | null;
  playbook_vars: CpPlaybookVars;
} {
  const config = asRecord(value);
  const playbookId = nullableText(config.playbook_id);
  const vars = asRecord(config.playbook_vars);
  return {
    playbook_id: playbookId,
    playbook_vars: vars as CpPlaybookVars,
  };
}

function mergePlaybookConfig(
  current: unknown,
  playbook: { playbook_id?: string | null; playbook_vars?: CpPlaybookVars },
): Record<string, unknown> {
  const merged = asRecord(current);
  if (playbook.playbook_id !== undefined) {
    merged.playbook_id = playbook.playbook_id;
  }
  if (playbook.playbook_vars !== undefined) {
    merged.playbook_vars = playbook.playbook_vars;
  }
  return merged;
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
