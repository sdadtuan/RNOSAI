import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID, type IwrExternalShareRow } from './iwr.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapShare(row: Record<string, unknown>): IwrExternalShareRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    approval_id: row.approval_id != null ? text(row.approval_id) : null,
    token: text(row.token),
    allow_email: text(row.allow_email),
    expires_at: text(row.expires_at),
    revoked_at: row.revoked_at != null ? text(row.revoked_at) : null,
    created_by_staff_id: Number(row.created_by_staff_id ?? 0),
    created_at: text(row.created_at),
  };
}

export function newShareToken(): string {
  return randomBytes(24).toString('hex');
}

@Injectable()
export class IwrW6Repository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async insertShare(input: {
    report_id: string;
    approval_id?: string | null;
    allow_email: string;
    expires_at: string;
    created_by_staff_id: number;
    token?: string;
  }): Promise<IwrExternalShareRow> {
    const token = input.token ?? newShareToken();
    const res = await this.db.query(
      `INSERT INTO iwr_external_shares (
         tenant_id, report_id, approval_id, token, allow_email, expires_at, created_by_staff_id
       ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)
       RETURNING *`,
      [
        IWR_TENANT_ID,
        input.report_id,
        input.approval_id ?? null,
        token,
        input.allow_email.toLowerCase(),
        input.expires_at,
        input.created_by_staff_id,
      ],
    );
    return mapShare(res.rows[0]);
  }

  async getShareByToken(token: string): Promise<IwrExternalShareRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_external_shares
        WHERE tenant_id = $1 AND token = $2
          AND revoked_at IS NULL AND expires_at > NOW()
        LIMIT 1`,
      [IWR_TENANT_ID, token],
    );
    return res.rows[0] ? mapShare(res.rows[0]) : null;
  }

  async getShare(id: string): Promise<IwrExternalShareRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_external_shares WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapShare(res.rows[0]) : null;
  }

  async listShares(staffId: number, manage: boolean): Promise<IwrExternalShareRow[]> {
    const res = manage
      ? await this.db.query(
          `SELECT * FROM iwr_external_shares WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
          [IWR_TENANT_ID],
        )
      : await this.db.query(
          `SELECT * FROM iwr_external_shares
            WHERE tenant_id = $1 AND created_by_staff_id = $2
            ORDER BY created_at DESC LIMIT 200`,
          [IWR_TENANT_ID, staffId],
        );
    return res.rows.map(mapShare);
  }

  async revokeShare(id: string): Promise<IwrExternalShareRow | null> {
    const res = await this.db.query(
      `UPDATE iwr_external_shares
          SET revoked_at = NOW()
        WHERE tenant_id = $1 AND id = $2 AND revoked_at IS NULL
        RETURNING *`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapShare(res.rows[0]) : null;
  }
}
