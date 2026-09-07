import {
  HttpException,
  Inject,
  Injectable,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpScope } from './cp-scope.util';

export const CP_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'application/pdf',
] as const;

export const CP_ASSET_SCANNER = 'CP_ASSET_SCANNER';
const PAGE_SIZE = 50;

export type CpAssetScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

export type CpCreateAssetInput = {
  agency_client_id?: string;
  mime?: string;
  filename?: string;
  project_id?: string | null;
};

export type CpFinalizeAssetInput = {
  bytes?: number | string | null;
  hash?: string | null;
};

export type CpReplaceAssetInput = {
  mime?: string;
  filename?: string | null;
  storage_key?: string;
  bytes?: number | string | null;
  hash?: string | null;
  meta_json?: unknown;
};

export type CpAssetRightsInput = {
  license_type?: string | null;
  owner_name?: string | null;
  effective_on?: string | null;
  expiry_on?: string | null;
  territory?: string[] | null;
  channels?: string[] | null;
  restriction?: string | null;
  model_release?: boolean | null;
  talent_release?: boolean | null;
  proof_asset_id?: string | null;
};

export interface CpAssetsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  transaction?<T>(work: (tx: CpAssetsQueryPort) => Promise<T>): Promise<T>;
}

export interface CpAssetScanner {
  scan(asset: Record<string, unknown>): Promise<boolean>;
}

@Injectable()
export class CpAssetsRepository implements CpAssetsQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async transaction<T>(work: (tx: CpAssetsQueryPort) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    const tx: CpAssetsQueryPort = {
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
export class CpAssetsService {
  constructor(
    private readonly db: CpAssetsRepository,
    @Optional() @Inject(CP_ASSET_SCANNER) private readonly scanner?: CpAssetScanner,
  ) {}

  async createAsset(
    input: CpCreateAssetInput,
    actor: CpAssetScope,
  ): Promise<Record<string, unknown>> {
    const clientId = requiredUuid(
      input.agency_client_id,
      'agency_client_id_required',
      'invalid_agency_client_id',
    );
    const mime = assertMime(input.mime);
    const filename = requiredText(input.filename, 'filename_required');
    const projectId = optionalUuid(input.project_id, 'invalid_project_id');
    await this.requireClient(clientId);
    if (projectId) await this.requireProject(projectId, clientId, actor);

    const result = await this.db.query(
      `INSERT INTO crm_cp_assets (
         tenant_id, agency_client_id, project_id, owner_staff_id, filename, mime, state
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, 'uploading')
       RETURNING *`,
      [CP_TENANT_ID, clientId, projectId, actor.staffId, filename, mime],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async listAssets(scope: CpAssetScope) {
    const bound = assetScope(scope, 2);
    const result = await this.db.query(
      `SELECT a.*, r.license_type, r.owner_name, r.effective_on, r.expiry_on,
              r.territory, r.channels, r.restriction, r.model_release,
              r.talent_release, r.proof_asset_id
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
         LEFT JOIN crm_cp_asset_rights r ON r.asset_id = a.id
        WHERE a.tenant_id = $1 AND ${bound.sql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${PAGE_SIZE}`,
      [CP_TENANT_ID, ...bound.params],
    );
    return { items: result.rows.map(withRightsStatus) };
  }

  async getAsset(id: string, scope: CpAssetScope) {
    const asset = await this.loadAsset(id, scope);
    return withRightsStatus(asset);
  }

  async usageGraph(id: string, scope: CpAssetScope) {
    const asset = await this.loadAsset(id, scope);
    const result = await this.db.query(
      `SELECT v.id AS asset_version_id, v.n, v.storage_key, v.mime, v.bytes,
              u.object_type, u.object_id
         FROM crm_cp_asset_versions v
         LEFT JOIN crm_cp_asset_usages u ON u.asset_version_id = v.id
        WHERE v.asset_id = $1::uuid
        ORDER BY v.n, u.object_type, u.object_id`,
      [asset.id],
    );
    const usages = [...result.rows];
    const projectId = asset.project_id == null ? '' : String(asset.project_id);
    if (
      projectId &&
      !usages.some((row) => row.object_type === 'project' && String(row.object_id) === projectId)
    ) {
      const latest = usages.find((row) => row.asset_version_id != null) ?? {};
      usages.push({
        asset_version_id: latest.asset_version_id ?? null,
        n: latest.n ?? null,
        storage_key: latest.storage_key ?? null,
        mime: latest.mime ?? null,
        bytes: latest.bytes ?? null,
        object_type: 'project',
        object_id: projectId,
      });
    }
    const versions: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const row of usages) {
      const versionId = row.asset_version_id == null ? '' : String(row.asset_version_id);
      if (!versionId || seen.has(versionId)) continue;
      seen.add(versionId);
      versions.push({
        id: versionId,
        n: row.n,
        storage_key: row.storage_key,
        mime: row.mime,
        bytes: row.bytes,
      });
    }
    return { asset_id: asset.id, versions, usages };
  }

  async replaceFile(id: string, input: CpReplaceAssetInput, scope: CpAssetScope) {
    const mime = assertMime(input.mime);
    const storageKey = requiredText(input.storage_key, 'storage_key_required');
    const bytes = requiredNonNegativeInt(input.bytes, 'bytes_required', 'invalid_bytes');
    const filename =
      input.filename == null || input.filename === ''
        ? null
        : requiredText(input.filename, 'filename_required');
    const hash =
      input.hash == null || input.hash === '' ? null : requiredText(input.hash, 'hash_required');
    const metaJson = input.meta_json == null ? {} : input.meta_json;

    const run = async (db: CpAssetsQueryPort) => {
      const asset = await this.loadAsset(id, scope, db, true);
      const inserted = await db.query(
        `INSERT INTO crm_cp_asset_versions (
           asset_id, n, storage_key, mime, bytes, meta_json
         )
         SELECT $1::uuid, COALESCE(MAX(n), 0) + 1, $2, $3, $4, $5::jsonb
           FROM crm_cp_asset_versions
          WHERE asset_id = $1::uuid
         RETURNING *`,
        [asset.id, storageKey, mime, bytes, JSON.stringify(metaJson)],
      );
      const version = inserted.rows[0] ?? cpThrow(500, { error: 'insert_failed' });

      await db.query(
        `UPDATE crm_cp_assets
            SET mime = $3, bytes = $4, hash = COALESCE($5, hash),
                filename = COALESCE($6, filename), state = 'ready'
          WHERE tenant_id = $1 AND id = $2::uuid`,
        [CP_TENANT_ID, asset.id, mime, bytes, hash, filename],
      );

      await db.query(
        `INSERT INTO crm_cp_asset_usages (asset_version_id, object_type, object_id)
         SELECT $1::uuid, u.object_type, u.object_id
           FROM crm_cp_asset_usages u
           JOIN crm_cp_asset_versions v ON v.id = u.asset_version_id
          WHERE v.asset_id = $2::uuid
            AND u.object_type IN ('video_draft', 'project')
            AND u.asset_version_id <> $1::uuid
         ON CONFLICT DO NOTHING`,
        [version.id, asset.id],
      );
      await db.query(
        `DELETE FROM crm_cp_asset_usages u
           USING crm_cp_asset_versions v
          WHERE u.asset_version_id = v.id
            AND v.asset_id = $2::uuid
            AND u.object_type IN ('video_draft', 'project')
            AND u.asset_version_id <> $1::uuid`,
        [version.id, asset.id],
      );
      return version;
    };

    return this.db.transaction ? this.db.transaction(run) : run(this.db);
  }

  async setRights(id: string, rights: CpAssetRightsInput, scope: CpAssetScope) {
    const asset = await this.loadAsset(id, scope);
    const expiryOn = nullableDate(rights.expiry_on, 'invalid_expiry_on');
    const result = await this.db.query(
      `INSERT INTO crm_cp_asset_rights (
         asset_id, license_type, owner_name, effective_on, expiry_on, territory,
         channels, restriction, model_release, talent_release, proof_asset_id
       ) VALUES (
         $1::uuid, $2, $3, $4::date, $5::date, $6::text[], $7::text[],
         $8, $9, $10, $11::uuid
       )
       ON CONFLICT (asset_id) DO UPDATE SET
         license_type = EXCLUDED.license_type,
         owner_name = EXCLUDED.owner_name,
         effective_on = EXCLUDED.effective_on,
         expiry_on = EXCLUDED.expiry_on,
         territory = EXCLUDED.territory,
         channels = EXCLUDED.channels,
         restriction = EXCLUDED.restriction,
         model_release = EXCLUDED.model_release,
         talent_release = EXCLUDED.talent_release,
         proof_asset_id = EXCLUDED.proof_asset_id
       RETURNING *`,
      [
        asset.id,
        nullableText(rights.license_type),
        nullableText(rights.owner_name),
        nullableDate(rights.effective_on, 'invalid_effective_on'),
        expiryOn,
        textArray(rights.territory),
        textArray(rights.channels),
        nullableText(rights.restriction),
        rights.model_release ?? null,
        rights.talent_release ?? null,
        optionalUuid(rights.proof_asset_id, 'invalid_proof_asset_id'),
      ],
    );
    const saved = result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    return { ...saved, rights_status: rightsStatus(expiryOn) };
  }

  async finalizeIngest(id: string, input: CpFinalizeAssetInput, scope: CpAssetScope) {
    const asset = await this.loadAsset(id, scope);
    const bytes = requiredNonNegativeInt(input.bytes, 'bytes_required', 'invalid_bytes');
    const hash = requiredText(input.hash, 'hash_required');
    let scanned = true;
    if (this.scanner) {
      try {
        scanned = await this.scanner.scan({ ...asset, bytes, hash });
      } catch {
        scanned = false;
      }
    }
    const state = scanned ? 'ready' : 'quarantined';
    const result = await this.db.query(
      `UPDATE crm_cp_assets
          SET bytes = $3, hash = $4, state = $5
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING *`,
      [CP_TENANT_ID, asset.id, bytes, hash, state],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async requireClient(clientId: string): Promise<void> {
    const found = await this.db.query(
      `SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`,
      [clientId],
    );
    if (!found.rows[0]) cpThrow(400, { error: 'client_not_found' });
  }

  private async requireProject(
    projectId: string,
    clientId: string,
    scope: CpAssetScope,
  ): Promise<void> {
    const bound = projectScope(scope, 4);
    const found = await this.db.query(
      `SELECT p.id::text
         FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid
          AND p.agency_client_id = $3::uuid AND ${bound.sql}
        LIMIT 1`,
      [CP_TENANT_ID, projectId, clientId, ...bound.params],
    );
    if (!found.rows[0]) cpThrow(404, { error: 'not_found' });
  }

  private async loadAsset(
    id: string,
    scope: CpAssetScope,
    db: CpAssetsQueryPort = this.db,
    forUpdate = false,
  ) {
    const assetId = requiredUuid(id, 'invalid_asset_id', 'invalid_asset_id');
    const bound = assetScope(scope, 3);
    const result = await db.query(
      `SELECT a.*, r.license_type, r.owner_name, r.effective_on, r.expiry_on,
              r.territory, r.channels, r.restriction, r.model_release,
              r.talent_release, r.proof_asset_id
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
         LEFT JOIN crm_cp_asset_rights r ON r.asset_id = a.id
        WHERE a.tenant_id = $1 AND a.id = $2::uuid AND ${bound.sql}
        LIMIT 1${forUpdate ? ' FOR UPDATE OF a' : ''}`,
      [CP_TENANT_ID, assetId, ...bound.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }
}

export function assertMime(value: unknown): (typeof CP_MIME_ALLOWLIST)[number] {
  const mime = String(value ?? '').trim();
  if (!(CP_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
    cpThrow(400, { error: 'mime_not_allowed' });
  }
  return mime as (typeof CP_MIME_ALLOWLIST)[number];
}

export function rightsStatus(
  expiry: string | Date | null | undefined,
  today: string | Date = vietnamToday(),
): 'ok' | 'warn' | 'block' | null {
  const expiryDate = calendarDate(expiry);
  if (!expiryDate) return null;
  const todayDate = calendarDate(today);
  if (!todayDate) cpThrow(400, { error: 'invalid_today' });
  if (expiryDate < todayDate) return 'block';
  return expiryDate <= addCalendarDays(todayDate, 14) ? 'warn' : 'ok';
}

function withRightsStatus(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, rights_status: rightsStatus(row.expiry_on as string | Date | null) };
}

function assetScope(scope: CpAssetScope, startAt: number) {
  if (scope.scope === 'all') return { sql: 'TRUE', params: [] as unknown[] };
  if (scope.scope === 'team' && scope.teamIds?.length) {
    return {
      sql: `(EXISTS (
        SELECT 1
          FROM crm_staff owner
          JOIN staff_users su ON lower(trim(su.email)) = lower(trim(owner.email))
          JOIN staff_user_teams sut ON sut.user_id = su.id
         WHERE owner.id = a.owner_staff_id AND sut.team_id = ANY($${startAt})
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
    sql: `(a.owner_staff_id = $${startAt} OR EXISTS (
      SELECT 1 FROM crm_cp_project_members m
       WHERE m.project_id = p.id AND m.staff_id = $${startAt}
    ))`,
    params: [scope.staffId],
  };
}

function projectScope(scope: CpAssetScope, startAt: number) {
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

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function calendarDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  const text = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) return text;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) cpThrow(400, { error: 'invalid_date' });
  return calendarDate(parsed);
}

function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  const exception = Object.assign(new HttpException(body, status), body);
  exception.message = String(body.error ?? exception.message);
  throw exception;
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function requiredUuid(value: unknown, missingError: string, invalidError: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error: missingError });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error: invalidError });
  }
  return id;
}

function optionalUuid(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  return requiredUuid(value, error, error);
}

function nullableDate(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  const date = calendarDate(String(value));
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) cpThrow(400, { error });
  return date;
}

function textArray(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) cpThrow(400, { error: 'invalid_text_array' });
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function requiredNonNegativeInt(
  value: unknown,
  missingError: string,
  invalidError: string,
): number {
  if (value == null || value === '') cpThrow(400, { error: missingError });
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) cpThrow(400, { error: invalidError });
  return number;
}
