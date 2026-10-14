import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { formatB2bCallActivity } from '../lead-fr-sla/lead-call-activity.util';
import { resolveSessionIdFromProviderRef } from './b2b-cpaas-stringee.util';
import type { B2bCallKind, B2bCallSessionRow, B2bCallState } from './b2b-calls.types';

@Injectable()
export class B2bCallsRepository implements OnModuleDestroy {
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

  async insertSession(input: {
    leadId: number;
    staffId: number | null;
    kind: B2bCallKind;
    provider: string;
    state: B2bCallState;
  }): Promise<B2bCallSessionRow> {
    const result = await this.db.query(
      `INSERT INTO crm_b2b_call_sessions (lead_id, staff_id, provider, state, kind)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text, lead_id, staff_id, provider, state, kind,
                 NULL::text AS provider_call_id`,
      [input.leadId, input.staffId, input.provider, input.state, input.kind],
    );
    const row = result.rows[0];
    return {
      id: String(row.id),
      leadId: Number(row.lead_id),
      staffId: row.staff_id != null ? Number(row.staff_id) : null,
      provider: String(row.provider),
      state: String(row.state) as B2bCallState,
      kind: String(row.kind) as B2bCallKind,
      providerCallId: null,
    };
  }

  async attachProviderCallId(sessionId: string, _providerCallId: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_b2b_call_sessions SET state = 'ringing' WHERE id = $1::uuid`,
      [sessionId],
    );
  }

  async updateState(input: { sessionId: string; state: B2bCallState }): Promise<void> {
    await this.db.query(
      `UPDATE crm_b2b_call_sessions
       SET state = $2,
           ended_at = CASE WHEN $2 IN ('ended', 'no_answer') THEN NOW() ELSE ended_at END
       WHERE id = $1::uuid`,
      [input.sessionId, input.state],
    );
  }

  async findByProviderCallId(providerCallId: string): Promise<B2bCallSessionRow | null> {
    const sessionId = resolveSessionIdFromProviderRef(providerCallId);
    return this.findBySessionId(sessionId);
  }

  async findBySessionId(sessionId: string): Promise<B2bCallSessionRow | null> {
    const result = await this.db.query(
      `SELECT id::text, lead_id, staff_id, provider, state, kind
       FROM crm_b2b_call_sessions
       WHERE id::text = $1
       LIMIT 1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      leadId: Number(row.lead_id),
      staffId: row.staff_id != null ? Number(row.staff_id) : null,
      provider: String(row.provider),
      state: String(row.state) as B2bCallState,
      kind: String(row.kind) as B2bCallKind,
      providerCallId: null,
    };
  }

  async recordHumanCallActivity(input: {
    leadId: number;
    staffId: number | null;
    state: string;
  }): Promise<void> {
    const status = await this.db.query(
      `SELECT COALESCE(status, '') AS status FROM crm_leads WHERE sqlite_lead_id = $1`,
      [input.leadId],
    );
    const formatted = formatB2bCallActivity({
      state: input.state,
      leadStatus: String(status.rows[0]?.status ?? ''),
    });
    if (!formatted) return;
    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, user_id, activity_type, content, result, next_action,
         created_at, created_by, lead_status_at_log
       )
       SELECT l.sqlite_lead_id, $2, 'call', $3, $4, '', NOW(),
              COALESCE(NULLIF(trim(s.email), ''), CASE WHEN $2::bigint IS NULL THEN 'ae' ELSE 'staff:' || $2::text END),
              COALESCE(l.status, '')
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = $2
       WHERE l.sqlite_lead_id = $1`,
      [input.leadId, input.staffId, formatted.content, formatted.result],
    );
  }

  async markLeadAnswered(leadId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_leads
       SET meta_json = COALESCE(meta_json, '{}'::jsonb) || '{"b2b_call_answered": true}'::jsonb,
           updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId],
    );
  }

  async hasHumanDial(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_b2b_call_sessions
       WHERE lead_id = $1 AND kind = 'human' LIMIT 1`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async hasAiCall(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_b2b_call_sessions
       WHERE lead_id = $1 AND kind = 'ai' LIMIT 1`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
