import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createAppPgPool, shouldEndLocalPool } from '../config/pg-pool.factory';
import { AppConfigService } from '../config/app-config.service';
import { ensurePortalCrmLocalSchema } from './portal-crm-local-ddl.util';
import { parseProductSpec, type ProductSpec } from './portal-product.util';
import { appendAssigneeWhere, type PortalCareListFilter } from './portal-care.util';

export type CareCaseRow = {
  id: string;
  page_id: string;
  channel: string;
  kind: string;
  thread_key: string;
  title: string;
  assignee_user_id: string | null;
  assignee_email: string;
  status: string;
  labels: string[];
  customer_id: string | null;
  assigned_at: string;
  receive_due_at: string;
  received_at: string;
  care_started_at: string;
  care_due_at: string;
  created_at: string;
  snippet: string;
  order: OrderDraft;
  last_interaction_at: string;
  phone: string;
  source: string;
  answers: Array<{ name: string; value: string }>;
  campaign_id: string;
  adset_id: string;
  ad_id: string;
  form_id: string;
};

export type OrderDraft = {
  phone: string;
  address: string;
  product_id: string;
  product_name: string;
  size: string;
  color: string;
  price_vnd: number | null;
  closed: boolean;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function parseLeadAnswers(value: unknown): Array<{ name: string; value: string }> {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return { name: '', value: '' };
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? '').trim();
      const next = Array.isArray(row.values) ? String(row.values[0] ?? '').trim() : String(row.value ?? '').trim();
      return { name: name || 'Trường', value: next };
    })
    .filter((item) => item.name || item.value);
}

function mapCase(row: Record<string, unknown>): CareCaseRow {
  return {
    id: String(row.id),
    page_id: String(row.page_id),
    channel: String(row.channel ?? ''),
    kind: String(row.kind),
    thread_key: String(row.thread_key),
    title: String(row.title ?? ''),
    assignee_user_id: row.assignee_user_id ? String(row.assignee_user_id) : null,
    assignee_email: String(row.assignee_email ?? ''),
    status: String(row.status ?? ''),
    labels: Array.isArray(row.labels) ? row.labels.map((item) => String(item)) : [],
    customer_id: row.customer_id ? String(row.customer_id) : null,
    assigned_at: iso(row.assigned_at),
    receive_due_at: iso(row.receive_due_at),
    received_at: iso(row.received_at),
    care_started_at: iso(row.care_started_at),
    care_due_at: iso(row.care_due_at),
    created_at: iso(row.created_at),
    snippet: String(row.snippet ?? ''),
    order: parseOrder(row.order_draft),
    last_interaction_at: iso(row.last_interaction_at),
    phone: String(row.phone ?? ''),
    source: String(row.source ?? ''),
    answers: parseLeadAnswers(row.answers ?? row.field_data),
    campaign_id: String(row.campaign_id ?? ''),
    adset_id: String(row.adset_id ?? ''),
    ad_id: String(row.ad_id_lead ?? row.ad_id ?? ''),
    form_id: String(row.form_id ?? ''),
  };
}

/** PSID from `mess:{page_id}:{psid}`; empty for legacy name keys or temporary `_name:` keys. */
export function psidFromMessageThreadKey(pageId: string, threadKey: string): string {
  const prefix = `mess:${pageId}:`;
  if (!threadKey.startsWith(prefix)) return '';
  const tail = threadKey.slice(prefix.length);
  if (!tail || tail.startsWith('_name:')) return '';
  if (!/^\d+$/.test(tail)) return '';
  return tail;
}

function parseOrder(value: unknown): OrderDraft {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const price = Number(row.price_vnd);
  return {
    phone: String(row.phone ?? '').slice(0, 40),
    address: String(row.address ?? '').slice(0, 200),
    product_id: String(row.product_id ?? ''),
    product_name: String(row.product_name ?? '').slice(0, 200),
    size: String(row.size ?? '').slice(0, 40),
    color: String(row.color ?? '').slice(0, 40),
    price_vnd: Number.isFinite(price) && price > 0 ? price : null,
    closed: row.closed === true,
  };
}

@Injectable()
export class PortalCareRepository implements OnModuleDestroy {
  private readonly log = new Logger(PortalCareRepository.name);
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = createAppPgPool(this.config.databaseUrl);
    return this.pool;
  }

  onModuleDestroy(): void {
    if (shouldEndLocalPool()) void this.pool?.end();
    this.pool = null;
  }

  async ensure(): Promise<void> {
    await ensurePortalCrmLocalSchema(this.db, this.log, PortalCareRepository.name);
  }

  async upsertPageLead(
    clientId: string,
    pageId: string,
    input: {
      external_id: string;
      full_name: string;
      phone: string;
      email: string;
      campaign_name: string;
      campaign_id?: string;
      ad_id?: string;
      adset_id?: string;
      form_id?: string;
      answers?: Array<{ name: string; value: string }>;
      created_at: string;
    },
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_leads (client_id, page_id, external_lead_id, full_name, phone, email, campaign_name, campaign_id, ad_id, adset_id, form_id, field_data, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $11, $12, COALESCE($13::jsonb, '[]'::jsonb), COALESCE($10::timestamptz, NOW()))
       ON CONFLICT (page_id, external_lead_id) WHERE external_lead_id <> '' DO UPDATE SET
         full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), portal_page_leads.full_name),
         phone = COALESCE(NULLIF(EXCLUDED.phone, ''), portal_page_leads.phone),
         email = COALESCE(NULLIF(EXCLUDED.email, ''), portal_page_leads.email),
         campaign_name = COALESCE(NULLIF(EXCLUDED.campaign_name, ''), portal_page_leads.campaign_name),
         campaign_id = COALESCE(NULLIF(EXCLUDED.campaign_id, ''), portal_page_leads.campaign_id),
         ad_id = COALESCE(NULLIF(EXCLUDED.ad_id, ''), portal_page_leads.ad_id),
         adset_id = COALESCE(NULLIF(EXCLUDED.adset_id, ''), portal_page_leads.adset_id),
         form_id = COALESCE(NULLIF(EXCLUDED.form_id, ''), portal_page_leads.form_id),
         field_data = CASE
           WHEN EXCLUDED.field_data IS NULL OR EXCLUDED.field_data = '[]'::jsonb THEN portal_page_leads.field_data
           ELSE EXCLUDED.field_data
         END,
         created_at = COALESCE(EXCLUDED.created_at, portal_page_leads.created_at)`,
      [
        clientId,
        pageId,
        input.external_id,
        input.full_name,
        input.phone,
        input.email,
        input.campaign_name,
        String(input.campaign_id ?? '').slice(0, 64),
        String(input.ad_id ?? '').slice(0, 64),
        input.created_at || null,
        String(input.adset_id ?? '').slice(0, 64),
        String(input.form_id ?? '').slice(0, 64),
        JSON.stringify(input.answers ?? []),
      ],
    );
    await this.touchCustomerByContact(clientId, pageId, input.phone, input.email);
  }

  async getInboxCursors(clientId: string, pageId: string): Promise<{ conv_after: string; form_after: string }> {
    const result = await this.db.query(
      `SELECT conv_after, form_after FROM portal_page_inbox_cursors WHERE client_id = $1::uuid AND page_id = $2`,
      [clientId, pageId],
    );
    const row = result.rows[0];
    if (!row) return { conv_after: '', form_after: '' };
    return {
      conv_after: String(row.conv_after ?? ''),
      form_after: String(row.form_after ?? ''),
    };
  }

  async saveInboxCursors(
    clientId: string,
    pageId: string,
    cursors: { conv_after: string; form_after: string },
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_inbox_cursors (client_id, page_id, conv_after, form_after, updated_at)
       VALUES ($1::uuid, $2, $3, $4, NOW())
       ON CONFLICT (client_id, page_id)
       DO UPDATE SET conv_after = EXCLUDED.conv_after, form_after = EXCLUDED.form_after, updated_at = NOW()`,
      [clientId, pageId, cursors.conv_after, cursors.form_after],
    );
  }

  async listActiveFacebookPages(): Promise<Array<{ client_id: string; page_id: string; page_name: string }>> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT client_id::text AS client_id, page_id, COALESCE(page_name, '') AS page_name
       FROM portal_client_pages
       WHERE channel = 'facebook' AND active IS TRUE
       ORDER BY client_id, page_id`,
    );
    return result.rows.map((row) => ({
      client_id: String(row.client_id),
      page_id: String(row.page_id),
      page_name: String(row.page_name ?? ''),
    }));
  }

  /** Incremental poll marker — does not touch backfill conv/form cursors. */
  async touchInboxPolled(clientId: string, pageId: string, lastError = ''): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_inbox_cursors (client_id, page_id, conv_after, form_after, updated_at, last_polled_at, last_error)
       VALUES ($1::uuid, $2, '', '', NOW(), NOW(), $3)
       ON CONFLICT (client_id, page_id)
       DO UPDATE SET last_polled_at = NOW(), last_error = $3, updated_at = NOW()`,
      [clientId, pageId, String(lastError ?? '').slice(0, 500)],
    );
  }

  async upsertPageMessage(
    clientId: string,
    pageId: string,
    input: { external_id: string; sender_name: string; sender_psid?: string; body: string; received_at: string; direction: 'in' | 'out' },
  ): Promise<void> {
    const psid = String(input.sender_psid ?? '').slice(0, 64);
    await this.db.query(
      `INSERT INTO portal_page_messages (client_id, page_id, external_message_id, sender_name, sender_psid, body, received_at, direction)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8)
       ON CONFLICT (page_id, external_message_id) WHERE external_message_id <> ''
       DO UPDATE SET sender_psid = EXCLUDED.sender_psid
       WHERE portal_page_messages.sender_psid = '' AND EXCLUDED.sender_psid <> ''`,
      [clientId, pageId, input.external_id, input.sender_name, psid, input.body, input.received_at || null, input.direction],
    );
    await this.touchCustomerInteraction(clientId, pageId, {
      psid,
      senderName: input.direction !== 'out' ? input.sender_name : '',
    });
  }

  async latestSenderPsid(clientId: string, pageId: string, psid: string, senderName: string): Promise<string> {
    const normPsid = psid.trim();
    if (normPsid) return normPsid.slice(0, 64);
    const result = await this.db.query(
      `SELECT sender_psid FROM portal_page_messages
       WHERE client_id = $1::uuid AND page_id = $2 AND lower(sender_name) = lower($3) AND sender_psid <> ''
       ORDER BY received_at DESC LIMIT 1`,
      [clientId, pageId, senderName],
    );
    return String(result.rows[0]?.sender_psid ?? '');
  }

  async messagesSince(
    clientId: string,
    since: Date,
    filter?: { assigneeUserId?: string },
  ): Promise<Array<{ id: string; page_id: string; sender_name: string; sender_psid: string; body: string; received_at: string; direction: string }>> {
    const values: unknown[] = [clientId, since.toISOString()];
    let assigneeSql = '';
    if (filter?.assigneeUserId) {
      values.push(filter.assigneeUserId);
      const n = values.length;
      assigneeSql = ` AND EXISTS (
        SELECT 1 FROM portal_care_cases c
        WHERE c.client_id = m.client_id
          AND c.kind = 'message'
          AND c.page_id = m.page_id
          AND c.assignee_user_id = $${n}::uuid
          AND (
            (m.sender_psid <> '' AND c.thread_key = 'mess:' || m.page_id || ':' || m.sender_psid)
            OR (m.sender_psid = '' AND lower(c.title) = lower(m.sender_name))
            OR c.thread_key = 'mess:' || m.page_id || ':' || lower(m.sender_name)
          )
      )`;
    }
    const result = await this.db.query(
      `SELECT m.id::text, m.page_id, m.sender_name, m.sender_psid, m.body, m.received_at, m.direction
       FROM portal_page_messages m
       WHERE m.client_id = $1::uuid AND m.received_at > $2
       ${assigneeSql}
       ORDER BY m.received_at ASC
       LIMIT 40`,
      values,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      page_id: String(row.page_id),
      sender_name: String(row.sender_name ?? ''),
      sender_psid: String(row.sender_psid ?? ''),
      body: String(row.body ?? ''),
      received_at: iso(row.received_at),
      direction: String(row.direction ?? 'in'),
    }));
  }

  async casesForSenders(
    clientId: string,
    keys: Array<{ page_id: string; sender_psid?: string; sender_name?: string }>,
    filter?: { assigneeUserId?: string },
  ): Promise<CareCaseRow[]> {
    const unique = new Map<string, { page_id: string; sender_psid: string; sender_name: string }>();
    for (const key of keys) {
      const psid = String(key.sender_psid ?? '').trim();
      const senderName = String(key.sender_name ?? '').trim();
      if (!key.page_id || (!psid && !senderName)) continue;
      const mapKey = psid ? `${key.page_id}:psid:${psid}` : `${key.page_id}:name:${senderName.toLowerCase()}`;
      unique.set(mapKey, { page_id: key.page_id, sender_psid: psid, sender_name: senderName });
    }
    const rows = [...unique.values()].slice(0, 40);
    if (!rows.length) return [];
    const values: unknown[] = [clientId];
    const clauses = rows.map((row) => {
      if (row.sender_psid) {
        values.push(row.page_id, row.sender_psid);
        return `(c.page_id = $${values.length - 1} AND c.thread_key = 'mess:' || $${values.length - 1} || ':' || $${values.length})`;
      }
      values.push(row.page_id, row.sender_name.toLowerCase());
      return `(c.page_id = $${values.length - 1} AND lower(c.title) = $${values.length})`;
    });
    const where = ['c.client_id = $1::uuid', `c.kind = 'message'`, `(${clauses.join(' OR ')})`];
    appendAssigneeWhere(where, values, filter?.assigneeUserId, 'c');
    const result = await this.db.query(`${this.caseSelect()} WHERE ${where.join(' AND ')}`, values);
    return result.rows.map((row) => mapCase(row as Record<string, unknown>));
  }

  async syncCases(clientId: string): Promise<void> {
    await this.ensure();
    const migrated = await this.db.query(
      `UPDATE portal_care_cases c
       SET thread_key = 'mess:' || sub.page_id || ':' || sub.sender_psid,
           title = COALESCE(NULLIF(sub.sender_name, ''), c.title),
           updated_at = NOW()
       FROM (
         SELECT DISTINCT ON (m.page_id, m.sender_psid)
                m.page_id, m.sender_psid, m.sender_name, m.client_id
         FROM portal_page_messages m
         WHERE m.client_id = $1::uuid AND m.direction = 'in' AND m.sender_psid <> ''
         ORDER BY m.page_id, m.sender_psid, m.received_at DESC
       ) sub
       WHERE c.client_id = sub.client_id
         AND c.kind = 'message'
         AND c.page_id = sub.page_id
         AND c.thread_key = 'mess:' || sub.page_id || ':' || lower(sub.sender_name)
         AND NOT EXISTS (
           SELECT 1 FROM portal_care_cases c2
           WHERE c2.client_id = c.client_id
             AND c2.thread_key = 'mess:' || sub.page_id || ':' || sub.sender_psid
             AND c2.id <> c.id
         )
       RETURNING c.id::text`,
      [clientId],
    );
    if ((migrated.rowCount ?? 0) > 0) {
      await this.db.query(
        `UPDATE portal_customers cu
         SET thread_key = c.thread_key
         FROM portal_care_cases c
         WHERE cu.case_id = c.id AND cu.client_id = $1::uuid AND cu.thread_key <> c.thread_key`,
        [clientId],
      );
      this.log.log(`Đã chuyển ${migrated.rowCount} case Messenger sang thread_key PSID (client ${clientId})`);
    }
    await this.db.query(
      `INSERT INTO portal_care_cases (client_id, page_id, channel, kind, thread_key, title)
       SELECT l.client_id, l.page_id, COALESCE(p.channel, 'facebook'), 'lead',
              'lead:' || l.id::text, COALESCE(NULLIF(l.full_name, ''), 'Lead')
       FROM portal_page_leads l
       LEFT JOIN portal_client_pages p ON p.client_id = l.client_id AND p.page_id = l.page_id
       WHERE l.client_id = $1::uuid
         AND NOT EXISTS (
           SELECT 1 FROM portal_care_cases c
           WHERE c.client_id = l.client_id AND c.thread_key = 'lead:' || l.id::text
         )`,
      [clientId],
    );
    await this.db.query(
      `INSERT INTO portal_care_cases (client_id, page_id, channel, kind, thread_key, title)
       SELECT DISTINCT ON (
              m.page_id,
              CASE WHEN m.sender_psid <> '' THEN m.sender_psid ELSE '_name:' || lower(m.sender_name) END
            )
              m.client_id, m.page_id, COALESCE(p.channel, 'facebook'), 'message',
              CASE
                WHEN m.sender_psid <> '' THEN 'mess:' || m.page_id || ':' || m.sender_psid
                ELSE 'mess:' || m.page_id || ':_name:' || lower(m.sender_name)
              END,
              COALESCE(NULLIF(m.sender_name, ''), 'Khách')
       FROM portal_page_messages m
       LEFT JOIN portal_client_pages p ON p.client_id = m.client_id AND p.page_id = m.page_id
       WHERE m.client_id = $1::uuid AND m.direction = 'in' AND m.sender_name <> ''
         AND NOT EXISTS (
           SELECT 1 FROM portal_care_cases c
           WHERE c.client_id = m.client_id
             AND c.thread_key = CASE
               WHEN m.sender_psid <> '' THEN 'mess:' || m.page_id || ':' || m.sender_psid
               ELSE 'mess:' || m.page_id || ':_name:' || lower(m.sender_name)
             END
         )
       ORDER BY
         m.page_id,
         CASE WHEN m.sender_psid <> '' THEN m.sender_psid ELSE '_name:' || lower(m.sender_name) END,
         m.received_at`,
      [clientId],
    );
  }

  async summary(
    clientId: string,
    filter?: { assigneeUserId?: string },
  ): Promise<{
    leads_today: number;
    leads_yesterday: number;
    messages_today: number;
    messages_yesterday: number;
    leads_open: number;
    messages_open: number;
    spend_today: number;
    spend_yesterday: number;
  }> {
    await this.ensure();
    const values: unknown[] = [clientId];
    const where = ['c.client_id = $1::uuid'];
    appendAssigneeWhere(where, values, filter?.assigneeUserId, 'c');
    const counts = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE c.kind = 'lead' AND (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::int AS leads_today,
         COUNT(*) FILTER (WHERE c.kind = 'lead' AND (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1)::int AS leads_yesterday,
         COUNT(*) FILTER (WHERE c.kind = 'message' AND EXISTS (
           SELECT 1 FROM portal_page_messages m
           WHERE m.client_id = c.client_id AND m.page_id = c.page_id
             AND (
               (m.sender_psid <> '' AND c.thread_key = 'mess:' || c.page_id || ':' || m.sender_psid)
               OR (m.sender_psid = '' AND lower(m.sender_name) = lower(c.title))
               OR c.thread_key = 'mess:' || c.page_id || ':' || lower(m.sender_name)
             )
             AND (m.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         ))::int AS messages_today,
         COUNT(*) FILTER (WHERE c.kind = 'message' AND EXISTS (
           SELECT 1 FROM portal_page_messages m
           WHERE m.client_id = c.client_id AND m.page_id = c.page_id
             AND (
               (m.sender_psid <> '' AND c.thread_key = 'mess:' || c.page_id || ':' || m.sender_psid)
               OR (m.sender_psid = '' AND lower(m.sender_name) = lower(c.title))
               OR c.thread_key = 'mess:' || c.page_id || ':' || lower(m.sender_name)
             )
             AND (m.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1
         ))::int AS messages_yesterday,
         COUNT(*) FILTER (WHERE c.kind = 'lead' AND c.status = 'waiting_receive')::int AS leads_open,
         COUNT(*) FILTER (WHERE c.kind = 'message' AND c.status = 'waiting_receive')::int AS messages_open
       FROM portal_care_cases c
       INNER JOIN portal_client_pages p
         ON p.client_id = c.client_id
        AND p.page_id = c.page_id
        AND p.active IS TRUE
        AND COALESCE(p.channel, '') <> 'ad_account'
       LEFT JOIN portal_page_leads l
         ON c.kind = 'lead'
        AND l.client_id = c.client_id
        AND c.thread_key = 'lead:' || l.id::text
       WHERE ${where.join(' AND ')}`,
      values,
    );
    const row = counts.rows[0] ?? {};
    let spendToday = 0;
    let spendYesterday = 0;
    try {
      const spend = await this.db.query(
        `SELECT
           COALESCE(SUM(spend) FILTER (WHERE performance_date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date), 0)::float AS spend_today,
           COALESCE(SUM(spend) FILTER (WHERE performance_date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 1), 0)::float AS spend_yesterday
         FROM daily_performance
         WHERE client_id = $1::uuid
           AND performance_date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 1`,
        [clientId],
      );
      spendToday = Number(spend.rows[0]?.spend_today) || 0;
      spendYesterday = Number(spend.rows[0]?.spend_yesterday) || 0;
    } catch {
      spendToday = 0;
      spendYesterday = 0;
    }
    return {
      leads_today: Number(row.leads_today) || 0,
      leads_yesterday: Number(row.leads_yesterday) || 0,
      messages_today: Number(row.messages_today) || 0,
      messages_yesterday: Number(row.messages_yesterday) || 0,
      leads_open: Number(row.leads_open) || 0,
      messages_open: Number(row.messages_open) || 0,
      spend_today: spendToday,
      spend_yesterday: spendYesterday,
    };
  }

  async listStaff(clientId: string): Promise<Array<{ id: string; email: string }>> {
    const result = await this.db.query(
      `SELECT id::text, email FROM portal_client_users
       WHERE client_id = $1::uuid AND active IS TRUE AND role = 'staff'
       ORDER BY created_at ASC, email ASC`,
      [clientId],
    );
    return result.rows.map((row) => ({ id: String(row.id), email: String(row.email) }));
  }

  async listApprovers(clientId: string): Promise<Array<{ id: string; email: string }>> {
    const result = await this.db.query(
      `SELECT id::text, email FROM portal_client_users
       WHERE client_id = $1::uuid AND active IS TRUE AND role = 'approver'
       ORDER BY created_at ASC, email ASC`,
      [clientId],
    );
    return result.rows.map((row) => ({ id: String(row.id), email: String(row.email) }));
  }

  async findActiveClientUser(clientId: string, userId: string): Promise<{ id: string; email: string } | null> {
    const result = await this.db.query(
      `SELECT id::text, email FROM portal_client_users
       WHERE client_id = $1::uuid AND id = $2::uuid AND active IS TRUE
       LIMIT 1`,
      [clientId, userId],
    );
    const row = result.rows[0];
    return row ? { id: String(row.id), email: String(row.email) } : null;
  }

  async assignManual(id: string, userId: string, receiveDue: Date | null): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET assignee_user_id = $2::uuid,
           assigned_at = NOW(),
           receive_due_at = CASE WHEN status = 'waiting_receive' THEN $3::timestamptz ELSE receive_due_at END,
           updated_at = NOW()
       WHERE id = $1::uuid AND status <> 'purchased'`,
      [id, userId, receiveDue?.toISOString() ?? null],
    );
  }

  async listManagedStaff(clientId: string): Promise<Array<{ id: string; email: string; active: boolean }>> {
    const result = await this.db.query(
      `SELECT id::text, email, active FROM portal_client_users
       WHERE client_id = $1::uuid AND role = 'staff'
       ORDER BY active DESC, email ASC`,
      [clientId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      active: row.active === true || row.active === 't' || row.active === 1,
    }));
  }

  async openLoads(clientId: string): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT assignee_user_id::text AS id, COUNT(*)::int AS n
       FROM portal_care_cases
       WHERE client_id = $1::uuid AND status <> 'purchased' AND assignee_user_id IS NOT NULL
       GROUP BY assignee_user_id`,
      [clientId],
    );
    const loads: Record<string, number> = {};
    for (const row of result.rows) loads[String(row.id)] = Number(row.n) || 0;
    return loads;
  }

  async listHopRows(clientId: string): Promise<Array<{
    id: string;
    assignee_user_id: string | null;
    status: string;
    receive_due_at: Date | null;
    care_due_at: Date | null;
  }>> {
    const result = await this.db.query(
      `SELECT id::text, assignee_user_id::text, status, receive_due_at, care_due_at
       FROM portal_care_cases
       WHERE client_id = $1::uuid AND status IN ('waiting_receive', 'caring')`,
      [clientId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      assignee_user_id: row.assignee_user_id ? String(row.assignee_user_id) : null,
      status: String(row.status),
      receive_due_at: row.receive_due_at ? new Date(row.receive_due_at) : null,
      care_due_at: row.care_due_at ? new Date(row.care_due_at) : null,
    }));
  }

  async listUnassignedCare(clientId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT id::text FROM portal_care_cases
       WHERE client_id = $1::uuid AND assignee_user_id IS NULL AND status = 'caring'
       ORDER BY created_at ASC`,
      [clientId],
    );
    return result.rows.map((row) => String(row.id));
  }

  async listUnassigned(clientId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT id::text FROM portal_care_cases
       WHERE client_id = $1::uuid AND assignee_user_id IS NULL AND status = 'waiting_receive'
       ORDER BY created_at ASC`,
      [clientId],
    );
    return result.rows.map((row) => String(row.id));
  }

  async assignReceive(id: string, userId: string, due: Date): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET assignee_user_id = $2::uuid, assigned_at = NOW(), receive_due_at = $3,
           received_at = NULL, updated_at = NOW()
       WHERE id = $1::uuid AND status = 'waiting_receive'`,
      [id, userId, due.toISOString()],
    );
  }

  async assignCare(id: string, userId: string, due: Date): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET assignee_user_id = $2::uuid, assigned_at = NOW(), care_due_at = $3, updated_at = NOW()
       WHERE id = $1::uuid AND status = 'caring'`,
      [id, userId, due.toISOString()],
    );
  }

  async findCase(clientId: string, id: string): Promise<CareCaseRow | null> {
    const result = await this.db.query(
      `${this.caseSelect()} WHERE c.client_id = $1::uuid AND c.id = $2::uuid LIMIT 1`,
      [clientId, id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCase(row) : null;
  }

  async listCases(clientId: string, filter: PortalCareListFilter): Promise<CareCaseRow[]> {
    const values: unknown[] = [clientId];
    const where = ['c.client_id = $1::uuid'];
    if (filter.pageId) {
      values.push(filter.pageId);
      where.push(`c.page_id = $${values.length}`);
    }
    if (filter.day && /^\d{4}-\d{2}-\d{2}$/.test(filter.day)) {
      values.push(filter.day);
      where.push(`(c.created_at AT TIME ZONE 'Asia/Bangkok')::date = $${values.length}::date`);
    }
    if (filter.label) {
      values.push(filter.label);
      where.push(`$${values.length} = ANY (c.labels)`);
    }
    if (filter.kind) {
      values.push(filter.kind);
      where.push(`c.kind = $${values.length}`);
    }
    appendAssigneeWhere(where, values, filter.assigneeUserId, 'c');
    const result = await this.db.query(
      `${this.caseSelect()} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT 200`,
      values,
    );
    return result.rows.map((row) => mapCase(row as Record<string, unknown>));
  }

  async markReceived(id: string): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET status = 'received', received_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND status = 'waiting_receive'`,
      [id],
    );
  }

  async markCaring(id: string, due: Date): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET status = 'caring',
           received_at = COALESCE(received_at, NOW()),
           care_started_at = NOW(),
           care_due_at = $2,
           updated_at = NOW()
       WHERE id = $1::uuid AND status IN ('waiting_receive', 'received', 'caring')`,
      [id, due.toISOString()],
    );
  }

  async markPurchased(id: string): Promise<void> {
    await this.db.query(
      `UPDATE portal_care_cases
       SET status = 'purchased', care_due_at = NULL, receive_due_at = NULL, updated_at = NOW()
       WHERE id = $1::uuid AND status <> 'purchased'`,
      [id],
    );
  }

  async setLabels(id: string, labels: string[]): Promise<void> {
    await this.db.query(`UPDATE portal_care_cases SET labels = $2::text[], updated_at = NOW() WHERE id = $1::uuid`, [
      id,
      labels,
    ]);
  }

  async confirmCustomer(row: CareCaseRow): Promise<string> {
    await this.ensure();
    const caseRes = await this.db.query(
      `SELECT id::text, client_id::text, page_id, title, thread_key, kind, order_draft
       FROM portal_care_cases WHERE id = $1::uuid LIMIT 1`,
      [row.id],
    );
    const caseRow = caseRes.rows[0] as Record<string, unknown> | undefined;
    if (!caseRow) return '';
    const clientId = String(caseRow.client_id);
    const pageId = String(caseRow.page_id);
    const order = parseOrder(row.order ?? caseRow.order_draft);
    const contact = await this.resolveCustomerContact(clientId, pageId, {
      kind: String(caseRow.kind),
      thread_key: String(caseRow.thread_key),
      title: String(caseRow.title ?? ''),
      order,
      caseId: String(caseRow.id),
    });
    const existingId = await this.findCustomerByContact(clientId, contact.phone, contact.email, contact.psid);
    let customerId = existingId;
    if (customerId) {
      await this.db.query(
        `UPDATE portal_customers
         SET case_id = $2::uuid,
             display_name = CASE WHEN display_name = '' AND $3 <> '' THEN $3 ELSE display_name END,
             phone = CASE WHEN phone = '' AND $4 <> '' THEN $4 ELSE phone END,
             email = CASE WHEN email = '' AND $5 <> '' THEN $5 ELSE email END,
             psid = CASE WHEN psid = '' AND $6 <> '' THEN $6 ELSE psid END,
             source_lead_id = COALESCE($7::uuid, source_lead_id),
             source_conversation_case_id = COALESCE($8::uuid, source_conversation_case_id),
             last_interaction_at = NOW()
         WHERE id = $1::uuid`,
        [
          customerId,
          caseRow.id,
          contact.displayName,
          contact.phone,
          contact.email,
          contact.psid,
          contact.sourceLeadId,
          contact.sourceCaseId,
        ],
      );
    } else {
      const inserted = await this.db.query(
        `INSERT INTO portal_customers (
           client_id, page_id, display_name, thread_key, case_id,
           phone, email, psid, last_interaction_at, source_lead_id, source_conversation_case_id
         )
         SELECT client_id, page_id, $2, thread_key, id,
                $3, $4, $5, NOW(), $6::uuid, $7::uuid
         FROM portal_care_cases WHERE id = $1::uuid
         ON CONFLICT (client_id, thread_key) DO UPDATE
         SET case_id = EXCLUDED.case_id,
             phone = CASE WHEN portal_customers.phone = '' AND EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE portal_customers.phone END,
             email = CASE WHEN portal_customers.email = '' AND EXCLUDED.email <> '' THEN EXCLUDED.email ELSE portal_customers.email END,
             psid = CASE WHEN portal_customers.psid = '' AND EXCLUDED.psid <> '' THEN EXCLUDED.psid ELSE portal_customers.psid END,
             source_lead_id = COALESCE(EXCLUDED.source_lead_id, portal_customers.source_lead_id),
             source_conversation_case_id = COALESCE(EXCLUDED.source_conversation_case_id, portal_customers.source_conversation_case_id),
             last_interaction_at = NOW()
         RETURNING id::text`,
        [
          row.id,
          contact.displayName,
          contact.phone,
          contact.email,
          contact.psid,
          contact.sourceLeadId,
          contact.sourceCaseId,
        ],
      );
      customerId = String(inserted.rows[0]?.id ?? '');
      if (!customerId && contact.phone) {
        customerId = await this.findCustomerByContact(clientId, contact.phone, contact.email, contact.psid);
      }
    }
    if (customerId) {
      await this.db.query(`UPDATE portal_care_cases SET customer_id = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`, [
        row.id,
        customerId,
      ]);
    }
    return customerId;
  }

  async saveOrder(id: string, draft: OrderDraft): Promise<void> {
    await this.db.query(`UPDATE portal_care_cases SET order_draft = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`, [
      id,
      JSON.stringify(draft),
    ]);
  }

  async listCustomers(
    clientId: string,
    filter: { pageId?: string; day?: string; label?: string; assigneeUserId?: string },
  ): Promise<CareCaseRow[]> {
    await this.ensure();
    const values: unknown[] = [clientId];
    const where = ['cu.client_id = $1::uuid', 'c.id IS NOT NULL'];
    if (filter.pageId) {
      values.push(filter.pageId);
      where.push(`cu.page_id = $${values.length}`);
    }
    if (filter.day && /^\d{4}-\d{2}-\d{2}$/.test(filter.day)) {
      values.push(filter.day);
      where.push(
        `(COALESCE(cu.last_interaction_at, cu.created_at) AT TIME ZONE 'Asia/Bangkok')::date = $${values.length}::date`,
      );
    }
    if (filter.label) {
      values.push(filter.label);
      where.push(`$${values.length} = ANY (c.labels)`);
    }
    appendAssigneeWhere(where, values, filter.assigneeUserId, 'c');
    const result = await this.db.query(
      `${this.customerCaseSelect()} WHERE ${where.join(' AND ')} ORDER BY cu.last_interaction_at DESC NULLS LAST, cu.created_at DESC LIMIT 200`,
      values,
    );
    return result.rows.map((row) => mapCase(row as Record<string, unknown>));
  }

  async listMessages(
    clientId: string,
    pageId: string,
    input: { psid: string; senderName: string },
  ): Promise<Array<{ id: string; sender_name: string; body: string; received_at: string; direction: string }>> {
    const psid = String(input.psid ?? '').trim();
    const senderName = String(input.senderName ?? '').trim();
    const result = await this.db.query(
      psid
        ? `SELECT id::text, sender_name, body, received_at, direction
           FROM portal_page_messages
           WHERE client_id = $1::uuid AND page_id = $2 AND sender_psid = $3
           ORDER BY received_at ASC
           LIMIT 100`
        : /* tạm: chỉ khi chưa có PSID */ `SELECT id::text, sender_name, body, received_at, direction
           FROM portal_page_messages
           WHERE client_id = $1::uuid AND page_id = $2 AND lower(sender_name) = lower($3)
           ORDER BY received_at ASC
           LIMIT 100`,
      psid ? [clientId, pageId, psid] : [clientId, pageId, senderName],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      sender_name: String(row.sender_name ?? ''),
      body: String(row.body ?? ''),
      received_at: iso(row.received_at),
      direction: String(row.direction ?? 'in'),
    }));
  }

  async insertOutbound(
    clientId: string,
    pageId: string,
    sender: string,
    body: string,
    externalId = '',
    senderPsid = '',
  ): Promise<void> {
    const psid = String(senderPsid ?? '').slice(0, 64);
    await this.db.query(
      `INSERT INTO portal_page_messages (client_id, page_id, external_message_id, sender_name, sender_psid, body, direction)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'out')`,
      [clientId, pageId, externalId, sender, psid, body],
    );
    await this.touchCustomerInteraction(clientId, pageId, { psid, senderName: sender });
  }

  async listPosts(clientId: string, pageId?: string): Promise<Array<{ id: string; page_id: string; body: string; published_at: string }>> {
    const values: unknown[] = [clientId];
    let pageSql = '';
    if (pageId) {
      values.push(pageId);
      pageSql = ' AND page_id = $2';
    }
    const result = await this.db.query(
      `SELECT id::text, page_id, body, published_at FROM portal_page_posts
       WHERE client_id = $1::uuid${pageSql}
       ORDER BY published_at DESC LIMIT 100`,
      values,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      page_id: String(row.page_id),
      body: String(row.body ?? ''),
      published_at: iso(row.published_at),
    }));
  }

  async insertPost(clientId: string, pageId: string, body: string): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_posts (client_id, page_id, body) VALUES ($1::uuid, $2, $3)`,
      [clientId, pageId, body],
    );
  }

  async listProducts(
    clientId: string,
    pageId?: string,
    opts?: { includeInactive?: boolean },
  ): Promise<Array<{ id: string; page_id: string; name: string; image_url: string; detail: string; spec: ProductSpec; active: boolean }>> {
    const values: unknown[] = [clientId];
    let pageSql = '';
    if (pageId) {
      values.push(pageId);
      pageSql = ' AND page_id = $2';
    }
    const activeSql = opts?.includeInactive ? '' : ' AND active IS NOT FALSE';
    const result = await this.db.query(
      `SELECT id::text, page_id, name, image_url, detail, spec, active FROM portal_page_products
       WHERE client_id = $1::uuid${pageSql}${activeSql}
       ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((row) => this.mapProduct(row));
  }

  async insertProduct(clientId: string, pageId: string, name: string, imageUrl: string, detail: string, spec: ProductSpec): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_products (client_id, page_id, name, image_url, detail, spec)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
      [clientId, pageId, name, imageUrl, detail, JSON.stringify(spec)],
    );
  }

  async updateProduct(
    clientId: string,
    pageId: string,
    productId: string,
    patch: { name?: string; detail?: string; imageUrl?: string; spec?: ProductSpec; active?: boolean },
  ): Promise<boolean> {
    const sets: string[] = [];
    const values: unknown[] = [clientId, pageId, productId];
    let n = 4;
    if (patch.name !== undefined) {
      sets.push(`name = $${n}`);
      values.push(patch.name);
      n += 1;
    }
    if (patch.detail !== undefined) {
      sets.push(`detail = $${n}`);
      values.push(patch.detail);
      n += 1;
    }
    if (patch.imageUrl !== undefined) {
      sets.push(`image_url = $${n}`);
      values.push(patch.imageUrl);
      n += 1;
    }
    if (patch.spec !== undefined) {
      sets.push(`spec = $${n}::jsonb`);
      values.push(JSON.stringify(patch.spec));
      n += 1;
    }
    if (patch.active !== undefined) {
      sets.push(`active = $${n}`);
      values.push(patch.active);
      n += 1;
    }
    if (!sets.length) return true;
    const result = await this.db.query(
      `UPDATE portal_page_products SET ${sets.join(', ')}
       WHERE client_id = $1::uuid AND page_id = $2 AND id = $3::uuid`,
      values,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteProduct(clientId: string, pageId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM portal_page_products WHERE client_id = $1::uuid AND page_id = $2 AND id = $3::uuid`,
      [clientId, pageId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findProduct(clientId: string, id: string): Promise<{ id: string; page_id: string; name: string; detail: string; spec: ProductSpec; active: boolean } | null> {
    const result = await this.db.query(
      `SELECT id::text, page_id, name, image_url, detail, spec, active FROM portal_page_products
       WHERE client_id = $1::uuid AND id = $2::uuid LIMIT 1`,
      [clientId, id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const mapped = this.mapProduct(row);
    return { id: mapped.id, page_id: mapped.page_id, name: mapped.name, detail: mapped.detail, spec: mapped.spec, active: mapped.active };
  }

  private mapProduct(row: Record<string, unknown>): { id: string; page_id: string; name: string; image_url: string; detail: string; spec: ProductSpec; active: boolean } {
    const spec = parseProductSpec(row.spec);
    const image = spec.colors[0]?.image || String(row.image_url ?? '');
    return {
      id: String(row.id),
      page_id: String(row.page_id),
      name: String(row.name ?? ''),
      image_url: image,
      detail: String(row.detail ?? ''),
      spec,
      active: row.active !== false,
    };
  }

  async listLabels(clientId: string): Promise<Array<{ id: string; name: string; color: string }>> {
    await this.db.query(
      `INSERT INTO portal_page_labels (client_id, name, color)
       SELECT $1::uuid, name, color
       FROM (VALUES ('Quan tâm', '#1877f2'), ('Cần gọi', '#f7b928'), ('Đã gửi SP', '#31a24c'), ('Hẹn mua', '#8b5cf6')) AS seed(name, color)
       ON CONFLICT (client_id, name) DO NOTHING`,
      [clientId],
    );
    const result = await this.db.query(
      `SELECT id::text, name, color FROM portal_page_labels WHERE client_id = $1::uuid ORDER BY name ASC`,
      [clientId],
    );
    return result.rows.map((row) => ({ id: String(row.id), name: String(row.name), color: String(row.color) }));
  }

  async insertLabel(clientId: string, name: string): Promise<void> {
    await this.db.query(
      `INSERT INTO portal_page_labels (client_id, name) VALUES ($1::uuid, $2)
       ON CONFLICT (client_id, name) DO NOTHING`,
      [clientId, name],
    );
  }

  private caseSelect(): string {
    return `SELECT c.id, c.page_id, c.channel, c.kind, c.thread_key, c.title,
                   c.assignee_user_id, COALESCE(u.email, '') AS assignee_email, c.status, c.labels, c.customer_id,
                   c.assigned_at, c.receive_due_at, c.received_at, c.care_started_at, c.care_due_at, c.created_at, c.order_draft,
                   COALESCE(
                     (SELECT MAX(m.received_at) FROM portal_page_messages m
                       WHERE m.client_id = c.client_id AND m.page_id = c.page_id
                         AND c.kind = 'message'
                         AND (
                           (m.sender_psid <> '' AND c.thread_key = 'mess:' || c.page_id || ':' || m.sender_psid)
                           OR (m.sender_psid = '' AND lower(m.sender_name) = lower(c.title))
                           OR c.thread_key = 'mess:' || c.page_id || ':' || lower(m.sender_name)
                         )),
                     l.created_at
                   ) AS last_interaction_at,
                   COALESCE(NULLIF(l.phone, ''), '') AS phone,
                   COALESCE(NULLIF(l.campaign_name, ''), '') AS source,
                   COALESCE(l.field_data, '[]'::jsonb) AS answers,
                   COALESCE(l.campaign_id, '') AS campaign_id,
                   COALESCE(l.adset_id, '') AS adset_id,
                   COALESCE(l.ad_id, '') AS ad_id_lead,
                   COALESCE(l.form_id, '') AS form_id,
                   (SELECT m.body FROM portal_page_messages m
                     WHERE m.client_id = c.client_id AND m.page_id = c.page_id
                       AND c.kind = 'message'
                       AND (
                         (m.sender_psid <> '' AND c.thread_key = 'mess:' || c.page_id || ':' || m.sender_psid)
                         OR (m.sender_psid = '' AND lower(m.sender_name) = lower(c.title))
                         OR c.thread_key = 'mess:' || c.page_id || ':' || lower(m.sender_name)
                       )
                     ORDER BY m.received_at DESC LIMIT 1) AS snippet
            FROM portal_care_cases c
            LEFT JOIN portal_client_users u ON u.id = c.assignee_user_id
            LEFT JOIN portal_page_leads l
              ON c.kind = 'lead'
             AND l.client_id = c.client_id
             AND c.thread_key = 'lead:' || l.id::text`;
  }

  private customerCaseSelect(): string {
    return `SELECT c.id, c.page_id, c.channel, c.kind, c.thread_key, c.title,
                   c.assignee_user_id, COALESCE(u.email, '') AS assignee_email, c.status, c.labels, c.customer_id,
                   c.assigned_at, c.receive_due_at, c.received_at, c.care_started_at, c.care_due_at, c.created_at, c.order_draft,
                   cu.last_interaction_at,
                   (SELECT m.body FROM portal_page_messages m
                     WHERE m.client_id = c.client_id AND m.page_id = c.page_id
                       AND c.kind = 'message'
                       AND (
                         (m.sender_psid <> '' AND c.thread_key = 'mess:' || c.page_id || ':' || m.sender_psid)
                         OR (m.sender_psid = '' AND lower(m.sender_name) = lower(c.title))
                         OR c.thread_key = 'mess:' || c.page_id || ':' || lower(m.sender_name)
                       )
                     ORDER BY m.received_at DESC LIMIT 1) AS snippet
            FROM portal_customers cu
            INNER JOIN portal_care_cases c ON c.id = cu.case_id
            LEFT JOIN portal_client_users u ON u.id = c.assignee_user_id`;
  }

  private async resolveCustomerContact(
    clientId: string,
    pageId: string,
    input: { kind: string; thread_key: string; title: string; order: OrderDraft; caseId: string },
  ): Promise<{
    displayName: string;
    phone: string;
    email: string;
    psid: string;
    sourceLeadId: string | null;
    sourceCaseId: string | null;
  }> {
    let phone = input.order.phone.trim().slice(0, 40);
    let email = '';
    let psid = '';
    let displayName = input.title.trim().slice(0, 200);
    let sourceLeadId: string | null = null;
    let sourceCaseId: string | null = null;
    if (input.kind === 'lead' && input.thread_key.startsWith('lead:')) {
      sourceLeadId = input.thread_key.slice(5).trim() || null;
      if (sourceLeadId) {
        const lead = await this.db.query(
          `SELECT full_name, phone, email FROM portal_page_leads
           WHERE client_id = $1::uuid AND id = $2::uuid LIMIT 1`,
          [clientId, sourceLeadId],
        );
        const row = lead.rows[0] as Record<string, unknown> | undefined;
        if (row) {
          if (!phone) phone = String(row.phone ?? '').trim().slice(0, 40);
          email = String(row.email ?? '').trim().slice(0, 200);
          const name = String(row.full_name ?? '').trim();
          if (name) displayName = name.slice(0, 200);
        }
      }
    }
    if (input.kind === 'message') {
      sourceCaseId = input.caseId;
      const fromKey = psidFromMessageThreadKey(pageId, input.thread_key);
      psid = fromKey || (await this.latestSenderPsid(clientId, pageId, fromKey, input.title)).slice(0, 64);
    }
    return {
      displayName: displayName || 'Khách',
      phone,
      email: email.toLowerCase(),
      psid,
      sourceLeadId,
      sourceCaseId,
    };
  }

  private async findCustomerByContact(clientId: string, phone: string, email: string, psid: string): Promise<string> {
    const normPhone = phone.trim();
    const normEmail = email.trim().toLowerCase();
    const normPsid = psid.trim();
    if (!normPhone && !normEmail && !normPsid) return '';
    const result = await this.db.query(
      `SELECT id::text FROM portal_customers
       WHERE client_id = $1::uuid
         AND (
           ($2 <> '' AND phone <> '' AND phone = $2)
           OR ($3 <> '' AND email <> '' AND lower(email) = $3)
           OR ($4 <> '' AND psid <> '' AND psid = $4)
         )
       ORDER BY last_interaction_at DESC NULLS LAST, created_at ASC
       LIMIT 1`,
      [clientId, normPhone, normEmail, normPsid],
    );
    return String(result.rows[0]?.id ?? '');
  }

  private async touchCustomerByContact(clientId: string, pageId: string, phone: string, email: string): Promise<void> {
    const normPhone = phone.trim().slice(0, 40);
    const normEmail = email.trim().toLowerCase().slice(0, 200);
    if (!normPhone && !normEmail) return;
    await this.db.query(
      `UPDATE portal_customers SET last_interaction_at = NOW()
       WHERE client_id = $1::uuid AND page_id = $2
         AND (
           ($3 <> '' AND phone <> '' AND phone = $3)
           OR ($4 <> '' AND email <> '' AND lower(email) = $4)
         )`,
      [clientId, pageId, normPhone, normEmail],
    );
  }

  private async touchCustomerInteraction(
    clientId: string,
    pageId: string,
    input: { psid?: string; senderName?: string },
  ): Promise<void> {
    const psid = String(input.psid ?? '').trim();
    if (psid) {
      await this.db.query(
        `UPDATE portal_customers SET last_interaction_at = NOW()
         WHERE client_id = $1::uuid AND psid <> '' AND psid = $2`,
        [clientId, psid],
      );
      return;
    }
    const sender = String(input.senderName ?? '').trim();
    if (!sender) return;
    await this.db.query(
      `UPDATE portal_customers cu
       SET last_interaction_at = NOW()
       FROM portal_care_cases c
       WHERE cu.id = c.customer_id
         AND c.client_id = $1::uuid
         AND c.page_id = $2
         AND c.kind = 'message'
         AND lower(c.title) = lower($3)`,
      [clientId, pageId, sender],
    );
  }
}
