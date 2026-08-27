import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CRM_CHANNEL_LABELS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  CreateTicketBody,
  CreateTicketMessageBody,
  ListTicketsQuery,
  PatchTicketBody,
  TicketMessageRow,
  TicketRow,
  UpdateTicketSentimentInput,
  normalizeChannel,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
} from './tickets.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class TicketsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

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
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_tickets (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id),
        ticket_type VARCHAR(64) NOT NULL DEFAULT 'phan_anh',
        status VARCHAR(32) NOT NULL DEFAULT 'moi',
        priority VARCHAR(32) NOT NULL DEFAULT 'binh_thuong',
        channel VARCHAR(32) NOT NULL DEFAULT 'khac',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        resolution TEXT NOT NULL DEFAULT '',
        assigned_staff_id INTEGER,
        sentiment_label VARCHAR(64) NOT NULL DEFAULT '',
        sentiment_score INTEGER,
        sentiment_confidence DOUBLE PRECISION,
        sentiment_scored_at VARCHAR(64) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS crm_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
        author_staff_id INTEGER,
        body TEXT NOT NULL DEFAULT '',
        is_internal BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_tickets_status ON crm_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_crm_tickets_customer ON crm_tickets(customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_ticket_messages_ticket ON crm_ticket_messages(ticket_id);
    `);
  }

  async list(query: ListTicketsQuery = {}): Promise<{ tickets: TicketRow[]; total: number }> {
    await this.ensureSchema();
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.status) {
      params.push(normalizeIssueStatus(query.status));
      where.push(`t.status = $${params.length}`);
    }
    if (query.priority) {
      params.push(normalizeIssuePriority(query.priority));
      where.push(`t.priority = $${params.length}`);
    }
    if (query.sentiment) {
      params.push(String(query.sentiment).trim());
      where.push(`t.sentiment_label = $${params.length}`);
    }
    if (query.customer_id && Number.isFinite(query.customer_id)) {
      params.push(Number(query.customer_id));
      where.push(`t.customer_id = $${params.length}`);
    }
    if (query.assigned_staff_id && Number.isFinite(query.assigned_staff_id)) {
      params.push(Number(query.assigned_staff_id));
      where.push(`t.assigned_staff_id = $${params.length}`);
    }
    if (query.q) {
      params.push(`%${String(query.q).trim()}%`);
      const placeholder = `$${params.length}`;
      where.push(
        `(t.title ILIKE ${placeholder} OR c.name ILIKE ${placeholder} OR t.description ILIKE ${placeholder})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.db.query(
      `SELECT COUNT(*) AS n
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       ${whereSql}`,
      params,
    );
    const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 300);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const listParams = [...params, limit, offset];
    const rows = await this.db.query(
      `SELECT t.*, c.name AS customer_name, st.name AS assigned_staff_name,
              (
                SELECT BTRIM(COALESCE(ct.agency_client_id, ''))
                FROM crm_contracts ct
                WHERE ct.customer_id = t.customer_id
                  AND ct.status = 'active'
                  AND BTRIM(COALESCE(ct.agency_client_id, '')) <> ''
                ORDER BY ct.ends_on DESC, ct.id DESC
                LIMIT 1
              ) AS agency_client_id
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
       ${whereSql}
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return {
      tickets: rows.rows.map((row) => this.mapRow(row)),
      total: Number(total.rows[0]?.n ?? 0),
    };
  }

  async create(body: CreateTicketBody): Promise<TicketRow> {
    await this.ensureSchema();
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'invalid_customer_id' });
    }
    const customer = await this.db.query('SELECT id FROM crm_customers WHERE id = $1', [customerId]);
    if (!customer.rows[0]) throw new BadRequestException({ error: 'customer_not_found' });

    const title = String(body.title ?? '').trim().slice(0, 400);
    if (!title) throw new BadRequestException({ error: 'title_required' });
    const rawStaffId =
      body.assigned_staff_id != null && body.assigned_staff_id !== 0
        ? Number(body.assigned_staff_id)
        : NaN;
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_tickets (
         customer_id, ticket_type, status, priority, channel, title, description,
         resolution, assigned_staff_id, created_at, updated_at, resolved_at
       ) VALUES ($1, $2, 'moi', $3, $4, $5, $6, '', $7, $8::timestamptz, $8::timestamptz, NULL)
       RETURNING id`,
      [
        customerId,
        normalizeIssueType(body.ticket_type),
        normalizeIssuePriority(body.priority),
        normalizeChannel(body.channel),
        title,
        String(body.description ?? '').trim().slice(0, 8000),
        Number.isFinite(rawStaffId) ? rawStaffId : null,
        ts,
      ],
    );
    return (await this.getById(Number(result.rows[0].id)))!;
  }

  async patch(id: number, body: PatchTicketBody): Promise<TicketRow> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_tickets WHERE id = $1', [id]);
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'ticket_not_found' });

    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['title', 'description', 'resolution'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(0, key === 'title' ? 400 : 8000);
      }
    }
    if ('ticket_type' in body) merged.ticket_type = normalizeIssueType(body.ticket_type);
    if ('priority' in body) merged.priority = normalizeIssuePriority(body.priority);
    if ('status' in body) merged.status = normalizeIssueStatus(body.status);
    if ('channel' in body) merged.channel = normalizeChannel(body.channel);
    if ('assigned_staff_id' in body) {
      const raw = body.assigned_staff_id;
      const staffId = raw == null || raw === 0 ? NaN : Number(raw);
      merged.assigned_staff_id = Number.isFinite(staffId) ? staffId : null;
    }

    const status = String(merged.status ?? 'moi');
    let resolvedAt = text(existing.resolved_at);
    if (['da_xu_ly', 'dong'].includes(status) && !resolvedAt) resolvedAt = catalogTs();
    else if (!['da_xu_ly', 'dong'].includes(status)) resolvedAt = '';
    await this.db.query(
      `UPDATE crm_tickets
       SET ticket_type = $2, status = $3, priority = $4, channel = $5, title = $6,
           description = $7, resolution = $8, assigned_staff_id = $9,
           updated_at = $10::timestamptz, resolved_at = NULLIF($11, '')::timestamptz
       WHERE id = $1`,
      [
        id,
        String(merged.ticket_type ?? 'phan_anh'),
        status,
        String(merged.priority ?? 'binh_thuong'),
        String(merged.channel ?? 'khac'),
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.resolution ?? ''),
        merged.assigned_staff_id != null ? Number(merged.assigned_staff_id) : null,
        catalogTs(),
        resolvedAt,
      ],
    );
    return (await this.getById(id))!;
  }

  async getById(id: number): Promise<TicketRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT t.*, c.name AS customer_name, st.name AS assigned_staff_name,
              (
                SELECT BTRIM(COALESCE(ct.agency_client_id, ''))
                FROM crm_contracts ct
                WHERE ct.customer_id = t.customer_id
                  AND ct.status = 'active'
                  AND BTRIM(COALESCE(ct.agency_client_id, '')) <> ''
                ORDER BY ct.ends_on DESC, ct.id DESC
                LIMIT 1
              ) AS agency_client_id
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
       WHERE t.id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateSentiment(ticketId: number, input: UpdateTicketSentimentInput): Promise<TicketRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `UPDATE crm_tickets
       SET sentiment_label = $2, sentiment_score = $3, sentiment_confidence = $4,
           sentiment_scored_at = $5, updated_at = $5::timestamptz
       WHERE id = $1
       RETURNING id`,
      [ticketId, input.label, input.score, input.confidence, input.scored_at],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'ticket_not_found' });
    return (await this.getById(ticketId))!;
  }

  async listMessages(ticketId: number): Promise<TicketMessageRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT m.*, st.name AS author_staff_name
       FROM crm_ticket_messages m
       LEFT JOIN crm_staff st ON st.id = m.author_staff_id
       WHERE m.ticket_id = $1
       ORDER BY m.id ASC`,
      [ticketId],
    );
    return result.rows.map((row) => this.mapMessageRow(row));
  }

  async addMessage(ticketId: number, body: CreateTicketMessageBody): Promise<TicketMessageRow> {
    await this.ensureSchema();
    const ticket = await this.db.query('SELECT id FROM crm_tickets WHERE id = $1', [ticketId]);
    if (!ticket.rows[0]) throw new NotFoundException({ error: 'ticket_not_found' });
    const messageBody = String(body.body ?? '').trim().slice(0, 8000);
    if (!messageBody) throw new BadRequestException({ error: 'message_body_required' });
    const rawStaffId =
      body.author_staff_id != null && body.author_staff_id !== 0
        ? Number(body.author_staff_id)
        : NaN;
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_ticket_messages (ticket_id, author_staff_id, body, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz)
       RETURNING id`,
      [
        ticketId,
        Number.isFinite(rawStaffId) ? rawStaffId : null,
        messageBody,
        body.is_internal !== false,
        ts,
      ],
    );
    await this.db.query(
      'UPDATE crm_tickets SET updated_at = $2::timestamptz WHERE id = $1',
      [ticketId, ts],
    );
    const inserted = await this.db.query(
      `SELECT m.*, st.name AS author_staff_name
       FROM crm_ticket_messages m
       LEFT JOIN crm_staff st ON st.id = m.author_staff_id
       WHERE m.id = $1`,
      [Number(result.rows[0].id)],
    );
    return this.mapMessageRow(inserted.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): TicketRow {
    const ticketType = String(row.ticket_type ?? 'phan_anh');
    const status = String(row.status ?? 'moi');
    const priority = String(row.priority ?? 'binh_thuong');
    const channel = String(row.channel ?? 'khac');
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      customer_name: String(row.customer_name ?? '—'),
      agency_client_id: String(row.agency_client_id ?? '').trim() || null,
      ticket_type: ticketType,
      ticket_type_label: ISSUE_TYPE_LABELS[ticketType] ?? ticketType,
      status,
      status_label: ISSUE_STATUS_LABELS[status] ?? status,
      priority,
      priority_label: ISSUE_PRIORITY_LABELS[priority] ?? priority,
      channel,
      channel_label: CRM_CHANNEL_LABELS[channel] ?? channel,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      resolution: String(row.resolution ?? ''),
      assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? '—'),
      sentiment_label: String(row.sentiment_label ?? '').trim() || null,
      sentiment_score: row.sentiment_score != null ? Number(row.sentiment_score) : null,
      sentiment_confidence:
        row.sentiment_confidence != null ? Number(row.sentiment_confidence) : null,
      sentiment_scored_at: String(row.sentiment_scored_at ?? '').trim() || null,
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
      resolved_at: text(row.resolved_at),
    };
  }

  private mapMessageRow(row: Record<string, unknown>): TicketMessageRow {
    return {
      id: Number(row.id),
      ticket_id: Number(row.ticket_id),
      author_staff_id: row.author_staff_id != null ? Number(row.author_staff_id) : null,
      author_staff_name: String(row.author_staff_name ?? 'Hệ thống'),
      body: String(row.body ?? ''),
      is_internal: row.is_internal === true,
      created_at: text(row.created_at),
    };
  }
}
