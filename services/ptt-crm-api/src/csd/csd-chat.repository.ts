import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  CsdConversationKind,
  CsdConversationListFilter,
  CsdConversationListItem,
  CsdConversationMemberRow,
  CsdConversationRow,
  CsdConversationStatus,
  CsdMessageRow,
} from './csd.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapConversationListItem(row: Record<string, unknown>): CsdConversationListItem {
  return {
    ...mapConversation(row),
    preview: row.preview != null && text(row.preview) ? text(row.preview) : null,
    unread_count: num(row.unread_count) ?? 0,
    has_p1_or_complaint: Boolean(row.has_p1_or_complaint),
  };
}

function mapConversation(row: Record<string, unknown>): CsdConversationRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    kind: text(row.kind) as CsdConversationKind,
    name_vi: text(row.name_vi),
    description: text(row.description),
    status: text(row.status),
    client_account_id: row.client_account_id != null ? text(row.client_account_id) : null,
    project_ref_kind: row.project_ref_kind != null ? text(row.project_ref_kind) : null,
    project_ref_id: row.project_ref_id != null ? text(row.project_ref_id) : null,
    ticket_id: row.ticket_id != null ? text(row.ticket_id) : null,
    owner_staff_id: num(row.owner_staff_id),
    last_message_at: row.last_message_at ? text(row.last_message_at) : null,
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
  };
}

function mapMember(row: Record<string, unknown>): CsdConversationMemberRow {
  return {
    conversation_id: text(row.conversation_id),
    member_type: 'staff',
    member_staff_id: num(row.member_staff_id) ?? 0,
    role: text(row.role) as CsdConversationMemberRow['role'],
    created_at: text(row.created_at),
  };
}

function mapMessage(row: Record<string, unknown>): CsdMessageRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    conversation_id: text(row.conversation_id),
    author_type: text(row.author_type),
    author_staff_id: num(row.author_staff_id),
    body_text: text(row.body_text),
    reply_to_id: row.reply_to_id != null ? text(row.reply_to_id) : null,
    visibility: row.visibility as CsdMessageRow['visibility'],
    ticket_id: row.ticket_id != null ? text(row.ticket_id) : null,
    created_at: text(row.created_at),
  };
}

@Injectable()
export class CsdChatRepository implements OnModuleDestroy {
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

  async insertConversation(input: {
    kind: CsdConversationKind;
    name_vi: string;
    client_account_id?: string | null;
    project_ref_kind?: string | null;
    project_ref_id?: string | null;
    created_by_staff_id: number;
    extra_members?: { staff_id: number; role: 'member' | 'viewer' }[];
  }): Promise<CsdConversationRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO csd_conversations (
           tenant_id, kind, name_vi, client_account_id,
           project_ref_kind, project_ref_id, owner_staff_id, created_by_staff_id, updated_by_staff_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7)
         RETURNING *`,
        [
          CSD_TENANT_ID,
          input.kind,
          input.name_vi,
          input.client_account_id ?? null,
          input.project_ref_kind ?? null,
          input.project_ref_id ?? null,
          input.created_by_staff_id,
        ],
      );
      await client.query(
        `INSERT INTO csd_conversation_members (
           conversation_id, member_type, member_staff_id, role
         ) VALUES ($1, 'staff', $2, 'owner')`,
        [res.rows[0].id, input.created_by_staff_id],
      );
      for (const member of input.extra_members ?? []) {
        if (member.staff_id === input.created_by_staff_id) continue;
        await client.query(
          `INSERT INTO csd_conversation_members (
             conversation_id, member_type, member_staff_id, role
           ) VALUES ($1, 'staff', $2, $3)`,
          [res.rows[0].id, member.staff_id, member.role],
        );
      }
      await client.query('COMMIT');
      return mapConversation(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findDirectPair(staffA: number, staffB: number): Promise<CsdConversationRow | null> {
    const res = await this.db.query(
      `SELECT c.*
         FROM csd_conversations c
        WHERE c.tenant_id = $1
          AND c.kind = 'direct'
          AND c.is_deleted = FALSE
          AND c.status <> 'closed'
          AND EXISTS (
            SELECT 1 FROM csd_conversation_members m
             WHERE m.conversation_id = c.id AND m.member_staff_id = $2
          )
          AND EXISTS (
            SELECT 1 FROM csd_conversation_members m
             WHERE m.conversation_id = c.id AND m.member_staff_id = $3
          )
          AND (
            SELECT COUNT(*) FROM csd_conversation_members m
             WHERE m.conversation_id = c.id AND m.member_type = 'staff'
          ) = 2
        ORDER BY c.created_at DESC
        LIMIT 1`,
      [CSD_TENANT_ID, staffA, staffB],
    );
    return res.rows[0] ? mapConversation(res.rows[0]) : null;
  }

  async markRead(conversationId: string, staffId: number): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE csd_conversation_members
          SET last_read_at = NOW()
        WHERE conversation_id = $1
          AND member_type = 'staff'
          AND member_staff_id = $2`,
      [conversationId, staffId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listConversationsForMember(query: {
    staffId: number;
    filter?: CsdConversationListFilter;
    kind?: CsdConversationKind;
    client_account_id?: string;
    q?: string;
    limit?: number;
  }): Promise<CsdConversationListItem[]> {
    const params: unknown[] = [CSD_TENANT_ID, query.staffId];
    const where = [
      'c.tenant_id = $1',
      'c.is_deleted = FALSE',
      `EXISTS (
         SELECT 1 FROM csd_conversation_members mem
          WHERE mem.conversation_id = c.id
            AND mem.member_type = 'staff'
            AND mem.member_staff_id = $2
       )`,
    ];

    const filter = query.filter ?? 'all';
    if (filter === 'internal') {
      where.push(`c.kind IN ('direct', 'group')`);
    } else if (filter === 'clients') {
      where.push(`c.kind = 'client'`);
    } else if (filter === 'projects') {
      where.push(`c.kind = 'project'`);
    } else if (filter === 'mentions') {
      where.push(`EXISTS (
        SELECT 1 FROM csd_messages m
         WHERE m.conversation_id = c.id
           AND m.is_deleted = FALSE
           AND m.body_text ~ ('(^|[[:space:]])@' || $2::text || '([^0-9]|$)')
      )`);
    }

    if (query.kind) {
      params.push(query.kind);
      where.push(`c.kind = $${params.length}`);
    }
    if (query.client_account_id) {
      params.push(query.client_account_id);
      where.push(`c.client_account_id = $${params.length}`);
    }
    const q = String(query.q ?? '').trim();
    if (q.length >= 2) {
      params.push(`%${q}%`);
      where.push(`c.name_vi ILIKE $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
    params.push(limit);
    const limitIdx = params.length;

    const res = await this.db.query(
      `SELECT c.*,
              (
                SELECT LEFT(m.body_text, 160)
                  FROM csd_messages m
                 WHERE m.conversation_id = c.id AND m.is_deleted = FALSE
                 ORDER BY m.created_at DESC
                 LIMIT 1
              ) AS preview,
              (
                SELECT COUNT(*)::int
                  FROM csd_messages m
                  JOIN csd_conversation_members mem
                    ON mem.conversation_id = c.id
                   AND mem.member_type = 'staff'
                   AND mem.member_staff_id = $2
                 WHERE m.conversation_id = c.id
                   AND m.is_deleted = FALSE
                   AND m.created_at > COALESCE(mem.last_read_at, c.created_at)
                   AND m.author_staff_id IS DISTINCT FROM $2
              ) AS unread_count,
              EXISTS (
                SELECT 1 FROM csd_tickets t
                 WHERE t.tenant_id = c.tenant_id
                   AND t.is_deleted = FALSE
                   AND (t.priority = 'P1' OR t.ticket_type = 'complaint')
                   AND (
                     t.id = c.ticket_id
                     OR t.id IN (
                       SELECT m.ticket_id FROM csd_messages m
                        WHERE m.conversation_id = c.id AND m.ticket_id IS NOT NULL
                     )
                   )
              ) AS has_p1_or_complaint
         FROM csd_conversations c
        WHERE ${where.join(' AND ')}
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        LIMIT $${limitIdx}`,
      params,
    );

    const items = res.rows.map(mapConversationListItem);
    if (filter === 'unread') {
      return items.filter((row) => row.unread_count > 0);
    }
    return items;
  }

  async listConversations(query: {
    kind?: CsdConversationKind;
    client_account_id?: string;
    limit?: number;
  } = {}): Promise<CsdConversationRow[]> {
    const params: unknown[] = [CSD_TENANT_ID];
    const where = ['tenant_id = $1', 'is_deleted = FALSE'];

    if (query.kind) {
      params.push(query.kind);
      where.push(`kind = $${params.length}`);
    }
    if (query.client_account_id) {
      params.push(query.client_account_id);
      where.push(`client_account_id = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
    params.push(limit);

    const res = await this.db.query(
      `SELECT * FROM csd_conversations
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(last_message_at, created_at) DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.rows.map(mapConversation);
  }

  async getConversation(id: string): Promise<CsdConversationRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_conversations
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [CSD_TENANT_ID, id],
    );
    return res.rows[0] ? mapConversation(res.rows[0]) : null;
  }

  async insertMessage(input: {
    conversation_id: string;
    author_staff_id: number;
    body_text: string;
    reply_to_id?: string | null;
    visibility: 'internal' | 'client';
  }): Promise<CsdMessageRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO csd_messages (
           tenant_id, conversation_id, author_type, author_staff_id,
           body_text, reply_to_id, visibility
         ) VALUES ($1, $2, 'staff', $3, $4, $5, $6)
         RETURNING *`,
        [
          CSD_TENANT_ID,
          input.conversation_id,
          input.author_staff_id,
          input.body_text,
          input.reply_to_id ?? null,
          input.visibility,
        ],
      );
      await client.query(
        `UPDATE csd_conversations
         SET last_message_at = NOW(), updated_at = NOW(), updated_by_staff_id = $3
         WHERE tenant_id = $1 AND id = $2`,
        [CSD_TENANT_ID, input.conversation_id, input.author_staff_id],
      );
      await client.query('COMMIT');
      return mapMessage(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listMessages(
    conversationId: string,
    after?: string,
  ): Promise<CsdMessageRow[]> {
    const params: unknown[] = [CSD_TENANT_ID, conversationId];
    let afterClause = '';
    if (after) {
      params.push(after);
      afterClause = `AND created_at > (SELECT created_at FROM csd_messages WHERE id = $${params.length})`;
    }

    const res = await this.db.query(
      `SELECT * FROM csd_messages
       WHERE tenant_id = $1 AND conversation_id = $2 AND is_deleted = FALSE ${afterClause}
       ORDER BY created_at ASC`,
      params,
    );
    return res.rows.map(mapMessage);
  }

  async getMessage(id: string): Promise<CsdMessageRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_messages
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [CSD_TENANT_ID, id],
    );
    return res.rows[0] ? mapMessage(res.rows[0]) : null;
  }

  async listMembers(conversationId: string): Promise<CsdConversationMemberRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_conversation_members
       WHERE conversation_id = $1 AND member_type = 'staff' AND member_staff_id IS NOT NULL
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return res.rows.map(mapMember);
  }

  async insertMember(input: {
    conversation_id: string;
    member_staff_id: number;
    role: CsdConversationMemberRow['role'];
  }): Promise<CsdConversationMemberRow> {
    const existing = await this.db.query(
      `SELECT * FROM csd_conversation_members
       WHERE conversation_id = $1 AND member_staff_id = $2`,
      [input.conversation_id, input.member_staff_id],
    );
    if (existing.rows[0]) return mapMember(existing.rows[0]);
    const res = await this.db.query(
      `INSERT INTO csd_conversation_members (
         conversation_id, member_type, member_staff_id, role
       ) VALUES ($1, 'staff', $2, $3)
       RETURNING *`,
      [input.conversation_id, input.member_staff_id, input.role],
    );
    return mapMember(res.rows[0]);
  }

  async deleteMember(conversationId: string, memberStaffId: number): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM csd_conversation_members
       WHERE conversation_id = $1 AND member_staff_id = $2 AND role <> 'owner'`,
      [conversationId, memberStaffId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async updateStatus(
    conversationId: string,
    status: CsdConversationStatus,
    actorStaffId: number,
  ): Promise<CsdConversationRow> {
    const res = await this.db.query(
      `UPDATE csd_conversations
       SET status = $3, updated_at = NOW(), updated_by_staff_id = $4
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
       RETURNING *`,
      [CSD_TENANT_ID, conversationId, status, actorStaffId],
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    return mapConversation(res.rows[0]);
  }

  async linkMessageToTicket(messageId: string, ticketId: string): Promise<CsdMessageRow> {
    const res = await this.db.query(
      `UPDATE csd_messages SET ticket_id = $3
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
       RETURNING *`,
      [CSD_TENANT_ID, messageId, ticketId],
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_message_not_found' });
    return mapMessage(res.rows[0]);
  }
}
