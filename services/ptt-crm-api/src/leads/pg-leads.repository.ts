import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { pgRowToV1 } from './lead-v1.mapper';
import {
  buildB2bListScopeClause,
  buildLeadFlowKindListFilter,
} from '../leads-funnel/lead-flow-list-filter.util';
import type { LeadClassificationConfig } from '../crm-config/lead-classification.types';
import { LeadV1, ListLeadsQuery, PgLeadRow } from './leads.types';
import {
  defaultKanbanCardSettings,
  kanbanCardSettingsFromPayload,
  type KanbanCardSettings,
} from './kanban-card.util';
import { reviewQueueAssignmentClockSql } from '../leads-funnel/review-queue.util';

interface PgWhereClause {
  sql: string;
  params: unknown[];
}

function b2bListEnrichmentSql(): string {
  return `,
              bp.code AS project_code,
              COALESCE((l.meta_json->>'lead_score')::numeric, NULL) AS lead_score,
              l.assign_confidence,
              active_call.state AS b2b_call_state,
              EXISTS (
                SELECT 1 FROM crm_b2b_call_sessions c
                WHERE c.lead_id = l.sqlite_lead_id AND c.kind = 'human'
              ) AS b2b_has_call,
              COALESCE((l.meta_json->>'b2b_call_answered')::boolean, FALSE) AS b2b_call_answered,
              COALESCE(
                NULLIF(l.meta_json->>'auto_assigned_at', '')::timestamptz,
                l.received_at,
                l.created_at
              ) AS b2b_assigned_at,
              (
                SELECT COUNT(*)::int FROM crm_b2b_lead_hops h
                WHERE h.lead_id = l.sqlite_lead_id AND h.hop_kind = 'sla_reassign'
              ) AS b2b_hop_count`;
}

function b2bListJoinSql(): string {
  return `
       LEFT JOIN crm_b2b_projects bp ON bp.id = l.b2b_project_id
       LEFT JOIN LATERAL (
         SELECT c.state FROM crm_b2b_call_sessions c
         WHERE c.lead_id = l.sqlite_lead_id
           AND c.kind = 'human'
           AND c.state IN ('ringing', 'answered')
         ORDER BY c.created_at DESC
         LIMIT 1
       ) active_call ON TRUE`;
}

@Injectable()
export class PgLeadsRepository implements OnModuleDestroy {
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

  async listLeads(
    query: ListLeadsQuery,
    classification?: LeadClassificationConfig | null,
  ): Promise<{ leads: LeadV1[]; total: number }> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 200));
    const offset = Math.max(0, Number(query.offset ?? 0));
    const where = this.buildWhere(query);

    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_leads l${where.sql}`,
      where.params,
    );
    const total = Number(countResult.rows[0]?.c ?? 0);

    const listParams = [...where.params, limit, offset];
    const b2bList = query.lead_flow_kind === 'b2b_prospect' || Boolean(query.b2b_list_scope);
    const listResult = await this.db.query(
      `SELECT l.sqlite_lead_id, l.full_name, l.phone, l.email, l.status, l.source,
              l.owner_id, s.name AS owner_name, l.is_duplicate, l.agency_client_id, l.channel,
              l.external_lead_id, l.campaign_id, l.received_at, l.created_at,
              l.b2b_project_id::text, l.owner_company_id::text, l.assign_strategy,
              l.company_name, l.company_address, l.logo_asset_id,
              l.last_call_at::text AS last_call_at, l.last_call_result, l.next_call_at::text AS next_call_at,
              l.callback_at::text AS callback_at, l.hold_until::text AS hold_until, l.updated_at,
              (
                COALESCE(l.care_stages_done_json->>'first_contact', '') <> ''
                OR EXISTS (
                  SELECT 1 FROM crm_lead_activities a
                  WHERE a.lead_id = l.sqlite_lead_id
                    AND a.care_stage_key = 'first_contact'
                    AND a.activity_type <> 'system'
                    AND trim(COALESCE(a.care_status, '')) = 'da_lien_he_thanh_cong'
                )
              ) AS b2_complete,
              ${reviewQueueAssignmentClockSql('l')} AS b2_assigned_at,
              l.meta_json::text AS meta_json,
              COALESCE(l.first_assigned_at::text, (
                SELECT al.created_at::text FROM crm_lead_assignment_log al
                WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
                ORDER BY al.created_at ASC LIMIT 1
              ), '') AS first_assigned_at${b2bList ? b2bListEnrichmentSql() : ''}
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = l.owner_id${b2bList ? b2bListJoinSql() : ''}
       ${where.sql}
       ORDER BY l.sqlite_lead_id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const kanbanCard = b2bList ? await this.loadKanbanCardSettings() : null;
    return {
      leads: listResult.rows.map((row) =>
        pgRowToV1(row as PgLeadRow, { classification: classification ?? null, kanbanCard }),
      ),
      total,
    };
  }

  async getLeadById(
    leadId: number,
    classification?: LeadClassificationConfig | null,
  ): Promise<LeadV1 | null> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id, l.full_name, l.phone, l.email, l.status, l.source,
              l.owner_id, s.name AS owner_name, l.is_duplicate, l.agency_client_id, l.channel,
              l.external_lead_id, l.campaign_id, l.received_at, l.created_at,
              l.b2b_project_id::text, l.owner_company_id::text, l.assign_strategy,
              l.company_name, l.company_address, l.logo_asset_id,
              l.last_call_at::text AS last_call_at, l.last_call_result, l.next_call_at::text AS next_call_at,
              l.callback_at::text AS callback_at, l.hold_until::text AS hold_until, l.updated_at,
              (
                COALESCE(l.care_stages_done_json->>'first_contact', '') <> ''
                OR EXISTS (
                  SELECT 1 FROM crm_lead_activities a
                  WHERE a.lead_id = l.sqlite_lead_id
                    AND a.care_stage_key = 'first_contact'
                    AND a.activity_type <> 'system'
                    AND trim(COALESCE(a.care_status, '')) = 'da_lien_he_thanh_cong'
                )
              ) AS b2_complete,
              ${reviewQueueAssignmentClockSql('l')} AS b2_assigned_at,
              l.meta_json::text AS meta_json,
              COALESCE(l.first_assigned_at::text, (
                SELECT al.created_at::text FROM crm_lead_assignment_log al
                WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
                ORDER BY al.created_at ASC LIMIT 1
              ), '') AS first_assigned_at
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = l.owner_id
       WHERE l.sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] as PgLeadRow | undefined;
    if (!row) return null;
    const kanbanCard = await this.loadKanbanCardSettings();
    return pgRowToV1(row, { classification: classification ?? null, kanbanCard });
  }

  async listUnassignedB2bLeads(projectId: string, limit: number): Promise<LeadV1[]> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id, l.full_name, l.phone, l.email, l.status, l.source,
              l.owner_id, s.name AS owner_name, l.is_duplicate, l.agency_client_id, l.channel,
              l.external_lead_id, l.campaign_id, l.received_at, l.created_at,
              l.b2b_project_id::text, l.owner_company_id::text, l.assign_strategy,
              l.company_name, l.company_address, l.logo_asset_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.first_assigned_at::text, '') AS first_assigned_at
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = l.owner_id
       WHERE l.b2b_project_id = $1::uuid
         AND l.owner_id IS NULL
         AND l.is_duplicate IS NOT TRUE
       ORDER BY l.created_at ASC
       LIMIT $2`,
      [projectId, limit],
    );
    return (result.rows as PgLeadRow[]).map((row) => pgRowToV1(row));
  }

  private async loadKanbanCardSettings(): Promise<KanbanCardSettings> {
    try {
      const result = await this.db.query(
        `SELECT payload FROM crm_lead_sla_settings WHERE is_active IS TRUE ORDER BY id DESC LIMIT 1`,
      );
      const payload = result.rows[0]?.payload;
      return kanbanCardSettingsFromPayload(payload);
    } catch {
      return defaultKanbanCardSettings();
    }
  }

  private buildWhere(query: ListLeadsQuery): PgWhereClause {
    const clauses = ['l.is_duplicate IS NOT TRUE'];
    const params: unknown[] = [];

    const push = (clause: string, ...values: unknown[]) => {
      const idx = params.length + 1;
      clauses.push(clause.replace('?', `$${idx}`));
      params.push(...values);
    };

    if (query.client_id?.trim()) {
      push('l.agency_client_id = ?::uuid', query.client_id.trim());
    }
    if (query.allowed_client_ids?.length) {
      push('l.agency_client_id = ANY(?::uuid[])', query.allowed_client_ids);
    }
    const statuses = (query.statuses ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (statuses.length) {
      push('lower(l.status) = ANY(?::text[])', statuses);
    } else if (query.status?.trim()) {
      push('l.status = ?', query.status.trim());
    }
    if (query.source?.trim()) {
      push('l.source = ?', query.source.trim());
    }
    if (query.channel?.trim()) {
      push('lower(l.channel) = ?', query.channel.trim().toLowerCase());
    }
    if (query.unassigned_only) {
      clauses.push('l.owner_id IS NULL');
    } else if (query.assigned_only) {
      clauses.push('l.owner_id IS NOT NULL');
    } else if (query.owner_id != null && Number.isFinite(query.owner_id)) {
      push('l.owner_id = ?', Number(query.owner_id));
    }
    if (query.q?.trim()) {
      const text = query.q.trim();
      const digits = leadSearchPhoneDigits(text);
      const base = params.length;
      if (digits) {
        clauses.push(
          `(right(regexp_replace(COALESCE(l.phone, ''), '\\D', '', 'g'), 9) LIKE $${base + 1} OR l.full_name ILIKE $${base + 2} OR l.email ILIKE $${base + 2})`,
        );
        params.push(`%${digits}%`, `%${text}%`);
      } else {
        const like = `%${text}%`;
        clauses.push(
          `(l.full_name ILIKE $${base + 1} OR l.phone ILIKE $${base + 2} OR l.email ILIKE $${base + 3})`,
        );
        params.push(like, like, like);
      }
    }
    if (isIsoDate(query.received_from)) {
      push('COALESCE(l.received_at, l.created_at) >= ?::date', query.received_from);
    }
    if (isIsoDate(query.received_to)) {
      push(`COALESCE(l.received_at, l.created_at) < (?::date + interval '1 day')`, query.received_to);
    }
    if (query.lead_flow_kind) {
      clauses.push(buildLeadFlowKindListFilter(query.lead_flow_kind, 'postgres', 'l'));
    }
    if (query.b2b_list_scope) {
      const base = params.length;
      const staffParam = `$${base + 1}`;
      const scopeClause = buildB2bListScopeClause('postgres', 'l', query.b2b_list_scope, staffParam);
      if (scopeClause) {
        clauses.push(scopeClause);
        params.push(query.b2b_list_scope.staffId);
      }
    }
    if (query.review_queue_filter === 'only') {
      const ids = query.review_queue_ids ?? [];
      if (ids.length === 0) {
        clauses.push('FALSE');
      } else {
        const base = params.length;
        const placeholders = ids.map((_, i) => `$${base + i + 1}`).join(', ');
        clauses.push(`l.sqlite_lead_id IN (${placeholders})`);
        params.push(...ids);
      }
    } else if (query.review_queue_filter === 'hide') {
      const ids = query.review_queue_ids ?? [];
      if (ids.length > 0) {
        const base = params.length;
        const placeholders = ids.map((_, i) => `$${base + i + 1}`).join(', ');
        clauses.push(`l.sqlite_lead_id NOT IN (${placeholders})`);
        params.push(...ids);
      }
    }

    return {
      sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }
}
