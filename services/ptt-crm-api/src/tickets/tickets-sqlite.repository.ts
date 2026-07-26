import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CRM_CHANNEL_LABELS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  CreateTicketBody,
  ListTicketsQuery,
  PatchTicketBody,
  TicketRow,
  normalizeChannel,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
} from './tickets.types';

@Injectable()
export class TicketsSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.ensureSchema();
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        ticket_type TEXT NOT NULL DEFAULT 'phan_anh',
        status TEXT NOT NULL DEFAULT 'moi',
        priority TEXT NOT NULL DEFAULT 'binh_thuong',
        channel TEXT NOT NULL DEFAULT 'khac',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        resolution TEXT NOT NULL DEFAULT '',
        assigned_staff_id INTEGER,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        resolved_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_crm_tickets_status ON crm_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_crm_tickets_customer ON crm_tickets(customer_id);
    `);
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
      assigned_staff_id:
        row.assigned_staff_id != null && row.assigned_staff_id !== ''
          ? Number(row.assigned_staff_id)
          : null,
      assigned_staff_name: String(row.assigned_staff_name ?? '—'),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
      resolved_at: String(row.resolved_at ?? ''),
    };
  }

  list(query: ListTicketsQuery = {}): { tickets: TicketRow[]; total: number } {
    const params: SQLInputValue[] = [];
    const where: string[] = [];
    if (query.status) {
      where.push('t.status = ?');
      params.push(normalizeIssueStatus(query.status));
    }
    if (query.priority) {
      where.push('t.priority = ?');
      params.push(normalizeIssuePriority(query.priority));
    }
    if (query.customer_id && Number.isFinite(query.customer_id)) {
      where.push('t.customer_id = ?');
      params.push(Number(query.customer_id));
    }
    if (query.assigned_staff_id && Number.isFinite(query.assigned_staff_id)) {
      where.push('t.assigned_staff_id = ?');
      params.push(Number(query.assigned_staff_id));
    }
    if (query.q) {
      where.push('(t.title LIKE ? OR c.name LIKE ? OR t.description LIKE ?)');
      const like = `%${String(query.q).trim()}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.database
      .prepare(
        `SELECT COUNT(*) AS n
         FROM crm_tickets t
         LEFT JOIN crm_customers c ON c.id = t.customer_id
         ${whereSql}`,
      )
      .get(...params) as unknown as { n: number } | undefined;
    const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 300);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const rows = this.database
      .prepare(
        `SELECT t.*, c.name AS customer_name, st.name AS assigned_staff_name
         FROM crm_tickets t
         LEFT JOIN crm_customers c ON c.id = t.customer_id
         LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
         ${whereSql}
         ORDER BY t.updated_at DESC, t.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as unknown as Array<Record<string, unknown>>;
    return {
      tickets: rows.map((row) => this.mapRow(row)),
      total: Number(totalRow?.n ?? 0),
    };
  }

  create(body: CreateTicketBody): TicketRow {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'invalid_customer_id' });
    }
    const customer = this.database
      .prepare('SELECT id FROM crm_customers WHERE id = ?')
      .get(customerId) as unknown as { id: number } | undefined;
    if (!customer) throw new BadRequestException({ error: 'customer_not_found' });

    const title = String(body.title ?? '').trim().slice(0, 400);
    if (!title) throw new BadRequestException({ error: 'title_required' });

    let assignedStaffId: number | null = null;
    if (body.assigned_staff_id != null && body.assigned_staff_id !== 0) {
      assignedStaffId = Number(body.assigned_staff_id);
      if (!Number.isFinite(assignedStaffId)) assignedStaffId = null;
    }

    const ts = catalogTs();
    const result = this.database
      .prepare(
        `INSERT INTO crm_tickets (
           customer_id, ticket_type, status, priority, channel, title, description,
           resolution, assigned_staff_id, created_at, updated_at, resolved_at
         ) VALUES (?, ?, 'moi', ?, ?, ?, ?, '', ?, ?, ?, '')`,
      )
      .run(
        customerId,
        normalizeIssueType(body.ticket_type),
        normalizeIssuePriority(body.priority),
        normalizeChannel(body.channel),
        title,
        String(body.description ?? '').trim().slice(0, 8000),
        assignedStaffId,
        ts,
        ts,
      );
    return this.getById(Number(result.lastInsertRowid))!;
  }

  patch(id: number, body: PatchTicketBody): TicketRow {
    const existing = this.database
      .prepare('SELECT * FROM crm_tickets WHERE id = ?')
      .get(id) as unknown as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'ticket_not_found' });

    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['title', 'description', 'resolution'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'title' ? 0 : 8000);
      }
    }
    if ('ticket_type' in body) merged.ticket_type = normalizeIssueType(body.ticket_type);
    if ('priority' in body) merged.priority = normalizeIssuePriority(body.priority);
    if ('status' in body) merged.status = normalizeIssueStatus(body.status);
    if ('channel' in body) merged.channel = normalizeChannel(body.channel);
    if ('assigned_staff_id' in body) {
      const raw = body.assigned_staff_id;
      if (raw == null || raw === 0) merged.assigned_staff_id = null;
      else {
        const aid = Number(raw);
        merged.assigned_staff_id = Number.isFinite(aid) ? aid : null;
      }
    }

    const ts = catalogTs();
    const status = String(merged.status ?? 'moi');
    const resolvedAt =
      status === 'da_xu_ly' || status === 'dong'
        ? String(existing.resolved_at || ts)
        : '';
    let assignedStaffId: number | null = null;
    if (merged.assigned_staff_id != null && merged.assigned_staff_id !== '') {
      const aid = Number(merged.assigned_staff_id);
      assignedStaffId = Number.isFinite(aid) ? aid : null;
    }

    this.database
      .prepare(
        `UPDATE crm_tickets
         SET ticket_type = ?, status = ?, priority = ?, channel = ?, title = ?, description = ?,
             resolution = ?, assigned_staff_id = ?, updated_at = ?, resolved_at = ?
         WHERE id = ?`,
      )
      .run(
        String(merged.ticket_type ?? 'phan_anh'),
        status,
        String(merged.priority ?? 'binh_thuong'),
        String(merged.channel ?? 'khac'),
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.resolution ?? ''),
        assignedStaffId,
        ts,
        resolvedAt,
        id,
      );
    return this.getById(id)!;
  }

  getById(id: number): TicketRow | null {
    const row = this.database
      .prepare(
        `SELECT t.*, c.name AS customer_name, st.name AS assigned_staff_name
         FROM crm_tickets t
         LEFT JOIN crm_customers c ON c.id = t.customer_id
         LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
         WHERE t.id = ?`,
      )
      .get(id) as unknown as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }
}
