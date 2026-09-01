import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CSD_TENANT_ID, CsdEmailRow } from './csd.types';

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

function mapEmail(row: Record<string, unknown>): CsdEmailRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    thread_id: row.thread_id != null ? text(row.thread_id) : null,
    direction: row.direction as CsdEmailRow['direction'],
    provider_message_id: row.provider_message_id != null ? text(row.provider_message_id) : null,
    from_address: text(row.from_address),
    to_json: (row.to_json as string[]) ?? [],
    subject: text(row.subject),
    body_text: text(row.body_text),
    send_status: text(row.send_status),
    matched_client_account_id:
      row.matched_client_account_id != null ? text(row.matched_client_account_id) : null,
    ticket_id: row.ticket_id != null ? text(row.ticket_id) : null,
    ignored: Boolean(row.ignored),
    sent_at: row.sent_at ? text(row.sent_at) : null,
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
  };
}

@Injectable()
export class CsdEmailRepository implements OnModuleDestroy {
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

  async findByProviderMessageId(providerMessageId: string): Promise<CsdEmailRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_emails
       WHERE tenant_id = $1 AND provider_message_id = $2
       LIMIT 1`,
      [CSD_TENANT_ID, providerMessageId],
    );
    return res.rows[0] ? mapEmail(res.rows[0]) : null;
  }

  async findTicketByCode(code: string): Promise<{ id: string; code: string; client_account_id: string | null } | null> {
    const res = await this.db.query(
      `SELECT id, code, client_account_id FROM csd_tickets
       WHERE tenant_id = $1 AND code = $2 AND is_deleted = FALSE
       LIMIT 1`,
      [CSD_TENANT_ID, code],
    );
    if (!res.rows[0]) return null;
    return {
      id: text(res.rows[0].id),
      code: text(res.rows[0].code),
      client_account_id:
        res.rows[0].client_account_id != null ? text(res.rows[0].client_account_id) : null,
    };
  }

  async insertInbound(input: {
    provider_message_id: string;
    from_address: string;
    to_json: string[];
    subject: string;
    body_text: string;
    body_html?: string;
    matched_client_account_id?: string | null;
    ticket_id?: string | null;
    ignored?: boolean;
  }): Promise<CsdEmailRow> {
    const res = await this.db.query(
      `INSERT INTO csd_emails (
         tenant_id, direction, provider_message_id, from_address, to_json,
         subject, body_text, body_html, send_status,
         matched_client_account_id, ticket_id, ignored
       ) VALUES ($1, 'in', $2, $3, $4::jsonb, $5, $6, $7, 'received', $8, $9, $10)
       RETURNING *`,
      [
        CSD_TENANT_ID,
        input.provider_message_id,
        input.from_address,
        JSON.stringify(input.to_json),
        input.subject,
        input.body_text,
        input.body_html ?? '',
        input.matched_client_account_id ?? null,
        input.ticket_id ?? null,
        input.ignored ?? false,
      ],
    );
    return mapEmail(res.rows[0]);
  }

  async insertOutbound(input: {
    from_address: string;
    to_json: string[];
    subject: string;
    body_text: string;
    body_html?: string;
    send_status: string;
    ticket_id?: string | null;
    created_by_staff_id: number;
  }): Promise<CsdEmailRow> {
    const res = await this.db.query(
      `INSERT INTO csd_emails (
         tenant_id, direction, from_address, to_json, subject, body_text, body_html,
         send_status, ticket_id, created_by_staff_id, sent_at
       ) VALUES ($1, 'out', $2, $3::jsonb, $4, $5, $6, $7, $8, $9, CASE WHEN $7 = 'sent' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [
        CSD_TENANT_ID,
        input.from_address,
        JSON.stringify(input.to_json),
        input.subject,
        input.body_text,
        input.body_html ?? '',
        input.send_status,
        input.ticket_id ?? null,
        input.created_by_staff_id,
      ],
    );
    return mapEmail(res.rows[0]);
  }

  async listUnmatched(limit = 50): Promise<CsdEmailRow[]> {
    const res = await this.db.query(
      `SELECT * FROM csd_emails
       WHERE tenant_id = $1 AND direction = 'in'
         AND matched_client_account_id IS NULL AND ignored = FALSE
       ORDER BY created_at DESC
       LIMIT $2`,
      [CSD_TENANT_ID, Math.min(Math.max(limit, 1), 200)],
    );
    return res.rows.map(mapEmail);
  }

  async insertApproval(input: {
    entity_id: string;
    requester_staff_id: number;
    comment?: string;
  }): Promise<{ id: string }> {
    const res = await this.db.query(
      `INSERT INTO csd_approvals (
         tenant_id, kind, entity_type, entity_id, status, requester_staff_id, comment
       ) VALUES ($1, 'email', 'email', $2, 'pending', $3, $4)
       RETURNING id`,
      [CSD_TENANT_ID, input.entity_id, input.requester_staff_id, input.comment ?? ''],
    );
    return { id: text(res.rows[0].id) };
  }

  async get(id: string): Promise<CsdEmailRow | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_emails WHERE tenant_id = $1 AND id = $2`,
      [CSD_TENANT_ID, id],
    );
    return res.rows[0] ? mapEmail(res.rows[0]) : null;
  }

  async markSent(id: string): Promise<CsdEmailRow> {
    const res = await this.db.query(
      `UPDATE csd_emails SET send_status = 'sent', sent_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [CSD_TENANT_ID, id],
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_email_not_found' });
    return mapEmail(res.rows[0]);
  }

  async countUnmatched(): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_emails
       WHERE tenant_id = $1 AND direction = 'in'
         AND matched_client_account_id IS NULL AND ignored = FALSE`,
      [CSD_TENANT_ID],
    );
    return Number(res.rows[0]?.c ?? 0);
  }
}
