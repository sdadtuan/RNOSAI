import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  type CsdChatFriendshipRow,
  type CsdChatFriendshipStatus,
  type CsdChatPersonRow,
} from './csd.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapFriendship(row: Record<string, unknown>): CsdChatFriendshipRow {
  return {
    id: text(row.id),
    staff_lo: Number(row.staff_lo),
    staff_hi: Number(row.staff_hi),
    requester_staff_id: Number(row.requester_staff_id),
    addressee_staff_id: Number(row.addressee_staff_id),
    status: text(row.status) as CsdChatFriendshipStatus,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

@Injectable()
export class CsdChatFriendsRepository implements OnModuleDestroy {
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

  async findPair(staffLo: number, staffHi: number): Promise<CsdChatFriendshipRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_chat_friendships
        WHERE tenant_id = $1 AND staff_lo = $2 AND staff_hi = $3
        LIMIT 1`,
      [CSD_TENANT_ID, staffLo, staffHi],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapFriendship(row) : null;
  }

  async findById(id: string): Promise<CsdChatFriendshipRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_chat_friendships WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [CSD_TENANT_ID, id],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapFriendship(row) : null;
  }

  async insertPending(input: {
    staff_lo: number;
    staff_hi: number;
    requester_staff_id: number;
    addressee_staff_id: number;
  }): Promise<CsdChatFriendshipRow> {
    const res = await this.db.query(
      `INSERT INTO csd_chat_friendships (
         tenant_id, staff_lo, staff_hi, requester_staff_id, addressee_staff_id, status
       ) VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [CSD_TENANT_ID, input.staff_lo, input.staff_hi, input.requester_staff_id, input.addressee_staff_id],
    );
    return mapFriendship(res.rows[0] as Record<string, unknown>);
  }

  async setStatus(id: string, status: CsdChatFriendshipStatus): Promise<CsdChatFriendshipRow> {
    const res = await this.db.query(
      `UPDATE csd_chat_friendships
          SET status = $3, updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [CSD_TENANT_ID, id, status],
    );
    return mapFriendship(res.rows[0] as Record<string, unknown>);
  }

  async setBlocked(id: string, blockerStaffId: number, blockedStaffId: number): Promise<CsdChatFriendshipRow> {
    const res = await this.db.query(
      `UPDATE csd_chat_friendships
          SET status = 'blocked',
              requester_staff_id = $3,
              addressee_staff_id = $4,
              updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [CSD_TENANT_ID, id, blockerStaffId, blockedStaffId],
    );
    return mapFriendship(res.rows[0] as Record<string, unknown>);
  }

  async deleteById(id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM csd_chat_friendships WHERE tenant_id = $1 AND id = $2`,
      [CSD_TENANT_ID, id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listAcceptedPeople(staffId: number): Promise<CsdChatPersonRow[]> {
    const res = await this.db.query(
      `SELECT peer.staff_id,
              COALESCE(NULLIF(a.display_name_vi, ''), s.name, '') AS display_name_vi
         FROM csd_chat_friendships f
         JOIN LATERAL (
           SELECT CASE WHEN f.staff_lo = $2 THEN f.staff_hi ELSE f.staff_lo END AS staff_id
         ) peer ON TRUE
         JOIN crm_staff s ON s.id = peer.staff_id
         LEFT JOIN csd_chat_accounts a ON a.staff_id = peer.staff_id AND a.tenant_id = $1
        WHERE f.tenant_id = $1
          AND f.status = 'accepted'
          AND (f.staff_lo = $2 OR f.staff_hi = $2)
        ORDER BY display_name_vi ASC`,
      [CSD_TENANT_ID, staffId],
    );
    return res.rows.map((row) => ({
      staff_id: Number(row.staff_id),
      display_name_vi: text(row.display_name_vi),
    }));
  }

  async listPendingIncoming(staffId: number): Promise<CsdChatFriendshipRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_chat_friendships
        WHERE tenant_id = $1 AND addressee_staff_id = $2 AND status = 'pending'
        ORDER BY created_at DESC`,
      [CSD_TENANT_ID, staffId],
    );
    return res.rows.map((row) => mapFriendship(row as Record<string, unknown>));
  }

  async listPendingOutgoing(staffId: number): Promise<CsdChatFriendshipRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_chat_friendships
        WHERE tenant_id = $1 AND requester_staff_id = $2 AND status = 'pending'
        ORDER BY created_at DESC`,
      [CSD_TENANT_ID, staffId],
    );
    return res.rows.map((row) => mapFriendship(row as Record<string, unknown>));
  }

  async listPeerStaffIds(staffId: number): Promise<number[]> {
    const res = await this.db.query(
      `SELECT CASE WHEN staff_lo = $2 THEN staff_hi ELSE staff_lo END AS peer_id
         FROM csd_chat_friendships
        WHERE tenant_id = $1 AND (staff_lo = $2 OR staff_hi = $2)`,
      [CSD_TENANT_ID, staffId],
    );
    return res.rows.map((row) => Number(row.peer_id));
  }
}
