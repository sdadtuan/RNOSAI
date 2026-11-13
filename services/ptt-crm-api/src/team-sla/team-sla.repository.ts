import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  defaultTeamSlaDocument,
  normalizeTeamSlaDocument,
  type TeamSlaDocument,
} from './team-sla-profiles';

export type TeamSlaRow = {
  tenant_id: string;
  document: TeamSlaDocument;
  updated_by: string;
  updated_at: string;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value != null ? String(value) : new Date().toISOString();
}

function localFileCandidates(): string[] {
  const cwd = process.cwd();
  const extra = process.env.TEAM_SLA_PROFILES_PATH?.trim();
  return [
    extra || '',
    path.join(cwd, '../ops-web/.data/team-sla-profiles.json'),
    path.join(cwd, '../../ops-web/.data/team-sla-profiles.json'),
    path.join(cwd, '../../services/ops-web/.data/team-sla-profiles.json'),
    path.join(cwd, 'services/ops-web/.data/team-sla-profiles.json'),
  ].filter(Boolean);
}

function readLocalFile(): TeamSlaDocument | null {
  for (const file of localFileCandidates()) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      return normalizeTeamSlaDocument(raw);
    } catch {
      /* try next */
    }
  }
  return null;
}

@Injectable()
export class TeamSlaRepository implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_team_sla_profiles (
        id          BIGSERIAL PRIMARY KEY,
        tenant_id   TEXT NOT NULL DEFAULT 'default',
        document    JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by  VARCHAR(160) NOT NULL DEFAULT '',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_team_sla_profiles_tenant_uq UNIQUE (tenant_id)
      );
    `);

    const existing = await this.db.query(
      `SELECT 1 FROM crm_team_sla_profiles WHERE tenant_id = 'default' LIMIT 1`,
    );
    if (existing.rows[0]) return;

    const seed = readLocalFile() ?? defaultTeamSlaDocument();
    const seedBy = readLocalFile() ? 'migrated-local-file' : 'seed';
    await this.db.query(
      `INSERT INTO crm_team_sla_profiles (tenant_id, document, updated_by)
       VALUES ('default', $1::jsonb, $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [JSON.stringify(seed), seedBy],
    );
  }

  private mapRow(row: Record<string, unknown>): TeamSlaRow {
    return {
      tenant_id: String(row.tenant_id ?? 'default'),
      document: normalizeTeamSlaDocument(row.document),
      updated_by: String(row.updated_by ?? ''),
      updated_at: iso(row.updated_at),
    };
  }

  async get(tenantId = 'default'): Promise<TeamSlaRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT tenant_id, document, updated_by, updated_at
       FROM crm_team_sla_profiles
       WHERE tenant_id = $1
       LIMIT 1`,
      [tenantId],
    );
    if (result.rows[0]) return this.mapRow(result.rows[0] as Record<string, unknown>);

    const seed = readLocalFile() ?? defaultTeamSlaDocument();
    const inserted = await this.db.query(
      `INSERT INTO crm_team_sla_profiles (tenant_id, document, updated_by)
       VALUES ($1, $2::jsonb, 'seed')
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = crm_team_sla_profiles.updated_at
       RETURNING tenant_id, document, updated_by, updated_at`,
      [tenantId, JSON.stringify(seed)],
    );
    return this.mapRow(inserted.rows[0] as Record<string, unknown>);
  }

  async save(document: TeamSlaDocument, updatedBy: string, tenantId = 'default'): Promise<TeamSlaRow> {
    await this.ensureSchema();
    const normalized = normalizeTeamSlaDocument(document);
    const result = await this.db.query(
      `INSERT INTO crm_team_sla_profiles (tenant_id, document, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE
         SET document = EXCLUDED.document,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING tenant_id, document, updated_by, updated_at`,
      [tenantId, JSON.stringify(normalized), String(updatedBy ?? '').slice(0, 160)],
    );
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }
}
