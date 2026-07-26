import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CustomerTimelineEvent,
  CustomerTimelineInsert,
  CustomerTimelineListQuery,
  CustomerTimelineListResult,
  TimelineCompletenessReport,
} from './customer-timeline.types';

function mapRow(row: Record<string, unknown>): CustomerTimelineEvent {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    entity_type: String(row.entity_type ?? ''),
    entity_id: String(row.entity_id ?? ''),
    event_type: String(row.event_type ?? ''),
    event_source: row.event_source as CustomerTimelineEvent['event_source'],
    title: (row.title as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    occurred_at: String(row.occurred_at ?? ''),
    actor_id: (row.actor_id as string | null) ?? null,
    external_ref: (row.external_ref as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class CustomerTimelineRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'customer_timeline_events'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async findByExternalRef(externalRef: string): Promise<CustomerTimelineEvent | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, event_type, event_source,
         title, body, payload, occurred_at::text, actor_id, external_ref, created_at::text
       FROM customer_timeline_events
       WHERE external_ref = $1
       LIMIT 1`,
      [externalRef],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async insertEvent(row: CustomerTimelineInsert): Promise<CustomerTimelineEvent> {
    const occurredAt =
      row.occurredAt instanceof Date
        ? row.occurredAt.toISOString()
        : row.occurredAt ?? new Date().toISOString();

    const result = await this.db.query(
      `INSERT INTO customer_timeline_events (
         client_id, entity_type, entity_id, event_type, event_source,
         title, body, payload, occurred_at, actor_id, external_ref
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         $6, $7, $8::jsonb, $9::timestamptz, $10, $11
       )
       RETURNING
         id::text, client_id::text, entity_type, entity_id, event_type, event_source,
         title, body, payload, occurred_at::text, actor_id, external_ref, created_at::text`,
      [
        row.clientId ?? null,
        row.entityType,
        row.entityId,
        row.eventType,
        row.eventSource,
        row.title ?? null,
        row.body ?? null,
        JSON.stringify(row.payload ?? {}),
        occurredAt,
        row.actorId ?? null,
        row.externalRef ?? null,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async listEvents(query: CustomerTimelineListQuery): Promise<CustomerTimelineListResult> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const conditions = ['entity_type = $1', 'entity_id = $2'];
    const params: unknown[] = [query.entityType, query.entityId];
    let idx = 3;

    if (query.eventSource) {
      conditions.push(`event_source = $${idx++}`);
      params.push(query.eventSource);
    }

    const where = conditions.join(' AND ');
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM customer_timeline_events WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    const listParams = [...params, limit, offset];
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, event_type, event_source,
         title, body, payload, occurred_at::text, actor_id, external_ref, created_at::text
       FROM customer_timeline_events
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      listParams,
    );

    return {
      rows: result.rows.map((r) => mapRow(r as Record<string, unknown>)),
      total,
    };
  }

  async getLeadClientId(leadId: number): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT agency_client_id::text AS client_id
         FROM crm_leads
         WHERE sqlite_lead_id = $1
         LIMIT 1`,
        [leadId],
      );
      return (result.rows[0]?.client_id as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.db.query('DELETE FROM customer_timeline_events WHERE id = $1::uuid', [id]);
  }

  async completenessReport(sampleLimit = 500): Promise<TimelineCompletenessReport> {
    const limit = Math.min(Math.max(sampleLimit, 1), 5000);
    const result = await this.db.query(
      `WITH recent_leads AS (
         SELECT sqlite_lead_id::text AS lead_id
         FROM crm_leads
         WHERE COALESCE(is_duplicate, FALSE) IS NOT TRUE
         ORDER BY created_at DESC
         LIMIT $1
       ),
       with_timeline AS (
         SELECT DISTINCT rl.lead_id
         FROM recent_leads rl
         INNER JOIN customer_timeline_events t
           ON t.entity_type = 'lead' AND t.entity_id = rl.lead_id
       )
       SELECT
         (SELECT COUNT(*)::int FROM recent_leads) AS total_leads,
         (SELECT COUNT(*)::int FROM with_timeline) AS leads_with_timeline`,
      [limit],
    );
    const totalLeads = Number(result.rows[0]?.total_leads ?? 0);
    const withTimeline = Number(result.rows[0]?.leads_with_timeline ?? 0);
    const pct = totalLeads > 0 ? Math.round((1000 * withTimeline) / totalLeads) / 10 : 0;
    return {
      total_leads: totalLeads,
      leads_with_timeline: withTimeline,
      completeness_pct: pct,
      sample_limit: limit,
    };
  }
}
