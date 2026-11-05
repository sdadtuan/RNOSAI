import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { deviceLabelFromUa } from './staff-device-label.util';
import type { StaffLoginMethod, StaffSessionListItem } from './staff-account.types';

export type StaffSessionDbRow = {
  id: string;
  user_id: string;
  login_method: StaffLoginMethod;
  user_agent: string;
  ip: string | null;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
};

export function isUuidStaffUserId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim(),
  );
}

export function sessionToListItem(
  row: StaffSessionDbRow,
  currentSid: string | null,
): StaffSessionListItem {
  return {
    id: row.id,
    current: currentSid != null && row.id === currentSid,
    login_method: row.login_method,
    device_label: deviceLabelFromUa(row.user_agent),
    ip: row.ip,
    created_at: row.created_at.toISOString(),
    last_seen_at: row.last_seen_at.toISOString(),
    expires_at: row.expires_at.toISOString(),
    revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
  };
}

function mapRow(row: Record<string, unknown>): StaffSessionDbRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    login_method: String(row.login_method) as StaffLoginMethod,
    user_agent: String(row.user_agent ?? ''),
    ip: row.ip != null ? String(row.ip) : null,
    created_at: new Date(String(row.created_at)),
    last_seen_at: new Date(String(row.last_seen_at)),
    expires_at: new Date(String(row.expires_at)),
    revoked_at: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    revoke_reason: row.revoke_reason != null ? String(row.revoke_reason) : null,
  };
}

@Injectable()
export class StaffSessionsRepository {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async insert(row: {
    id: string;
    userId: string;
    loginMethod: StaffLoginMethod;
    userAgent: string;
    ip: string | null;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO staff_sessions
         (id, user_id, login_method, user_agent, ip, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::inet, $6)`,
      [row.id, row.userId, row.loginMethod, row.userAgent, row.ip, row.expiresAt],
    );
  }

  async touch(id: string, expiresAt: Date, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE staff_sessions
       SET last_seen_at = $2, expires_at = $3
       WHERE id = $1::uuid AND revoked_at IS NULL`,
      [id, now, expiresAt],
    );
  }

  async findById(id: string): Promise<StaffSessionDbRow | null> {
    const result = await this.db.query(
      `SELECT id::text, user_id::text, login_method, user_agent, ip::text, created_at, last_seen_at, expires_at, revoked_at, revoke_reason
       FROM staff_sessions WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async listForUser(userId: string, now: Date): Promise<StaffSessionDbRow[]> {
    const result = await this.db.query(
      `SELECT id::text, user_id::text, login_method, user_agent, ip::text, created_at, last_seen_at, expires_at, revoked_at, revoke_reason
       FROM staff_sessions
       WHERE user_id = $1::uuid
         AND (revoked_at IS NULL OR revoked_at > $2::timestamptz - interval '7 days')
       ORDER BY last_seen_at DESC
       LIMIT 20`,
      [userId, now],
    );
    return result.rows.map(mapRow);
  }

  async revoke(
    id: string,
    userId: string,
    reason: string,
    now: Date,
  ): Promise<'revoked' | 'already_revoked' | 'not_found'> {
    const existing = await this.findById(id);
    if (!existing || existing.user_id !== userId) return 'not_found';
    if (existing.revoked_at) return 'already_revoked';
    const result = await this.db.query(
      `UPDATE staff_sessions
       SET revoked_at = $3, revoke_reason = $4
       WHERE id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL`,
      [id, userId, now, reason],
    );
    return (result.rowCount ?? 0) > 0 ? 'revoked' : 'already_revoked';
  }

  async revokeOthers(userId: string, keepId: string, reason: string, now: Date): Promise<number> {
    const result = await this.db.query(
      `UPDATE staff_sessions
       SET revoked_at = $3, revoke_reason = $4
       WHERE user_id = $1::uuid AND id <> $2::uuid AND revoked_at IS NULL`,
      [userId, keepId, now, reason],
    );
    return result.rowCount ?? 0;
  }

  async revokeAll(userId: string, reason: string, now: Date): Promise<number> {
    const result = await this.db.query(
      `UPDATE staff_sessions
       SET revoked_at = $2, revoke_reason = $3
       WHERE user_id = $1::uuid AND revoked_at IS NULL`,
      [userId, now, reason],
    );
    return result.rowCount ?? 0;
  }
}
