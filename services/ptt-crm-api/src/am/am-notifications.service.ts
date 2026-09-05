import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AM_TENANT_ID } from './am-audit.repository';

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

export type AmNotificationsStore = {
  listForStaff(staffId: number): Promise<AmNotificationItem[]>;
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
}
