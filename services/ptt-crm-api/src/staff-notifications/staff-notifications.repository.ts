import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateStaffNotificationInput,
  StaffNotificationRow,
} from './staff-notifications.types';
import { isGdkdPositionCode } from './gdkd-notify.util';

@Injectable()
export class StaffNotificationsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: Array<StaffNotificationRow & { user_id: string; meta_json?: Record<string, unknown> }> = [];
  private seq = 1;
  private pgReady: boolean | null = null;
  private readonly logger = new Logger(StaffNotificationsRepository.name);
  /** Collapse identical inserts in one burst (GDKD fan-out to the same CEO). */
  private readonly burstSeen = new Map<string, number>();

  constructor(private readonly config: AppConfigService) {}


  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  }

  /** Deterministic UUID for stub staff who have no staff_users row (local UAT). */
  private staffIdAsUuid(staffId: number): string {
    return `00000000-0000-4000-8000-${String(staffId).padStart(12, '0')}`;
  }

  /**
   * JWT `sub` is a UUID for real staff_users, but stub logins put the numeric staff id in `sub`.
   * Casting a bare number to uuid throws and 500s the notifications list.
   */
  async resolveUserId(subOrStaffId: string | number | null | undefined): Promise<string | null> {
    const raw = String(subOrStaffId ?? '').trim();
    if (!raw) return null;
    if (this.isUuid(raw)) return raw;
    const staffId = Number(raw);
    if (!Number.isFinite(staffId) || staffId <= 0) return null;
    const mapped = await this.authUserIdForStaff(staffId);
    if (mapped) return mapped;
    return this.staffIdAsUuid(staffId);
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

  private async ensurePgReady(): Promise<boolean> {
    // Only cache a successful probe. A failed first check (pool warming just
    // after process start, brief Postgres blip) used to set pgReady=false
    // forever and divert every later INSERT into the in-memory fallback —
    // which is why a fresh lead_assigned row sometimes never landed in PG.
    if (this.pgReady === true) return true;
    try {
      await this.db.query(`SELECT 1 FROM staff_notifications LIMIT 1`);
      this.pgReady = true;
      return true;
    } catch (err) {
      this.pgReady = null;
      this.logger.warn(
        `staff_notifications PG not ready, will retry: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  private parseMeta(raw: unknown): Record<string, unknown> | null {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  private mapRow(row: Record<string, unknown>): StaffNotificationRow {
    return {
      id: String(row.id),
      kind: String(row.kind ?? 'info'),
      title: String(row.title ?? ''),
      body: String(row.body ?? ''),
      link_href: row.link_href ? String(row.link_href) : null,
      read: row.read_at != null,
      created_at: String(row.created_at ?? ''),
      meta_json: this.parseMeta(row.meta_json),
    };
  }

  async authUserIdForStaff(staffId: number): Promise<string | null> {
    const id = Number(staffId);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!(await this.ensurePgReady())) return null;
    const result = await this.db.query(
      `SELECT u.id::text AS user_id
         FROM crm_staff s
         JOIN staff_users u ON lower(trim(u.email)) = lower(trim(s.email))
        WHERE s.id = $1
        LIMIT 1`,
      [id],
    );
    const userId = String(result.rows[0]?.user_id ?? '').trim();
    return userId || null;
  }

  async notifyStaff(
    staffId: number,
    input: Omit<CreateStaffNotificationInput, 'user_id'>,
  ): Promise<string | null> {
    const userId = await this.resolveUserId(staffId);
    if (!userId) {
      this.logger.error(`notifyStaff: could not resolve user_id for staffId=${staffId} kind=${input.kind}`);
      return null;
    }
    try {
      await this.create({ ...input, user_id: userId });
      return userId;
    } catch (err) {
      this.logger.error(
        `notifyStaff INSERT failed staffId=${staffId} user=${userId} kind=${input.kind}: ${err instanceof Error ? err.stack || err.message : err}`,
      );
      return null;
    }
  }

  async create(input: CreateStaffNotificationInput): Promise<StaffNotificationRow> {
    const redirected = await this.gdkdRedirectUserIds(input.user_id);
    if (redirected) {
      if (!redirected.length) {
        this.logger.warn(
          `GDKD notification not stored (no CEO recipient) kind=${input.kind} title=${String(input.title ?? '').slice(0, 80)}`,
        );
        return {
          id: '0',
          kind: String(input.kind ?? 'info'),
          title: String(input.title ?? ''),
          body: String(input.body ?? ''),
          link_href: input.link_href ?? null,
          read: true,
          created_at: new Date().toISOString(),
          meta_json: input.meta_json ?? null,
        };
      }
      let last: StaffNotificationRow | null = null;
      for (const userId of redirected) {
        last = await this.insertNotification({ ...input, user_id: userId });
      }
      return last as StaffNotificationRow;
    }
    return this.insertNotification(input);
  }

  private async insertNotification(input: CreateStaffNotificationInput): Promise<StaffNotificationRow> {
    const kind = String(input.kind ?? 'info').trim() || 'info';
    const title = String(input.title ?? '').trim();
    const body = String(input.body ?? '').trim();
    const link = input.link_href ? String(input.link_href).trim() : null;
    const meta = input.meta_json ?? {};

    let pgOk = await this.ensurePgReady();
    if (!pgOk) {
      await new Promise((r) => setTimeout(r, 80));
      pgOk = await this.ensurePgReady();
    }
    const burstKey = `${input.user_id}|${kind}|${title}|${body}|${link ?? ''}`;
    if (this.seenBurst(burstKey)) {
      if (pgOk) {
        const existing = await this.db.query(
          `SELECT id::text, kind, title, body, link_href, read_at, created_at::text, meta_json
             FROM staff_notifications
            WHERE user_id = $1::uuid AND kind = $2 AND title = $3 AND body = $4
            ORDER BY id DESC
            LIMIT 1`,
          [input.user_id, kind, title, body],
        );
        if (existing.rows[0]) return this.mapRow(existing.rows[0] as Record<string, unknown>);
      }
    }
    if (pgOk) {
      const result = await this.db.query(
        `INSERT INTO staff_notifications (user_id, kind, title, body, link_href, meta_json)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
         RETURNING id::text, kind, title, body, link_href, read_at, created_at::text, meta_json`,
        [input.user_id, kind, title, body, link, JSON.stringify(meta)],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }
    this.logger.warn(
      `staff_notifications INSERT falling back to memory (user=${input.user_id} kind=${kind} title=${title.slice(0, 80)})`,
    );

    const now = new Date().toISOString();
    const row = {
      id: String(this.seq++),
      user_id: input.user_id,
      kind,
      title,
      body,
      link_href: link,
      read: false,
      created_at: now,
      meta_json: meta,
    };
    this.memory.unshift(row);
    return row;
  }

  private seenBurst(key: string): boolean {
    const now = Date.now();
    for (const [seenKey, at] of this.burstSeen) {
      if (now - at > 15_000) this.burstSeen.delete(seenKey);
    }
    if (this.burstSeen.has(key)) return true;
    this.burstSeen.set(key, now);
    return false;
  }

  /** Null when the recipient is not GDKD. Otherwise the CEO user ids who should receive it. */
  private async gdkdRedirectUserIds(userId: string): Promise<string[] | null> {
    const code = await this.positionCodeForUser(userId);
    if (!isGdkdPositionCode(code)) return null;
    return this.ceoNotificationUserIds();
  }

  private async positionCodeForUser(userId: string): Promise<string | null> {
    if (!(await this.ensurePgReady())) return null;
    const stub = /^00000000-0000-4000-8000-(\d{12})$/.exec(userId);
    if (stub) {
      const result = await this.db.query(
        `SELECT p.code
           FROM crm_staff s
           JOIN crm_positions p ON p.id = s.position_id
          WHERE s.id = $1
          LIMIT 1`,
        [Number(stub[1])],
      );
      return result.rows[0]?.code ? String(result.rows[0].code) : null;
    }
    const result = await this.db.query(
      `SELECT p.code
         FROM staff_users u
         JOIN crm_positions p ON p.id = u.position_id
        WHERE u.id = $1::uuid
        LIMIT 1`,
      [userId],
    );
    if (result.rows[0]?.code) return String(result.rows[0].code);
    const viaStaff = await this.db.query(
      `SELECT p.code
         FROM staff_users u
         JOIN crm_staff s ON lower(trim(s.email)) = lower(trim(u.email))
         JOIN crm_positions p ON p.id = s.position_id
        WHERE u.id = $1::uuid
        LIMIT 1`,
      [userId],
    );
    return viaStaff.rows[0]?.code ? String(viaStaff.rows[0].code) : null;
  }

  private async ceoNotificationUserIds(): Promise<string[]> {
    if (!(await this.ensurePgReady())) return [];
    const result = await this.db.query(
      `SELECT s.id AS staff_id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) = 'ceo'`,
    );
    const ids: string[] = [];
    for (const row of result.rows) {
      const userId = await this.resolveUserId(Number(row.staff_id));
      if (userId) ids.push(userId);
    }
    const direct = await this.db.query(
      `SELECT u.id::text AS user_id
         FROM staff_users u
         JOIN crm_positions p ON p.id = u.position_id
        WHERE u.active IS TRUE
          AND lower(replace(p.code, ' ', '')) = 'ceo'`,
    );
    for (const row of direct.rows) {
      const userId = String(row.user_id ?? '').trim();
      if (userId) ids.push(userId);
    }
    return [...new Set(ids)];
  }

  async createMany(inputs: CreateStaffNotificationInput[]): Promise<number> {
    let count = 0;
    for (const input of inputs) {
      await this.create(input);
      count += 1;
    }
    return count;
  }

  async hasRecentAlertKey(alertKey: string, cooldownDays: number): Promise<boolean> {
    const key = alertKey.trim();
    if (!key) return false;
    const days = Math.max(1, cooldownDays);

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT 1 FROM staff_notifications
         WHERE meta_json->>'alert_key' = $1
           AND created_at >= NOW() - ($2::text || ' days')::interval
         LIMIT 1`,
        [key, String(days)],
      );
      return (result.rowCount ?? 0) > 0;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.memory.some((row) => {
      const ak = row.meta_json?.alert_key;
      if (String(ak ?? '') !== key) return false;
      const ts = Date.parse(row.created_at);
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  async list(params: {
    userId: string;
    unreadOnly: boolean;
    limit: number;
  }): Promise<{ rows: StaffNotificationRow[]; unread: number }> {
    const userId = await this.resolveUserId(params.userId);
    if (!userId) return { rows: [], unread: 0 };
    if (await this.ensurePgReady()) {
      const clauses = ['user_id = $1::uuid'];
      const values: unknown[] = [userId];
      if (params.unreadOnly) clauses.push('read_at IS NULL');
      const result = await this.db.query(
        `SELECT id::text, kind, title, body, link_href, read_at, created_at::text, meta_json
         FROM staff_notifications
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $2`,
        [...values, params.limit],
      );
      const unreadResult = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM staff_notifications
         WHERE user_id = $1::uuid AND read_at IS NULL`,
        [userId],
      );
      return {
        rows: result.rows.map((row) => this.mapRow(row as Record<string, unknown>)),
        unread: Number(unreadResult.rows[0]?.c ?? 0),
      };
    }

    const rows = this.memory
      .filter((n) => n.user_id === userId && (!params.unreadOnly || !n.read))
      .slice(0, params.limit)
      .map(({ user_id: _uid, ...rest }) => rest);
    const unread = this.memory.filter((n) => n.user_id === userId && !n.read).length;
    return { rows, unread };
  }

  async markRead(userIdRaw: string, id: string): Promise<StaffNotificationRow> {
    const userId = (await this.resolveUserId(userIdRaw)) ?? userIdRaw;
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1::bigint AND user_id = $2::uuid
         RETURNING id::text, kind, title, body, link_href, read_at, created_at::text, meta_json`,
        [id, userId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException({ error: 'notification_not_found', id });
      return this.mapRow(row as Record<string, unknown>);
    }

    const row = this.memory.find((n) => n.id === id && n.user_id === userId);
    if (!row) throw new NotFoundException({ error: 'notification_not_found', id });
    row.read = true;
    const { user_id: _uid, ...out } = row;
    return out;
  }

  async markAllRead(userIdRaw: string): Promise<number> {
    const userId = (await this.resolveUserId(userIdRaw)) ?? userIdRaw;
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_notifications
            SET read_at = COALESCE(read_at, NOW())
          WHERE user_id = $1::uuid AND read_at IS NULL`,
        [userId],
      );
      return result.rowCount ?? 0;
    }
    let count = 0;
    for (const row of this.memory) {
      if (row.user_id === userId && !row.read) {
        row.read = true;
        count += 1;
      }
    }
    return count;
  }
}
