import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdAssetKind = 'keyframe' | 'take' | 'master' | 'proxy' | 'package';

export type InsertVdAssetInput = {
  project_id: number;
  job_id: number | null;
  kind: VdAssetKind;
  storage_key?: string;
  url?: string;
  sha256?: string | null;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
};

export type VdAssetRow = {
  id: number;
  project_id: number;
  job_id: number | null;
  kind: VdAssetKind;
  storage_key: string;
  url: string;
  sha256: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: string;
};

type MemoryStore = {
  assets: VdAssetRow[];
  nextId: number;
};

@Injectable()
export class VdAssetRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { assets: [], nextId: 1 };
  last: VdAssetRow = undefined as unknown as VdAssetRow;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_assets LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private remember(row: VdAssetRow): VdAssetRow {
    this.last = row;
    return row;
  }

  private mapRow(row: Record<string, unknown>): VdAssetRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      job_id: row.job_id != null ? Number(row.job_id) : null,
      kind: String(row.kind ?? 'keyframe') as VdAssetKind,
      storage_key: String(row.storage_key ?? ''),
      url: String(row.url ?? ''),
      sha256: row.sha256 != null ? String(row.sha256) : null,
      width: row.width != null ? Number(row.width) : null,
      height: row.height != null ? Number(row.height) : null,
      duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  async insert(input: InsertVdAssetInput): Promise<VdAssetRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_assets (
           project_id, job_id, kind, storage_key, url, sha256, width, height, duration_ms
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, project_id, job_id, kind, storage_key, url, sha256, width, height, duration_ms, created_at`,
        [
          input.project_id,
          input.job_id,
          input.kind,
          input.storage_key ?? '',
          input.url ?? '',
          input.sha256 ?? null,
          input.width ?? null,
          input.height ?? null,
          input.duration_ms ?? null,
        ],
      );
      return this.remember(this.mapRow(res.rows[0] as Record<string, unknown>));
    }
    this.assertWritableOrThrow();
    const now = new Date().toISOString();
    const row: VdAssetRow = {
      id: this.memory.nextId++,
      project_id: input.project_id,
      job_id: input.job_id,
      kind: input.kind,
      storage_key: input.storage_key ?? '',
      url: input.url ?? '',
      sha256: input.sha256 ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.duration_ms ?? null,
      created_at: now,
    };
    this.memory.assets.push(row);
    return this.remember(row);
  }
}
