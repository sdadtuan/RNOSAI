import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { hashPortalPassword } from '../portal/portal-password.util';
import {
  CSD_TENANT_ID,
  type CsdChatAccountAdminRow,
  type CsdChatAccountRow,
  type CsdChatPersonRow,
  type CsdChatStaffDirectoryRow,
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

  async findCrmStaff(staffId: number): Promise<CsdChatStaffDirectoryRow | null> {
    const res = await this.db.query(
      `SELECT s.id AS staff_id,
              COALESCE(s.name, '') AS staff_name,
              COALESCE(s.email, '') AS staff_email,
              s.position_id,
              EXISTS (
                SELECT 1 FROM staff_users u
                 WHERE trim(s.email) <> ''
                   AND lower(trim(u.email)) = lower(trim(s.email))
              ) AS has_login
         FROM crm_staff s
        WHERE s.id = $1
        LIMIT 1`,
      [staffId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      staff_id: Number(row.staff_id),
      staff_name: text(row.staff_name),
      staff_email: text(row.staff_email),
      position_id: row.position_id != null ? Number(row.position_id) : null,
      has_login: Boolean(row.has_login),
    };
  }

  async listDirectory(): Promise<CsdChatStaffDirectoryRow[]> {
    const res = await this.db.query(
      `SELECT s.id AS staff_id,
              COALESCE(s.name, '') AS staff_name,
              COALESCE(s.email, '') AS staff_email,
              s.position_id,
              EXISTS (
                SELECT 1 FROM staff_users u
                 WHERE trim(s.email) <> ''
                   AND lower(trim(u.email)) = lower(trim(s.email))
              ) AS has_login
         FROM crm_staff s
        WHERE s.active IS TRUE
        ORDER BY s.name ASC, s.id ASC`,
    );
    return res.rows.map((row) => ({
      staff_id: Number((row as Record<string, unknown>).staff_id),
      staff_name: text((row as Record<string, unknown>).staff_name),
      staff_email: text((row as Record<string, unknown>).staff_email),
      position_id: (row as Record<string, unknown>).position_id != null
        ? Number((row as Record<string, unknown>).position_id)
        : null,
      has_login: Boolean((row as Record<string, unknown>).has_login),
    }));
  }

  async setLoginPassword(input: { staff_id: number; login_password: string }): Promise<{ created: boolean }> {
    const staff = await this.findCrmStaff(input.staff_id);
    if (!staff) {
      throw new NotFoundException({ error: 'staff_not_found' });
    }
    const email = staff.staff_email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException({ error: 'staff_email_required' });
    }
    const hash = hashPortalPassword(input.login_password);
    const existing = await this.db.query(
      `SELECT id::text FROM staff_users WHERE lower(trim(email)) = $1 LIMIT 1`,
      [email],
    );
    if (existing.rows[0]) {
      await this.db.query(
        `UPDATE staff_users SET password_hash = $2, updated_at = NOW() WHERE id = $1::uuid`,
        [existing.rows[0].id, hash],
      );
      return { created: false };
    }
    if (!staff.position_id || staff.position_id <= 0) {
      throw new BadRequestException({ error: 'staff_position_required' });
    }
    await this.db.query(
      `INSERT INTO staff_users (email, password_hash, display_name, position_id, active, account_kind, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, 'staff', NOW(), NOW())`,
      [email, hash, staff.staff_name || email, staff.position_id],
    );
    return { created: true };
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
