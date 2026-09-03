import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  CsdPriority,
  CsdSlaPolicyRow,
  CsdSlaPolicyTargetRow,
  CsdTicketActivityRow,
  CsdTicketCommentRow,
  CsdTicketListQuery,
  CsdTicketRow,
  CsdTicketStatus,
  InsertCsdTicketInput,
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

function mapTicket(row: Record<string, unknown>): CsdTicketRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    code: text(row.code),
    factory: text(row.factory),
    title: text(row.title),
    description: text(row.description),
    ticket_type: text(row.ticket_type),
    category: text(row.category),
    sub_category: text(row.sub_category),
    status: text(row.status) as CsdTicketStatus,
    priority: text(row.priority) as CsdPriority,
    severity: text(row.severity),
    scope_status: row.scope_status as CsdTicketRow['scope_status'],
    source_type: row.source_type as CsdTicketRow['source_type'],
    source_id: row.source_id != null ? text(row.source_id) : null,
    client_account_id: row.client_account_id != null ? text(row.client_account_id) : null,
    customer_id: num(row.customer_id),
    assignee_staff_id: num(row.assignee_staff_id),
    owner_staff_id: num(row.owner_staff_id),
    sla_policy_id: row.sla_policy_id != null ? text(row.sla_policy_id) : null,
    sla_response_due_at: row.sla_response_due_at ? text(row.sla_response_due_at) : null,
    sla_resolution_due_at: row.sla_resolution_due_at ? text(row.sla_resolution_due_at) : null,
    sla_status: row.sla_status as CsdTicketRow['sla_status'],
    sla_paused: Boolean(row.sla_paused),
    sla_paused_seconds: Number(row.sla_paused_seconds ?? 0),
    resolution_note: text(row.resolution_note),
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
    updated_at: text(row.updated_at),
    updated_by_staff_id: num(row.updated_by_staff_id),
    assigned_at: row.assigned_at ? text(row.assigned_at) : null,
    resolved_at: row.resolved_at ? text(row.resolved_at) : null,
    closed_at: row.closed_at ? text(row.closed_at) : null,
    first_response_at: row.first_response_at ? text(row.first_response_at) : null,
  };
}

function mapActivity(row: Record<string, unknown>): CsdTicketActivityRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    ticket_id: text(row.ticket_id),
    actor_type: text(row.actor_type),
    actor_staff_id: num(row.actor_staff_id),
    event_key: text(row.event_key),
    from_value: row.from_value != null ? text(row.from_value) : null,
    to_value: row.to_value != null ? text(row.to_value) : null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: text(row.created_at),
  };
}

function mapComment(row: Record<string, unknown>): CsdTicketCommentRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    ticket_id: text(row.ticket_id),
    visibility: row.visibility as CsdTicketCommentRow['visibility'],
    author_type: text(row.author_type),
    author_staff_id: num(row.author_staff_id),
    body_text: text(row.body_text),
    created_at: text(row.created_at),
  };
}

@Injectable()
export class CsdTicketsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  getPool(): Pool {
    return this.db;
  }

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

  async nextTicketCode(): Promise<string> {
    const row = await this.db.query(`SELECT csd_next_ticket_code() AS code`);
    return text(row.rows[0]?.code);
  }

  async getDefaultSlaPolicy(): Promise<CsdSlaPolicyRow & { targets: CsdSlaPolicyTargetRow[]; holidays: string[] }> {
    const policyRes = await this.db.query(
      `SELECT p.*, COALESCE(
         (SELECT array_agg(h.holiday_date::text ORDER BY h.holiday_date)
          FROM csd_business_calendar h
          WHERE h.tenant_id = p.tenant_id),
         ARRAY[]::text[]
       ) AS holidays
       FROM csd_sla_policies p
       WHERE p.tenant_id = $1 AND p.is_default = TRUE AND p.is_deleted = FALSE
       LIMIT 1`,
      [CSD_TENANT_ID],
    );
    const policy = policyRes.rows[0];
    if (!policy) throw new NotFoundException({ error: 'csd_sla_policy_missing' });

    const targetsRes = await this.db.query(
      `SELECT policy_id, priority, response_minutes, resolution_minutes
       FROM csd_sla_policy_targets
       WHERE policy_id = $1`,
      [policy.id],
    );

    return {
      id: text(policy.id),
      tenant_id: text(policy.tenant_id),
      code: text(policy.code),
      name_vi: text(policy.name_vi),
      workday_start: text(policy.workday_start).slice(0, 5),
      workday_end: text(policy.workday_end).slice(0, 5),
      workdays: (policy.workdays as number[]) ?? [1, 2, 3, 4, 5, 6],
      at_risk_pct: Number(policy.at_risk_pct),
      near_breach_pct: Number(policy.near_breach_pct),
      pause_on_waiting_client: Boolean(policy.pause_on_waiting_client),
      pause_on_internal_approval: Boolean(policy.pause_on_internal_approval),
      targets: targetsRes.rows.map((t) => ({
        policy_id: text(t.policy_id),
        priority: text(t.priority) as CsdPriority,
        response_minutes: Number(t.response_minutes),
        resolution_minutes: Number(t.resolution_minutes),
      })),
      holidays: (policy.holidays as string[]) ?? [],
    };
  }

  async findBySource(sourceType: string, sourceId: string): Promise<CsdTicketRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_tickets
       WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3 AND is_deleted = FALSE
       LIMIT 1`,
      [CSD_TENANT_ID, sourceType, sourceId],
    );
    return res.rows[0] ? mapTicket(res.rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<CsdTicketRow | null> {
    const res = await this.db.query(
      `SELECT t.*
       FROM csd_idempotency_keys k
       JOIN csd_tickets t ON t.id::text = k.entity_id
       WHERE k.tenant_id = $1 AND k.idempotency_key = $2 AND t.is_deleted = FALSE
       LIMIT 1`,
      [CSD_TENANT_ID, key],
    );
    return res.rows[0] ? mapTicket(res.rows[0]) : null;
  }

  async insert(input: InsertCsdTicketInput, idempotencyKey?: string): Promise<CsdTicketRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO csd_tickets (
           tenant_id, code, title, description, ticket_type, priority, status,
           source_type, source_id, client_account_id, customer_id, assignee_staff_id,
           sla_policy_id, sla_response_due_at, sla_resolution_due_at,
           created_by_staff_id, updated_by_staff_id, assigned_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15,
           $16, $16, CASE WHEN $12 IS NOT NULL THEN NOW() ELSE NULL END
         )
         RETURNING *`,
        [
          CSD_TENANT_ID,
          input.code,
          input.title,
          input.description,
          input.ticket_type,
          input.priority,
          input.status,
          input.source_type,
          input.source_id,
          input.client_account_id,
          input.customer_id,
          input.assignee_staff_id,
          input.sla_policy_id,
          input.sla_response_due_at.toISOString(),
          input.sla_resolution_due_at.toISOString(),
          input.created_by_staff_id,
        ],
      );
      const ticket = mapTicket(res.rows[0]);

      if (idempotencyKey) {
        await client.query(
          `INSERT INTO csd_idempotency_keys (tenant_id, idempotency_key, entity_type, entity_id)
           VALUES ($1, $2, 'ticket', $3)
           ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
          [CSD_TENANT_ID, idempotencyKey, ticket.id],
        );
      }

      await client.query('COMMIT');
      return ticket;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async get(id: string): Promise<CsdTicketRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_tickets WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [CSD_TENANT_ID, id],
    );
    return res.rows[0] ? mapTicket(res.rows[0]) : null;
  }

  async list(query: CsdTicketListQuery = {}): Promise<{ items: CsdTicketRow[]; next_cursor: string | null }> {
    const params: unknown[] = [CSD_TENANT_ID];
    const where: string[] = ['tenant_id = $1', 'is_deleted = FALSE'];

    if (query.status) {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    if (query.priority) {
      params.push(query.priority);
      where.push(`priority = $${params.length}`);
    }
    if (query.assignee_staff_id != null) {
      params.push(query.assignee_staff_id);
      where.push(`assignee_staff_id = $${params.length}`);
    }
    if (query.client_account_id) {
      params.push(query.client_account_id);
      where.push(`client_account_id = $${params.length}`);
    }
    if (query.q) {
      params.push(`%${String(query.q).trim()}%`);
      const ph = `$${params.length}`;
      where.push(`(title ILIKE ${ph} OR code ILIKE ${ph} OR description ILIKE ${ph})`);
    }
    if (query.cursor) {
      const [createdAt, id] = String(query.cursor).split('|');
      if (createdAt && id) {
        params.push(createdAt, id);
        where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
      }
    }

    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
    params.push(limit + 1);

    const res = await this.db.query(
      `SELECT * FROM csd_tickets
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );

    const rows = res.rows.map(mapTicket);
    let next_cursor: string | null = null;
    if (rows.length > limit) {
      const last = rows[limit - 1];
      next_cursor = `${last.created_at}|${last.id}`;
      rows.length = limit;
    }
    return { items: rows, next_cursor };
  }

  async updateStatus(
    id: string,
    status: CsdTicketStatus,
    actorStaffId: number,
    patch: Partial<{ resolution_note: string; resolved_at: Date; sla_paused: boolean }> = {},
  ): Promise<CsdTicketRow> {
    const sets = ['status = $3', 'updated_by_staff_id = $4', 'updated_at = NOW()'];
    const params: unknown[] = [CSD_TENANT_ID, id, status, actorStaffId];
    if (patch.resolution_note != null) {
      params.push(patch.resolution_note);
      sets.push(`resolution_note = $${params.length}`);
    }
    if (patch.resolved_at) {
      params.push(patch.resolved_at.toISOString());
      sets.push(`resolved_at = $${params.length}`);
    }
    if (patch.sla_paused != null) {
      params.push(patch.sla_paused);
      sets.push(`sla_paused = $${params.length}`);
    }

    const res = await this.db.query(
      `UPDATE csd_tickets SET ${sets.join(', ')}
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
       RETURNING *`,
      params,
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_ticket_not_found' });
    return mapTicket(res.rows[0]);
  }

  async assign(id: string, assigneeStaffId: number, actorStaffId: number): Promise<CsdTicketRow> {
    const res = await this.db.query(
      `UPDATE csd_tickets
       SET assignee_staff_id = $3,
           assigned_at = NOW(),
           updated_by_staff_id = $4,
           updated_at = NOW(),
           status = CASE WHEN status IN ('new', 'triaged', 'reopened') THEN 'assigned' ELSE status END
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
       RETURNING *`,
      [CSD_TENANT_ID, id, assigneeStaffId, actorStaffId],
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_ticket_not_found' });
    return mapTicket(res.rows[0]);
  }

  async addComment(input: {
    ticket_id: string;
    visibility: 'public' | 'internal';
    author_staff_id: number;
    body_text: string;
  }): Promise<CsdTicketCommentRow> {
    const res = await this.db.query(
      `INSERT INTO csd_ticket_comments (
         tenant_id, ticket_id, visibility, author_type, author_staff_id, body_text
       ) VALUES ($1, $2, $3, 'staff', $4, $5)
       RETURNING *`,
      [CSD_TENANT_ID, input.ticket_id, input.visibility, input.author_staff_id, input.body_text],
    );
    return mapComment(res.rows[0]);
  }

  async insertActivity(input: {
    ticket_id: string;
    actor_staff_id: number | null;
    actor_type?: string;
    event_key: string;
    from_value?: string | null;
    to_value?: string | null;
    metadata_json?: Record<string, unknown>;
  }): Promise<CsdTicketActivityRow> {
    const res = await this.db.query(
      `INSERT INTO csd_ticket_activities (
         tenant_id, ticket_id, actor_type, actor_staff_id, event_key, from_value, to_value, metadata_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        CSD_TENANT_ID,
        input.ticket_id,
        input.actor_type ?? 'user',
        input.actor_staff_id,
        input.event_key,
        input.from_value ?? null,
        input.to_value ?? null,
        input.metadata_json ?? {},
      ],
    );
    return mapActivity(res.rows[0]);
  }

  async listActivities(ticketId: string): Promise<CsdTicketActivityRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_ticket_activities
       WHERE tenant_id = $1 AND ticket_id = $2
       ORDER BY created_at ASC`,
      [CSD_TENANT_ID, ticketId],
    );
    return res.rows.map(mapActivity);
  }

  async listComments(ticketId: string): Promise<CsdTicketCommentRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_ticket_comments
       WHERE tenant_id = $1 AND ticket_id = $2 AND is_deleted = FALSE
       ORDER BY created_at ASC`,
      [CSD_TENANT_ID, ticketId],
    );
    return res.rows.map(mapComment);
  }

  async getAttachmentVisibility(attachmentId: string): Promise<'internal' | 'client' | 'restricted' | null> {
    const res = await this.db.query(
      `SELECT visibility FROM csd_attachments
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [CSD_TENANT_ID, attachmentId],
    );
    return res.rows[0]?.visibility ?? null;
  }

  async insertNotification(input: {
    staff_id: number;
    event_key: string;
    title_vi: string;
    body_vi: string;
    entity_type: string;
    entity_id: string;
    severity?: 'info' | 'warning' | 'critical';
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO csd_notifications (
         tenant_id, staff_id, event_key, title_vi, body_vi, entity_type, entity_id, severity
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        CSD_TENANT_ID,
        input.staff_id,
        input.event_key,
        input.title_vi,
        input.body_vi,
        input.entity_type,
        input.entity_id,
        input.severity ?? 'info',
      ],
    );
  }

  async hasNotification(staffId: number, eventKey: string, entityId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM csd_notifications
       WHERE tenant_id = $1 AND staff_id = $2 AND event_key = $3 AND entity_id = $4
       LIMIT 1`,
      [CSD_TENANT_ID, staffId, eventKey, entityId],
    );
    return res.rows.length > 0;
  }

  async countNeedAction(): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_tickets
       WHERE tenant_id = $1 AND is_deleted = FALSE
         AND status IN ('new', 'triaged', 'assigned', 'reopened', 'escalated')`,
      [CSD_TENANT_ID],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async countSlaRisk(): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_tickets
       WHERE tenant_id = $1 AND is_deleted = FALSE
         AND sla_status IN ('at_risk', 'near_breach', 'breached')`,
      [CSD_TENANT_ID],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async listForReportPeriod(
    clientAccountId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CsdTicketRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_tickets
       WHERE tenant_id = $1
         AND is_deleted = FALSE
         AND client_account_id = $2
         AND (
           (resolved_at IS NOT NULL AND resolved_at::date BETWEEN $3::date AND $4::date)
           OR (closed_at IS NOT NULL AND closed_at::date BETWEEN $3::date AND $4::date)
           OR (created_at::date BETWEEN $3::date AND $4::date)
         )
       ORDER BY created_at DESC, id DESC`,
      [CSD_TENANT_ID, clientAccountId, periodStart, periodEnd],
    );
    return res.rows.map(mapTicket);
  }

  async listForStaff(staffId: number, ymd: string): Promise<CsdTicketRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_tickets
       WHERE tenant_id = $1
         AND is_deleted = FALSE
         AND assignee_staff_id = $2
         AND (
           closed_at::date = $3::date
           OR updated_at::date = $3::date
           OR resolved_at::date = $3::date
           OR sla_status IN ('breached', 'near_breach', 'at_risk')
           OR status ILIKE '%block%'
           OR (sla_resolution_due_at IS NOT NULL AND sla_resolution_due_at < NOW()
               AND status NOT IN ('closed', 'cancelled', 'rejected', 'resolved'))
         )
       ORDER BY updated_at DESC
       LIMIT 20`,
      [CSD_TENANT_ID, staffId, ymd],
    );
    return res.rows.map(mapTicket);
  }

  async listTopPriority(limit = 8): Promise<CsdTicketRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_tickets
       WHERE tenant_id = $1 AND is_deleted = FALSE
         AND status NOT IN ('closed', 'cancelled', 'rejected', 'draft')
       ORDER BY
         CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
         sla_resolution_due_at ASC NULLS LAST
       LIMIT $2`,
      [CSD_TENANT_ID, limit],
    );
    return res.rows.map(mapTicket);
  }
}
