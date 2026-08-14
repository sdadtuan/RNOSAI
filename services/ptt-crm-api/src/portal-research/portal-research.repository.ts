import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { PortalResearchVersionRecord } from './portal-research.types';

function parseJsonCol<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

@Injectable()
export class PortalResearchRepository implements OnModuleDestroy {
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

  async listPortalVisibleVersions(clientId: string): Promise<PortalResearchVersionRecord[]> {
    const result = await this.db.query(
      `SELECT v.id, v.report_id, v.version, v.content_snapshot, v.generated_by,
              v.content_hash, v.embargo_until::text AS embargo_until,
              v.expires_at::text AS expires_at, v.portal_visible,
              v.created_at::text AS created_at, p.client_id
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       JOIN crm_research_projects p ON p.id = r.project_id
       WHERE v.portal_visible = true AND p.client_id = $1
       ORDER BY v.created_at DESC, v.id DESC`,
      [clientId],
    );
    return result.rows.map((row) => this.mapPortalVersion(row));
  }

  async getPortalReportVersion(versionId: number): Promise<PortalResearchVersionRecord | null> {
    const result = await this.db.query(
      `SELECT v.id, v.report_id, v.version, v.content_snapshot, v.generated_by,
              v.content_hash, v.embargo_until::text AS embargo_until,
              v.expires_at::text AS expires_at, v.portal_visible,
              v.created_at::text AS created_at, p.client_id
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       JOIN crm_research_projects p ON p.id = r.project_id
       WHERE v.id = $1`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? this.mapPortalVersion(row) : null;
  }

  private mapPortalVersion(row: Record<string, unknown>): PortalResearchVersionRecord {
    return {
      id: Number(row.id),
      report_id: Number(row.report_id),
      version: Number(row.version),
      content_snapshot: parseJsonCol<Record<string, unknown>>(row.content_snapshot, {}),
      generated_by: row.generated_by != null ? String(row.generated_by) : null,
      content_hash: String(row.content_hash ?? ''),
      embargo_until: row.embargo_until != null ? String(row.embargo_until) : null,
      expires_at: row.expires_at != null ? String(row.expires_at) : null,
      portal_visible: Boolean(row.portal_visible),
      created_at: String(row.created_at ?? ''),
      client_id: String(row.client_id),
    };
  }
}
