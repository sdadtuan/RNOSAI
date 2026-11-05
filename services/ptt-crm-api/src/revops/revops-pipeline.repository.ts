import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { buildB2bProspectListFilter } from '../leads-funnel/lead-flow-list-filter.util';
import type { RevopsScope } from './revops.types';

export type RevopsPipelineDbRow = {
  leadId: number;
  name: string;
  product: string | null;
  amountVnd: number | null;
  closeDate: string | null;
  ownerName: string | null;
  presalesStage: string | null;
  hasProposal: boolean;
  contractApprovalPending: boolean;
  leadStatus: string;
  stageEnteredAt: string | null;
  lastActivityAt: string | null;
};

@Injectable()
export class RevopsPipelineRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: AppConfigService) {
    this.pool = new Pool({ connectionString: this.config.databaseUrl });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async listDeals(opts: { scope: RevopsScope; staffId: number; limit?: number }): Promise<RevopsPipelineDbRow[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 300, 500));
    const params: unknown[] = [];
    const clauses = [
      'l.is_duplicate IS NOT TRUE',
      buildB2bProspectListFilter('postgres', 'l'),
      `lower(trim(COALESCE(l.status, ''))) NOT IN ('won', 'chot', 'lost', 'mat')`,
      `ps.id IS NOT NULL`,
      `ps.status = 'active'`,
    ];

    if (opts.scope === 'me' && opts.staffId > 0) {
      params.push(opts.staffId);
      clauses.push(`l.owner_id = $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        l.sqlite_lead_id AS lead_id,
        l.full_name AS name,
        l.status AS lead_status,
        ps.stage AS presales_stage,
        ps.service_slug AS product,
        ps.stage_entered_at::text AS stage_entered_at,
        COALESCE(
          NULLIF(l.meta_json->'financial'->>'expected_value', '')::numeric,
          prop.total_vnd
        ) AS amount_vnd,
        NULLIF(l.meta_json->'financial'->>'expected_close_date', '') AS close_date,
        staff.display_name AS owner_name,
        prop.proposal_id IS NOT NULL AS has_proposal,
        COALESCE(appr.pending, FALSE) AS contract_approval_pending,
        COALESCE(l.updated_at, l.created_at)::text AS last_activity_at
      FROM crm_leads l
      INNER JOIN crm_lead_presales ps ON ps.lead_id = l.sqlite_lead_id
      LEFT JOIN crm_staff staff ON staff.id = l.owner_id
      LEFT JOIN LATERAL (
        SELECT p.id AS proposal_id, p.total_vnd
        FROM crm_proposals p
        WHERE p.lead_id = l.sqlite_lead_id
        ORDER BY p.id DESC
        LIMIT 1
      ) prop ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS pending
        FROM crm_lead_contracts c
        INNER JOIN crm_contract_approvals ca ON ca.contract_id = c.id
        WHERE c.lead_id = l.sqlite_lead_id AND ca.status = 'pending'
        LIMIT 1
      ) appr ON TRUE
      WHERE ${clauses.join(' AND ')}
      ORDER BY l.sqlite_lead_id DESC
      LIMIT $${limitIdx}`;

    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => ({
      leadId: Number(row.lead_id),
      name: String(row.name ?? ''),
      product: row.product != null ? String(row.product) : null,
      amountVnd: row.amount_vnd != null ? Number(row.amount_vnd) : null,
      closeDate: row.close_date != null ? String(row.close_date) : null,
      ownerName: row.owner_name != null ? String(row.owner_name) : null,
      presalesStage: row.presales_stage != null ? String(row.presales_stage) : null,
      hasProposal: Boolean(row.has_proposal),
      contractApprovalPending: Boolean(row.contract_approval_pending),
      leadStatus: String(row.lead_status ?? ''),
      stageEnteredAt: row.stage_entered_at != null ? String(row.stage_entered_at) : null,
      lastActivityAt: row.last_activity_at != null ? String(row.last_activity_at) : null,
    }));
  }
}
