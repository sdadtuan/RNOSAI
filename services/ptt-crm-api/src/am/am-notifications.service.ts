import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';

export type AmNotificationItem = {
  id: string;
  kind: string;
  title: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isInvalidUuid(err: unknown): boolean {
  return (err as { code?: string }).code === '22P02';
}

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapItem(row: Record<string, unknown>): AmNotificationItem {
  return {
    id: text(row.id),
    kind: text(row.kind),
    title: text(row.title),
    href: row.href != null ? text(row.href) : null,
    read_at: row.read_at ? text(row.read_at) : null,
    created_at: text(row.created_at),
  };
}

export type AmNotificationInsert = {
  staff_id: number;
  kind: string;
  title: string;
  href?: string | null;
};

export type AmNotificationsStore = {
  listForStaff(staffId: number): Promise<AmNotificationItem[]>;
  insert(input: AmNotificationInsert): Promise<AmNotificationItem>;
  markRead(id: string, staffId: number): Promise<AmNotificationItem | null>;
};

export type AmInvoicePaidNotifyInput = {
  staff_id: number;
  agency_client_id: string;
  title?: string;
};

@Injectable()
export class AmNotificationsRepository implements OnModuleDestroy, AmNotificationsStore {
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

  async insert(input: AmNotificationInsert): Promise<AmNotificationItem> {
    const href = input.href ?? null;
    try {
      const existing = await this.db.query(
        `SELECT id::text AS id, kind, title, href, read_at, created_at
           FROM crm_am_notifications
          WHERE tenant_id = $1
            AND staff_id = $2
            AND kind = $3
            AND href IS NOT DISTINCT FROM $4
            AND read_at IS NULL
          LIMIT 1`,
        [AM_TENANT_ID, input.staff_id, input.kind, href],
      );
      if (existing.rows[0]) return mapItem(existing.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    const result = await this.db.query(
      `INSERT INTO crm_am_notifications (tenant_id, staff_id, kind, title, href)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text AS id, kind, title, href, read_at, created_at`,
      [AM_TENANT_ID, input.staff_id, input.kind, input.title, href],
    );
    return mapItem(result.rows[0] as Record<string, unknown>);
  }

  async markRead(id: string, staffId: number): Promise<AmNotificationItem | null> {
    try {
      const result = await this.db.query(
        `UPDATE crm_am_notifications
            SET read_at = now()
          WHERE tenant_id = $1 AND id = $2::uuid AND staff_id = $3
          RETURNING id::text AS id, kind, title, href, read_at, created_at`,
        [AM_TENANT_ID, id, staffId],
      );
      const row = result.rows[0];
      return row ? mapItem(row as Record<string, unknown>) : null;
    } catch (err) {
      if (isMissingRelation(err) || isInvalidUuid(err)) return null;
      throw err;
    }
  }

  async listForStaff(staffId: number): Promise<AmNotificationItem[]> {
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, kind, title, href, read_at, created_at
           FROM crm_am_notifications
          WHERE tenant_id = $1 AND staff_id = $2
          ORDER BY created_at DESC
          LIMIT 50`,
        [AM_TENANT_ID, staffId],
      );
      return result.rows.map((row) => mapItem(row as Record<string, unknown>));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}

@Injectable()
export class AmNotificationsService {
  constructor(private readonly repo: AmNotificationsRepository) {}

  async list(staffId: number): Promise<{ items: AmNotificationItem[]; unread: number }> {
    if (!staffId) return { items: [], unread: 0 };
    const items = await this.repo.listForStaff(staffId);
    return {
      items,
      unread: items.filter((item) => !item.read_at).length,
    };
  }

  async markRead(id: string, staffId: number): Promise<{ id: string; read_at: string }> {
    const row = await this.repo.markRead(id, staffId);
    if (!row?.read_at) amThrow(404, { error: 'not_found' });
    return { id: row.id, read_at: row.read_at };
  }

  async notify(input: AmNotificationInsert): Promise<AmNotificationItem | null> {
    if (!Number.isInteger(input.staff_id) || input.staff_id <= 0) return null;
    return this.repo.insert(input);
  }

  async notifyInvoicePaid(input: AmInvoicePaidNotifyInput): Promise<AmNotificationItem | null> {
    const title = String(input.title ?? '').trim() || 'Hóa đơn đã thanh toán';
    return this.notify({
      staff_id: input.staff_id,
      kind: 'invoice.paid',
      title,
      href: `/crm/account-management/clients/${input.agency_client_id}?tab=finance`,
    });
  }
}
