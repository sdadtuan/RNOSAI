import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { assetScope, CpAssetScope } from './cp-assets.service';
import { CP_TENANT_ID } from './cp-audit.repository';

export const CP_COLLECTIONS_QUERY = 'CP_COLLECTIONS_QUERY';
export const CP_SMART_FILTER_KEYS = [
  'mime',
  'state',
  'project_id',
  'agency_client_id',
  'tag',
] as const;

export type CpSmartFilter = Partial<Record<(typeof CP_SMART_FILTER_KEYS)[number], string>>;

export type CpCollectionInput = {
  name?: string;
  smart_filter_json?: unknown;
};

export type CpCollectionItemInput = {
  asset_id?: string;
};

export interface CpCollectionsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpCollectionsRepository implements CpCollectionsQueryPort, OnModuleDestroy {
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
export class CpCollectionsService {
  constructor(@Inject(CP_COLLECTIONS_QUERY) private readonly db: CpCollectionsQueryPort) {}

  async list(scope: CpAssetScope) {
    const bound = collectionScope(scope, 2);
    const result = await this.db.query(
      `SELECT c.*
         FROM crm_cp_collections c
        WHERE c.tenant_id = $1 AND ${bound.sql}
        ORDER BY c.name, c.id`,
      [CP_TENANT_ID, ...bound.params],
    );
    return { items: result.rows };
  }

  async create(input: CpCollectionInput, staffId: number) {
    const name = requiredText(input.name, 'name_required');
    const filter = parseSmartFilter(input.smart_filter_json);
    const result = await this.db.query(
      `INSERT INTO crm_cp_collections (tenant_id, name, smart_filter_json, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [CP_TENANT_ID, name, filter ? JSON.stringify(filter) : null, staffId],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async get(id: string, scope: CpAssetScope) {
    const collection = await this.loadCollection(id, scope);
    const filter = parseSmartFilter(collection.smart_filter_json);
    const items = filter
      ? await this.listSmartAssets(filter, scope)
      : await this.listManualAssets(String(collection.id), scope);
    return { ...collection, items };
  }

  async addItem(id: string, input: CpCollectionItemInput, scope: CpAssetScope) {
    const collection = await this.loadCollection(id, scope);
    if (parseSmartFilter(collection.smart_filter_json)) {
      cpThrow(400, { error: 'smart_collection_readonly' });
    }
    const assetId = requiredUuid(input.asset_id, 'asset_id_required', 'invalid_asset_id');
    await this.loadScopedAsset(assetId, scope);
    const result = await this.db.query(
      `INSERT INTO crm_cp_collection_items (collection_id, asset_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (collection_id, asset_id) DO NOTHING
       RETURNING collection_id, asset_id`,
      [collection.id, assetId],
    );
    return result.rows[0] ?? { collection_id: collection.id, asset_id: assetId };
  }

  async removeItem(id: string, assetId: string, scope: CpAssetScope) {
    const collection = await this.loadCollection(id, scope);
    if (parseSmartFilter(collection.smart_filter_json)) {
      cpThrow(400, { error: 'smart_collection_readonly' });
    }
    const scopedId = requiredUuid(assetId, 'invalid_asset_id', 'invalid_asset_id');
    await this.loadScopedAsset(scopedId, scope);
    await this.db.query(
      `DELETE FROM crm_cp_collection_items
        WHERE collection_id = $1::uuid AND asset_id = $2::uuid`,
      [collection.id, scopedId],
    );
    return { ok: true };
  }

  async quality(scope: CpAssetScope) {
    const bound = assetScope(scope, 2);
    const result = await this.db.query(
      `SELECT a.*
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
        WHERE a.tenant_id = $1 AND ${bound.sql}
        ORDER BY a.created_at DESC, a.id DESC`,
      [CP_TENANT_ID, ...bound.params],
    );
    const missing = result.rows.filter(isMissingMetadata);
    const byHash = new Map<string, Record<string, unknown>[]>();
    for (const row of result.rows) {
      const hash = String(row.hash ?? '').trim();
      if (!hash) continue;
      const group = byHash.get(hash) ?? [];
      group.push(row);
      byHash.set(hash, group);
    }
    const duplicates = [...byHash.entries()]
      .filter(([, items]) => items.length > 1)
      .map(([hash, items]) => ({ hash, count: items.length, items }));
    return {
      missing_metadata_count: missing.length,
      missing_metadata: missing,
      duplicates,
    };
  }

  private async loadCollection(id: string, scope: CpAssetScope) {
    const collectionId = requiredUuid(id, 'invalid_collection_id', 'invalid_collection_id');
    const bound = collectionScope(scope, 3);
    const result = await this.db.query(
      `SELECT c.*
         FROM crm_cp_collections c
        WHERE c.tenant_id = $1 AND c.id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [CP_TENANT_ID, collectionId, ...bound.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadScopedAsset(id: string, scope: CpAssetScope) {
    const bound = assetScope(scope, 3);
    const result = await this.db.query(
      `SELECT a.*
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
        WHERE a.tenant_id = $1 AND a.id = $2::uuid AND ${bound.sql}
        LIMIT 1`,
      [CP_TENANT_ID, id, ...bound.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async listSmartAssets(filter: CpSmartFilter, scope: CpAssetScope) {
    const bound = assetScope(scope, 2);
    const extra = smartFilterSql(filter, 2 + bound.params.length);
    const result = await this.db.query(
      `SELECT a.*
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
        WHERE a.tenant_id = $1 AND ${bound.sql} AND ${extra.sql}
        ORDER BY a.created_at DESC, a.id DESC`,
      [CP_TENANT_ID, ...bound.params, ...extra.params],
    );
    return result.rows;
  }

  private async listManualAssets(collectionId: string, scope: CpAssetScope) {
    const bound = assetScope(scope, 3);
    const result = await this.db.query(
      `SELECT a.*
         FROM crm_cp_assets a
         LEFT JOIN crm_cp_projects p ON p.id = a.project_id
         JOIN crm_cp_collection_items i ON i.asset_id = a.id
        WHERE a.tenant_id = $1 AND i.collection_id = $2::uuid AND ${bound.sql}
        ORDER BY a.created_at DESC, a.id DESC`,
      [CP_TENANT_ID, collectionId, ...bound.params],
    );
    return result.rows;
  }
}

export function collectionScope(scope: CpAssetScope, startAt: number) {
  if (scope.scope === 'all') return { sql: 'TRUE', params: [] as unknown[] };
  if (scope.scope === 'team' && scope.teamIds?.length) {
    return {
      sql: `EXISTS (
        SELECT 1
          FROM crm_staff owner
          JOIN staff_users su ON lower(trim(su.email)) = lower(trim(owner.email))
          JOIN staff_user_teams sut ON sut.user_id = su.id
         WHERE owner.id = c.created_by AND sut.team_id = ANY($${startAt})
      )`,
      params: [scope.teamIds] as unknown[],
    };
  }
  return {
    sql: `c.created_by = $${startAt}`,
    params: [scope.staffId] as unknown[],
  };
}

export function parseSmartFilter(value: unknown): CpSmartFilter | null {
  if (value == null || value === '') return null;
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      cpThrow(400, { error: 'invalid_smart_filter' });
    }
  }
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    cpThrow(400, { error: 'invalid_smart_filter' });
  }
  const filter: CpSmartFilter = {};
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    if (!(CP_SMART_FILTER_KEYS as readonly string[]).includes(key)) {
      cpThrow(400, { error: 'invalid_smart_filter' });
    }
    if (item == null || item === '') continue;
    const text = String(item).trim();
    if (!text) continue;
    if (key === 'project_id' || key === 'agency_client_id') {
      requiredUuid(text, 'invalid_smart_filter', 'invalid_smart_filter');
    }
    filter[key as keyof CpSmartFilter] = text;
  }
  return Object.keys(filter).length ? filter : null;
}

function smartFilterSql(filter: CpSmartFilter, startAt: number) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let index = startAt;
  if (filter.mime) {
    clauses.push(`a.mime LIKE $${index} || '%'`);
    params.push(filter.mime);
    index += 1;
  }
  if (filter.state) {
    clauses.push(`a.state = $${index}`);
    params.push(filter.state);
    index += 1;
  }
  if (filter.project_id) {
    clauses.push(`a.project_id = $${index}::uuid`);
    params.push(filter.project_id);
    index += 1;
  }
  if (filter.agency_client_id) {
    clauses.push(`a.agency_client_id = $${index}::uuid`);
    params.push(filter.agency_client_id);
    index += 1;
  }
  if (filter.tag) {
    clauses.push(`EXISTS (
      SELECT 1 FROM crm_cp_asset_versions v
       WHERE v.asset_id = a.id
         AND v.meta_json -> 'tags' ? $${index}
    )`);
    params.push(filter.tag);
  }
  return { sql: clauses.length ? clauses.join(' AND ') : 'TRUE', params };
}

function isMissingMetadata(row: Record<string, unknown>): boolean {
  const filename = String(row.filename ?? '').trim();
  const mime = String(row.mime ?? '').trim();
  const hash = row.hash == null ? '' : String(row.hash).trim();
  return !filename || !mime || !hash || row.bytes == null || row.bytes === '';
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

function requiredUuid(value: unknown, missingError: string, invalidError: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error: missingError });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error: invalidError });
  }
  return id;
}
