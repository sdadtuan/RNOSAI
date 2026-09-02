import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  type CsdChatAccountAdminRow,
  type CsdChatAccountRow,
  type CsdChatPersonRow,
} from './csd.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapAccount(row: Record<string, unknown>): CsdChatAccountRow {
  return {
    staff_id: Number(row.staff_id),
    tenant_id: text(row.tenant_id),
    enabled: Boolean(row.enabled),
    display_name_vi: row.display_name_vi != null ? text(row.display_name_vi) : null,
    created_by_staff_id: Number(row.created_by_staff_id),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

@Injectable()
export class CsdChatAccountsRepository implements OnModuleDestroy {
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

  async findByStaffId(staffId: number): Promise<CsdChatAccountRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_chat_accounts WHERE tenant_id = $1 AND staff_id = $2 LIMIT 1`,
      [CSD_TENANT_ID, staffId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapAccount(row) : null;
  }

  async upsert(input: {
    staff_id: number;
    enabled: boolean;
    display_name_vi?: string | null;
    created_by_staff_id: number;
  }): Promise<CsdChatAccountRow> {
    const res = await this.db.query(
      `INSERT INTO csd_chat_accounts (
         staff_id, tenant_id, enabled, display_name_vi, created_by_staff_id
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (staff_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         display_name_vi = COALESCE(EXCLUDED.display_name_vi, csd_chat_accounts.display_name_vi),
         updated_at = NOW()
       RETURNING *`,
      [
        input.staff_id,
        CSD_TENANT_ID,
        input.enabled,
        input.display_name_vi?.trim() || null,
        input.created_by_staff_id,
      ],
    );
    return mapAccount(res.rows[0] as Record<string, unknown>);
  }

  async listAdmin(q?: string): Promise<CsdChatAccountAdminRow[]> {
    const term = (q ?? '').trim();
    const params: unknown[] = [CSD_TENANT_ID];
    let extra = '';
    if (term) {
      params.push(`%${term}%`);
      extra = ` AND (s.name ILIKE $2 OR COALESCE(s.email, '') ILIKE $2 OR CAST(a.staff_id AS text) ILIKE $2)`;
    }
    const res = await this.db.query(
      `SELECT a.*, COALESCE(s.name, '') AS staff_name, COALESCE(s.email, '') AS staff_email
         FROM csd_chat_accounts a
         JOIN crm_staff s ON s.id = a.staff_id
        WHERE a.tenant_id = $1 ${extra}
        ORDER BY s.name ASC, a.staff_id ASC`,
      params,
    );
    return res.rows.map((row) => ({
      ...mapAccount(row as Record<string, unknown>),
      staff_name: text((row as Record<string, unknown>).staff_name),
      staff_email: text((row as Record<string, unknown>).staff_email),
    }));
  }

  async searchPeople(excludeStaffId: number, q: string): Promise<CsdChatPersonRow[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const res = await this.db.query(
      `SELECT a.staff_id,
              COALESCE(NULLIF(a.display_name_vi, ''), s.name) AS display_name_vi
         FROM csd_chat_accounts a
         JOIN crm_staff s ON s.id = a.staff_id
        WHERE a.tenant_id = $1 AND a.enabled IS TRUE
          AND a.staff_id <> $2
          AND (s.name ILIKE $3 OR COALESCE(s.email, '') ILIKE $3)
        LIMIT 20`,
      [CSD_TENANT_ID, excludeStaffId, `%${term}%`],
    );
    return res.rows.map((row) => ({
      staff_id: Number(row.staff_id),
      display_name_vi: text(row.display_name_vi),
    }));
  }
}
