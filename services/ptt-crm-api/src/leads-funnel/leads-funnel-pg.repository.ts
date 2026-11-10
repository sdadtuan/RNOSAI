import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { parseLeadMetaIndustry } from '../intake/intake-context.util';
import { prefillCompanyName } from '../leads/lead-party.util';
import { AppConfigService } from '../config/app-config.service';
import { assertEligibleLeadOwner, ELIGIBLE_LEAD_OWNER_SQL } from '../ae-team/eligible-lead-owner';
import { isSpokenCallResult, preB2HoldState, type PreB2HoldState } from './pre-b2-hold.util';
import { sanitizePgBigintUserId } from '../staff-auth/staff-user-id.util';
import {
  careStatusLabel,
  normalizeCareContactType,
  normalizeCareReportStatus,
} from './care-status.util';
import {
  assertPresalesCareGate,
  CARE_PIPELINE_STAGES,
  CARE_STAGE_KEYS,
  CARE_STAGE_MIN_COMPLETION_NOTE_LEN,
  CONTACT_OK_CARE_STATUS,
  carePipelineState,
  parseLeadMeta,
  presalesCareGateState,
  serializeStagesDone,
} from './care-pipeline.util';
import { recordLifecycleMilestone } from '../lifecycle-milestone/lifecycle-milestone.pg.util';
import { resolveLeadFlowKindFromFunnelRow } from './lead-flow-kind.util';
import { buildB2bListScopeClause } from './lead-flow-list-filter.util';
import type { B2bListScope } from '../b2b-projects/b2b-lead-scope.service';
import {
  CompleteCareStageBody,
  LeadFunnelRow,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  PRESALES_STAGES,
  PresalesHandoffView,
  PresalesRow,
  PresalesSnapshot,
  PresalesTaskRow,
  ReleaseReviewQueueBody,
  SolutionQueueRow,
} from './leads-funnel.types';
import {
  consultAdvanceBlockReason,
  validatePresalesConsultAdvance,
} from './presales-consult-gate.util';
import {
  blocksDirectProposalAdvance,
  leadStatusAfterSolutionHandoff,
  normalizeHandoffStatus,
  SOLUTION_HANDOFF_LEAD_STATUS,
  STATUSES_PROMOTED_ON_SOLUTION_HANDOFF,
} from './presales-solution-handoff.util';
import {
  defaultStrategyJson,
  parsePresalesJsonRecord,
  planContentFromRow,
  solutionSubmitGaps,
  validatePreliminaryPlan,
} from './presales-marketing-plan.util';
import {
  clientBriefMissing,
  leadQualifyFacts,
  prefillClientBriefFromTasks,
  readClientBrief,
  resolveLeadNiche,
} from './client-plan-brief.util';
import { SOLUTION_HANDOFF_ACTIVITY_TYPES } from './presales-solution-handoff-activity.util';
import {
  QUOTE_ACCEPT_MINUTES,
  QUOTE_FINISH_HOURS,
  buildQuoteCaseView,
  holdsQuoteDesk,
  isBaoGiaColumnStatus,
  preferredMarketingLeaderId,
  quoteDeskForPhase,
  quoteDeadlineIso,
  quoteLateEventKey,
  quoteTimerLabel,
  quoteWasAutoReassigned,
  readQuoteLateEvents,
  type QuoteLateEvent,
  type QuoteLateTimer,
} from './quote-case.util';
import {
  SOLUTION_ACCEPT_MINUTES,
  SOLUTION_CUSTOMER_HOURS,
  SOLUTION_REVISION_HOURS,
  buildSolutionCaseView,
  solutionWorkDueAt,
} from './solution-case.util';
import { renderLeadContractDocx, renderLeadQuoteDocx } from './lead-quote-docx';
import { renderLeadQuoteXlsx } from './lead-quote-xlsx';
import {
  QUOTE_DELIVERY_HOURS_CODE,
  QUOTE_DELIVERY_HOURS_NAME,
  deliveryKpiFromSheet,
  deliveryPeriod,
  type DeliveryKpiSplit,
} from './quote-delivery-kpi.util';
import {
  QUOTE_SHEET_MAX_SERVICES,
  assembleQuoteSheet,
  hourlyFromPosition,
  implementationPlanFromSheet,
  readStoredQuoteSheet,
  type QuoteSheetItem,
  type QuoteSheetService,
  type QuoteSheetStaff,
  type QuoteSheetView,
} from './quote-sheet.util';
import { workflowStepsForService } from './presales-workflow-steps.util';
import {
  buildPresalesWorkflowUpgradePlan,
  mergeLegacyPresalesFormData,
  normalizeUpgradeStages,
} from './presales-workflow-upgrade.util';
import {
  capBatchLeadIds,
  PRESALES_BATCH_UPGRADE_MAX,
  PRESALES_UPGRADE_CONSULT_FIELD_MIN,
  type PresalesWorkflowUpgradeCohortRow,
} from './presales-workflow-batch.util';
import { repairPresalesLeadTasksFromLatestGoIntake } from '../intake/intake-presales-sync.util';
import type { IntakeSessionRow } from '../intake/intake.types';
import {
  pickLatestCompletedIntake,
  prefillPresalesConsultTaskForm,
} from './presales-consult-prefill.util';
import {
  buildPresalesL2DocsView,
  mergePresalesL2DocsPatch,
  parsePresalesL2DocsJson,
} from './presales-l2-docs.util';
import {
  buildPresalesConsultProposalSla,
  isConsultToProposalWithin48h,
  type PresalesConsultSlaSummary,
} from './presales-consult-sla.util';
import {
  loadPresalesFunnelMetricsPg,
  type PresalesFunnelMetricsPayload,
  type PresalesFunnelMetricsQuery,
} from './presales-funnel-metrics-load.pg.util';
import {
  DEFAULT_B2_CONTACT_DEADLINE_HOURS,
  isLeadInReviewQueue,
  normalizeB2ContactDeadlineHours,
  REVIEW_QUEUE_REASON,
  reviewQueueAssignmentClockSql,
  reviewQueuePublicState,
} from './review-queue.util';

type HoldScanRow = LeadFunnelRow & {
  last_call_result?: string | null;
  hold_until?: string | null;
  callback_at?: string | null;
  last_call_at?: string | null;
  attempts_since_assign?: number | null;
  reassign_count?: number | null;
  is_hot?: boolean | null;
};

type PgPresalesRow = {
  id: string;
  lead_id: string;
  service_slug: string;
  stage: string;
  status: string;
  assigned_am: string | null;
  lifecycle_id: string | null;
  stage_entered_at: Date | string | null;
  notes: string;
  draft_marketing_plan_id: string | null;
  l2_docs_json?: unknown;
  consult_entered_at?: Date | string | null;
  proposal_entered_at?: Date | string | null;
  handoff_status?: string | null;
  handed_off_at?: Date | string | null;
  handed_off_by_staff_id?: string | null;
  solution_owner_staff_id?: string | null;
  solution_claimed_at?: Date | string | null;
  solution_released_at?: Date | string | null;
  solution_accept_due_at?: Date | string | null;
  solution_due_at?: Date | string | null;
  solution_customer_due_at?: Date | string | null;
  solution_revision_note?: string | null;
  solution_revision_due_at?: Date | string | null;
  solution_approved_at?: Date | string | null;
  quote_offered_at?: Date | string | null;
  quote_accept_due_at?: Date | string | null;
  quote_accepted_at?: Date | string | null;
  quote_due_at?: Date | string | null;
  quote_sent_back_at?: Date | string | null;
  quote_change_note?: string | null;
  quote_approved_at?: Date | string | null;
  quote_ceo_escalated_at?: Date | string | null;
  quote_late_events?: unknown;
  quote_assignee_staff_id?: string | number | null;
  quote_reassign_note?: string | null;
  implementation_status?: string | null;
  contract_created_at?: Date | string | null;
  contract_signed_at?: Date | string | null;
  contract_amount_vnd?: string | number | null;
};

@Injectable()
export class LeadsFunnelPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private quoteCaseReady: Promise<void> | null = null;
  private deliveryKpiReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private ts(): string {
    return catalogTs();
  }

  private async assertActiveStaffOwner(ownerId: number): Promise<void> {
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      throw new Error('AM không hợp lệ hoặc đã ngưng.');
    }
    const result = await this.db.query(
      `SELECT 1 AS ok FROM crm_lead_assignment_log WHERE to_owner_id = $1
       UNION ALL
       SELECT 1 FROM crm_leads WHERE owner_id = $1
       LIMIT 1`,
      [ownerId],
    );
    if (!result.rows.length) {
      throw new Error('AM không hợp lệ hoặc đã ngưng.');
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private mapPresalesRow(row: PgPresalesRow): PresalesRow {
    return {
      id: Number(row.id),
      lead_id: Number(row.lead_id),
      service_slug: String(row.service_slug ?? ''),
      stage: String(row.stage ?? 'lead') as PresalesRow['stage'],
      status: String(row.status ?? 'active'),
      assigned_am: row.assigned_am != null ? Number(row.assigned_am) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      stage_entered_at: row.stage_entered_at ? String(row.stage_entered_at) : '',
      consult_entered_at: row.consult_entered_at ? String(row.consult_entered_at) : '',
      proposal_entered_at: row.proposal_entered_at ? String(row.proposal_entered_at) : '',
      notes: String(row.notes ?? ''),
      draft_marketing_plan_id:
        row.draft_marketing_plan_id != null ? Number(row.draft_marketing_plan_id) : null,
      l2_docs_json: parsePresalesL2DocsJson(row.l2_docs_json ?? {}),
      handoff_status: normalizeHandoffStatus(row.handoff_status),
      handed_off_at: row.handed_off_at ? String(row.handed_off_at) : '',
      handed_off_by_staff_id:
        row.handed_off_by_staff_id != null ? Number(row.handed_off_by_staff_id) : null,
      solution_owner_staff_id:
        row.solution_owner_staff_id != null ? Number(row.solution_owner_staff_id) : null,
      solution_claimed_at: row.solution_claimed_at ? String(row.solution_claimed_at) : '',
      solution_released_at: row.solution_released_at ? String(row.solution_released_at) : '',
      solution_accept_due_at: row.solution_accept_due_at ? String(row.solution_accept_due_at) : '',
      solution_due_at: row.solution_due_at ? String(row.solution_due_at) : '',
      solution_customer_due_at: row.solution_customer_due_at ? String(row.solution_customer_due_at) : '',
      solution_revision_note: String(row.solution_revision_note ?? ''),
      solution_revision_due_at: row.solution_revision_due_at ? String(row.solution_revision_due_at) : '',
      solution_approved_at: row.solution_approved_at ? String(row.solution_approved_at) : '',
      quote_offered_at: row.quote_offered_at ? String(row.quote_offered_at) : '',
      quote_accept_due_at: row.quote_accept_due_at ? String(row.quote_accept_due_at) : '',
      quote_accepted_at: row.quote_accepted_at ? String(row.quote_accepted_at) : '',
      quote_due_at: row.quote_due_at ? String(row.quote_due_at) : '',
      quote_sent_back_at: row.quote_sent_back_at ? String(row.quote_sent_back_at) : '',
      quote_change_note: String(row.quote_change_note ?? ''),
      quote_approved_at: row.quote_approved_at ? String(row.quote_approved_at) : '',
      quote_ceo_escalated_at: row.quote_ceo_escalated_at ? String(row.quote_ceo_escalated_at) : '',
      quote_late_events: readQuoteLateEvents(row.quote_late_events),
      quote_assignee_staff_id:
        row.quote_assignee_staff_id != null && Number(row.quote_assignee_staff_id) > 0
          ? Number(row.quote_assignee_staff_id)
          : null,
      quote_reassign_note: String(row.quote_reassign_note ?? ''),
      implementation_status: String(row.implementation_status ?? ''),
      contract_created_at: row.contract_created_at ? String(row.contract_created_at) : '',
      contract_signed_at: row.contract_signed_at ? String(row.contract_signed_at) : '',
      contract_amount_vnd: Number(row.contract_amount_vnd) || 0,
    };
  }

  private ensureQuoteCaseColumns(): Promise<void> {
    if (!this.quoteCaseReady) {
      this.quoteCaseReady = this.db
        .query(
          `ALTER TABLE crm_lead_presales
             ADD COLUMN IF NOT EXISTS solution_approved_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_offered_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_accept_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_accepted_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_sent_back_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_change_note TEXT,
             ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_ceo_escalated_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS quote_late_events JSONB NOT NULL DEFAULT '[]'::jsonb,
             ADD COLUMN IF NOT EXISTS quote_assignee_staff_id BIGINT,
             ADD COLUMN IF NOT EXISTS quote_reassign_note TEXT,
             ADD COLUMN IF NOT EXISTS quote_sheet JSONB,
             ADD COLUMN IF NOT EXISTS implementation_status TEXT,
             ADD COLUMN IF NOT EXISTS solution_accept_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS solution_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS solution_customer_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS solution_revision_note TEXT,
             ADD COLUMN IF NOT EXISTS solution_revision_due_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS contract_created_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS contract_amount_vnd BIGINT NOT NULL DEFAULT 0`,
        )
        .then(() => undefined)
        .catch((err) => {
          this.quoteCaseReady = null;
          throw err;
        });
    }
    return this.quoteCaseReady;
  }

  private async noteLeadStep(leadId: number, staffId: number, status: string, note: string): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
       ) VALUES ($1, 'system', $2, '', '', NOW(), $3, $4)`,
      [leadId, note, `staff:${staffId}`.slice(0, 120), status],
    );
  }

  private async setLeadStatus(leadId: number, status: string, staffId: number, note: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_leads
       SET status = $2, updated_at = NOW(), updated_by = $3
       WHERE sqlite_lead_id = $1`,
      [leadId, status, `staff:${staffId}`.slice(0, 120)],
    );
    await this.noteLeadStep(leadId, staffId, status, note);
  }

  private async staffNameById(staffId: number | null): Promise<string> {
    if (staffId == null || staffId <= 0) return '';
    const result = await this.db.query(`SELECT name FROM crm_staff WHERE id = $1 LIMIT 1`, [staffId]);
    return String(result.rows[0]?.name ?? '').trim();
  }

  async buildHandoffView(ps: PresalesRow): Promise<PresalesHandoffView> {
    return {
      status: ps.handoff_status,
      handed_off_at: ps.handed_off_at,
      handed_off_by_staff_id: ps.handed_off_by_staff_id,
      solution_owner_staff_id: ps.solution_owner_staff_id,
      solution_owner_name: await this.staffNameById(ps.solution_owner_staff_id),
      solution_claimed_at: ps.solution_claimed_at,
      solution_released_at: ps.solution_released_at,
    };
  }

  async fetchLeadRow(leadId: number): Promise<LeadFunnelRow | null> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.source, l.owner_id,
              COALESCE(l.agency_client_id::text, '') AS client_id,
              COALESCE(l.channel, '') AS channel,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              COALESCE(l.first_assigned_at::text, (
                SELECT al.created_at::text FROM crm_lead_assignment_log al
                WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
                ORDER BY al.created_at ASC LIMIT 1
              ), '') AS first_assigned_at
       FROM crm_leads l
       WHERE l.sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] as LeadFunnelRow | undefined;
    return row ?? null;
  }

  private async hasSpokenCall(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
        WHERE lead_id = $1 AND activity_type = 'call'
          AND lower(trim(COALESCE(result, ''))) = ANY($2::text[])
        LIMIT 1`,
      [leadId, ['answered', 'connected_meet_pending', 'connected_qualified', 'connected_other']],
    );
    return (result.rowCount ?? result.rows.length) > 0;
  }

  private async releaseSpokenFromReview(actor: string): Promise<number> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id,
              NULLIF(l.meta_json->'review_queue'->>'previous_owner_id', '') AS previous_owner_id
         FROM crm_leads l
        WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
          AND (
            lower(trim(COALESCE(l.last_call_result, ''))) = ANY($1::text[])
            OR EXISTS (
              SELECT 1 FROM crm_lead_activities a
               WHERE a.lead_id = l.sqlite_lead_id
                 AND a.activity_type = 'call'
                 AND lower(trim(COALESCE(a.result, ''))) = ANY($1::text[])
            )
          )`,
      [['answered', 'connected_meet_pending', 'connected_qualified', 'connected_other']],
    );
    let released = 0;
    for (const row of result.rows as Array<{ id: number; previous_owner_id: string | null }>) {
      const previous = Number(row.previous_owner_id);
      const owner = Number.isFinite(previous) && previous > 0 ? previous : null;
      await this.db.query(
        `UPDATE crm_leads
            SET owner_id = COALESCE($2::bigint, owner_id),
                meta_json = COALESCE(meta_json, '{}'::jsonb) - 'review_queue',
                updated_at = NOW(),
                updated_by = $3
          WHERE sqlite_lead_id = $1`,
        [row.id, owner, actor.slice(0, 120)],
      );
      if (owner) {
        await this.db.query(
          `INSERT INTO crm_lead_assignment_log
             (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
           VALUES ($1, NULL, $2, $3, $4, NOW())`,
          [row.id, owner, 'Đã nói chuyện — đưa khỏi Phải tra soát', actor.slice(0, 120)],
        );
      }
      released += 1;
    }
    return released;
  }

  async hasB2ContactOkReport(leadId: number, stageKey = 'first_contact'): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $3
       LIMIT 1`,
      [leadId, stageKey, CONTACT_OK_CARE_STATUS],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async fetchB2CareAttemptStats(leadId: number): Promise<{
    negative_count: number;
    last_status: string | null;
  }> {
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact' AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) != ''
         AND trim(care_status) != $2`,
      [leadId, CONTACT_OK_CARE_STATUS],
    );
    const lastResult = await this.db.query(
      `SELECT trim(care_status) AS care_status FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact' AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) != ''
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId],
    );
    const lastStatus = String(lastResult.rows[0]?.care_status ?? '').trim() || null;
    return {
      negative_count: Number(countResult.rows[0]?.c ?? 0),
      last_status: lastStatus,
    };
  }

  async buildSnapshot(leadId: number, presalesEnabled: boolean): Promise<LeadFunnelSnapshot | null> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return null;
    const meta = parseLeadMeta(row.meta_json);
    const presales = presalesEnabled ? await this.getPresalesSnapshot(leadId) : null;
    const leadFlowKind = resolveLeadFlowKindFromFunnelRow(row, Boolean(presales));
    const care = carePipelineState(row.status, row.care_stage_current, row.care_stages_done_json);
    const contactOkReported = care.all_complete || (await this.hasB2ContactOkReport(leadId));
    const attemptStats = await this.fetchB2CareAttemptStats(leadId);
    return {
      lead_id: leadId,
      lead_flow_kind: leadFlowKind,
      care_pipeline: {
        ...care,
        contact_ok_reported: contactOkReported,
        b2_negative_report_count: attemptStats.negative_count,
        last_b2_care_status: attemptStats.last_status ?? undefined,
        last_b2_care_status_label: attemptStats.last_status
          ? careStatusLabel(attemptStats.last_status)
          : undefined,
      },
      presales_care_gate: presalesCareGateState(row.care_stage_current, row.care_stages_done_json),
      review_queue: reviewQueuePublicState(meta, row.first_assigned_at || row.updated_at || ''),
      presales_on_lead_enabled: presalesEnabled,
      presales,
    };
  }

  async isLeadInReviewQueue(leadId: number): Promise<boolean> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return false;
    return isLeadInReviewQueue(parseLeadMeta(row.meta_json));
  }

  async listReviewQueueLeadIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE`,
    );
    return result.rows.map((r) => Number((r as { id: string | number }).id));
  }

  async assertNotInReviewQueue(leadId: number): Promise<void> {
    if (await this.isLeadInReviewQueue(leadId)) {
      throw new Error('Lead đang ở danh mục Phải tra soát — chỉ GDKD được xử lý.');
    }
  }

  async fetchLeadConfig(): Promise<{ b2_review_queue_enabled: boolean; b2_contact_deadline_hours: number }> {
    const result = await this.db.query(
      `SELECT config_json FROM crm_lead_settings WHERE config_key = 'global' LIMIT 1`,
    );
    const row = result.rows[0] as { config_json: Record<string, unknown> } | undefined;
    const cfg = row?.config_json ?? {};
    return {
      b2_review_queue_enabled: cfg.b2_review_queue_enabled !== false,
      b2_contact_deadline_hours: normalizeB2ContactDeadlineHours(
        cfg.b2_contact_deadline_hours ?? DEFAULT_B2_CONTACT_DEADLINE_HOURS,
      ),
    };
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ): Promise<void> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const stageKey = String(body.stage || 'first_contact').trim();
    if (!CARE_STAGE_KEYS.includes(stageKey)) {
      throw new Error('Bước chăm sóc không hợp lệ.');
    }
    const careStatus = normalizeCareReportStatus(body.care_status);
    if (!careStatus) {
      throw new Error('Trạng thái chăm sóc không hợp lệ.');
    }
    const contactType = normalizeCareContactType(body.care_contact_type);
    const safeUserId = sanitizePgBigintUserId(userId);
    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, user_id, activity_type, content, result,
         next_action, next_action_at, created_at, created_by,
         lead_status_at_log, care_status, care_stage_key, care_contact_type
       ) VALUES ($1, $2, 'call', $3, '', '', NULL, NOW(), $4, $5, $6, $7, $8)`,
      [
        leadId,
        safeUserId,
        String(body.content || 'Báo cáo chăm sóc B2').slice(0, 8000),
        actor.slice(0, 120),
        row.status,
        careStatus,
        stageKey,
        contactType.slice(0, 80),
      ],
    );
    await this.db.query(
      `UPDATE crm_leads SET updated_at = NOW(), updated_by = $2 WHERE sqlite_lead_id = $1`,
      [leadId, actor.slice(0, 120)],
    );
  }

  async completeCareStage(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
  ): Promise<LeadFunnelRow> {
    await this.assertNotInReviewQueue(leadId);
    const row = await this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const key = String(body.stage || 'first_contact').trim();
    if (!CARE_STAGE_KEYS.includes(key)) throw new Error('Bước chăm sóc không hợp lệ.');
    let current = String(row.care_stage_current || '').trim();
    if (!CARE_STAGE_KEYS.includes(current)) current = 'first_contact';
    if (key !== current) throw new Error('Chỉ có thể hoàn thành bước đang thực hiện.');

    const reportCount = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND (trim(COALESCE(care_status, '')) != '' OR trim(COALESCE(care_contact_type, '')) != '')`,
      [leadId, key],
    );
    if (Number(reportCount.rows[0]?.c ?? 0) < 1) {
      throw new Error('Phải gửi ít nhất một báo cáo chăm sóc cho bước này trước khi hoàn thành.');
    }

    const okRow = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $3
       LIMIT 1`,
      [leadId, key, CONTACT_OK_CARE_STATUS],
    );
    if (!okRow.rows[0]) {
      throw new Error(
        'Phải có báo cáo trạng thái 「Liên hệ OK» (da_lien_he_thanh_cong) trước khi hoàn thành B2.',
      );
    }

    const noteClean = String(body.note || '').trim();
    if (noteClean.length < CARE_STAGE_MIN_COMPLETION_NOTE_LEN) {
      throw new Error(
        `Ghi chú hoàn thành bước là bắt buộc (tối thiểu ${CARE_STAGE_MIN_COMPLETION_NOTE_LEN} ký tự).`,
      );
    }

    const done = JSON.parse(row.care_stages_done_json || '{}') as Record<string, string>;
    done[key] = this.ts();
    const stageMeta = CARE_PIPELINE_STAGES.find((s) => s.key === key)!;

    await this.db.query(
      `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by, lead_status_at_log)
       VALUES ($1, 'system', $2, NOW(), $3, $4)`,
      [
        leadId,
        `Hoàn thành bước: ${stageMeta.label}. Ghi chú: ${noteClean}`.slice(0, 8000),
        actor.slice(0, 120),
        row.status,
      ],
    );
    await this.db.query(
      `UPDATE crm_leads
       SET care_stage_current = $2,
           care_stages_done_json = $3::jsonb,
           status = $4,
           updated_at = NOW(),
           updated_by = $5
       WHERE sqlite_lead_id = $1`,
      [leadId, key, serializeStagesDone(done), stageMeta.status_on_complete, actor.slice(0, 120)],
    );

    const updated = await this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');

    if (key === 'first_contact') {
      const pipeline = carePipelineState(
        updated.status,
        updated.care_stage_current,
        updated.care_stages_done_json,
      );
      if (pipeline.all_complete) {
        await recordLifecycleMilestone(this.db, {
          leadId,
          key: 'b2_done',
          occurredAt: done[key] ?? new Date(),
          source: 'care_pipeline',
        });
      }
    }

    return updated;
  }

  async countReviewQueue(b2bListScope?: B2bListScope): Promise<number> {
    const scopeParts = this.reviewQueueB2bScopeSql(b2bListScope, 1);
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE${scopeParts.sql}`,
      scopeParts.params,
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  private reviewQueueB2bScopeSql(
    b2bListScope: B2bListScope | undefined,
    paramStart: number,
  ): { sql: string; params: unknown[] } {
    if (!b2bListScope) return { sql: '', params: [] };
    const staffParam = `$${paramStart}`;
    const clause = buildB2bListScopeClause('postgres', 'l', b2bListScope, staffParam);
    if (!clause) return { sql: '', params: [] };
    return { sql: ` AND ${clause}`, params: [b2bListScope.staffId] };
  }

  async listReviewQueue(limit = 50, b2bListScope?: B2bListScope): Promise<LeadFunnelRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const scopeParts = this.reviewQueueB2bScopeSql(b2bListScope, 2);
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.owner_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              COALESCE(l.meta_json->'review_queue'->>'assigned_at', '') AS first_assigned_at
       FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE${scopeParts.sql}
       ORDER BY l.meta_json->'review_queue'->>'queued_at' DESC NULLS LAST, l.sqlite_lead_id DESC
       LIMIT $1`,
      [lim, ...scopeParts.params],
    );
    return result.rows as LeadFunnelRow[];
  }

  async listReviewAssignees(): Promise<Array<{ id: number; name: string }>> {
    const result = await this.db.query(
      `SELECT s.id, COALESCE(s.name, '') AS name
       FROM crm_staff s
       WHERE ${ELIGIBLE_LEAD_OWNER_SQL}
       ORDER BY lower(s.name)`,
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
    }));
  }

  async syncReviewQueue(actor: string, dryRun = false, now = new Date()): Promise<Record<string, unknown>> {
    const cfg = await this.fetchLeadConfig();
    if (!cfg.b2_review_queue_enabled) {
      return { enabled: false, queued: 0, scanned: 0, deadline_hours: cfg.b2_contact_deadline_hours };
    }

    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.owner_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              ${reviewQueueAssignmentClockSql('l')} AS first_assigned_at,
              COALESCE(l.last_call_result, '') AS last_call_result,
              l.hold_until::text AS hold_until,
              l.callback_at::text AS callback_at,
              l.last_call_at::text AS last_call_at,
              COALESCE(l.attempts_since_assign, 0) AS attempts_since_assign,
              COALESCE(l.reassign_count, 0) AS reassign_count,
              COALESCE(l.is_hot, FALSE) AS is_hot
       FROM crm_leads l
       WHERE l.owner_id IS NOT NULL
         AND l.is_duplicate IS NOT TRUE
         AND l.status NOT IN ('lost')
         AND COALESCE(l.meta_json->'review_queue'->>'active', '') != 'true'
         AND COALESCE(l.care_stages_done_json->>'first_contact', '') = ''`,
    );
    const rows = result.rows as HoldScanRow[];
    const releasedSpoken = dryRun ? 0 : await this.releaseSpokenFromReview(actor);

    let queued = 0;
    let held = 0;
    const leadIds: number[] = [];
    for (const row of rows) {
      const gate = presalesCareGateState(row.care_stage_current, row.care_stages_done_json);
      if (gate.complete) continue;
      if (await this.hasB2ContactOkReport(row.id)) continue;
      if (isSpokenCallResult(row.last_call_result) || (await this.hasSpokenCall(row.id))) continue;
      const hold = this.preB2FromRow(row, now);
      if (hold.kind && (hold.insideHold || hold.expiry !== 'none')) {
        if (hold.insideHold) held += 1;
        continue;
      }
      const assignedAt = row.first_assigned_at || row.updated_at || '';
      const assignedDt = new Date(String(assignedAt).slice(0, 19).replace(' ', 'T') + 'Z');
      if (Number.isNaN(assignedDt.getTime())) continue;
      const elapsedH = (now.getTime() - assignedDt.getTime()) / 3600000;
      if (elapsedH < cfg.b2_contact_deadline_hours) continue;
      leadIds.push(row.id);
      if (dryRun) {
        queued += 1;
        continue;
      }
      await this.queueLeadForReview(row.id, {
        actor,
        previousOwnerId: row.owner_id,
        assignedAt,
        deadlineHours: cfg.b2_contact_deadline_hours,
      });
      queued += 1;
    }

    const expired = dryRun
      ? { nudged: 0, reassigned: 0, failed: 0, queued: 0 }
      : await this.applyExpiredHolds(actor, now, cfg.b2_contact_deadline_hours);

    return {
      enabled: true,
      dry_run: dryRun,
      queued: queued + expired.queued,
      scanned: rows.length,
      deadline_hours: cfg.b2_contact_deadline_hours,
      lead_ids: leadIds,
      held,
      released_spoken: releasedSpoken,
      nudged: expired.nudged,
      reassigned: expired.reassigned,
      failed: expired.failed,
    };
  }

  private preB2FromRow(row: HoldScanRow, now: Date): PreB2HoldState {
    const assignedRaw = row.first_assigned_at || row.updated_at || '';
    const assignedAt = new Date(String(assignedRaw).slice(0, 19).replace(' ', 'T') + 'Z');
    const callbackAt = row.callback_at ? new Date(String(row.callback_at)) : null;
    const lastCallAt = row.last_call_at ? new Date(String(row.last_call_at)) : null;
    return preB2HoldState({
      lastCallResult: row.last_call_result,
      assignedAt: Number.isNaN(assignedAt.getTime()) ? now : assignedAt,
      callbackAt: callbackAt && !Number.isNaN(callbackAt.getTime()) ? callbackAt : null,
      lastCallAt: lastCallAt && !Number.isNaN(lastCallAt.getTime()) ? lastCallAt : null,
      attemptsSinceAssign: Number(row.attempts_since_assign) || 0,
      reassignCount: Number(row.reassign_count) || 0,
      isHot: Boolean(row.is_hot),
      now,
    });
  }

  private async applyExpiredHolds(
    actor: string,
    now: Date,
    deadlineHours: number,
  ): Promise<{ nudged: number; reassigned: number; failed: number; queued: number }> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.owner_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              ${reviewQueueAssignmentClockSql('l')} AS first_assigned_at,
              COALESCE(l.last_call_result, '') AS last_call_result,
              l.hold_until::text AS hold_until,
              l.callback_at::text AS callback_at,
              l.last_call_at::text AS last_call_at,
              COALESCE(l.attempts_since_assign, 0) AS attempts_since_assign,
              COALESCE(l.reassign_count, 0) AS reassign_count,
              COALESCE(l.is_hot, FALSE) AS is_hot
         FROM crm_leads l
        WHERE l.owner_id IS NOT NULL
          AND l.is_duplicate IS NOT TRUE
          AND l.status NOT IN ('lost')
          AND COALESCE(l.meta_json->'review_queue'->>'active', '') != 'true'
          AND COALESCE(l.care_stages_done_json->>'first_contact', '') = ''
          AND l.hold_until IS NOT NULL
          AND l.hold_until <= $1::timestamptz`,
      [now.toISOString()],
    );
    let nudged = 0;
    let reassigned = 0;
    let failed = 0;
    let queued = 0;
    for (const row of result.rows as HoldScanRow[]) {
      if (await this.hasB2ContactOkReport(row.id)) continue;
      const hold = this.preB2FromRow(row, now);
      if (hold.insideHold || hold.expiry === 'none') continue;
      if (hold.expiry === 'nudge') {
        await this.db.query(
          `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by)
           SELECT $1, 'note', $2, NOW(), 'pre-b2-hold'
            WHERE NOT EXISTS (
              SELECT 1 FROM crm_lead_activities
               WHERE lead_id = $1 AND content = $2 AND created_at > NOW() - interval '1 day'
            )`,
          [row.id, 'Nhắc người phụ trách: chưa đủ số lần gọi, lead vẫn ở lại.'],
        );
        nudged += 1;
        continue;
      }
      if (hold.expiry === 'fail') {
        await this.db.query(
          `UPDATE crm_leads
              SET status = 'lost',
                  meta_json = COALESCE(meta_json, '{}'::jsonb) || jsonb_build_object('lost_reason', 'unreachable'),
                  hold_until = NULL,
                  updated_at = NOW()
            WHERE sqlite_lead_id = $1`,
          [row.id],
        );
        await this.db.query(
          `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by)
           VALUES ($1, 'note', $2, NOW(), 'pre-b2-hold')`,
          [row.id, 'Hết hạn máy bận, đóng thất bại vì không liên lạc được.'],
        );
        failed += 1;
        continue;
      }
      if (hold.expiry === 'reassign') {
        const next = await this.db.query(
          `SELECT s.id FROM crm_staff s WHERE ${ELIGIBLE_LEAD_OWNER_SQL} AND s.id <> $1 ORDER BY s.id`,
          [Number(row.owner_id) || 0],
        );
        const nextId = Number(next.rows[0]?.id) || 0;
        if (nextId > 0) {
          await this.db.query(
            `UPDATE crm_leads
                SET owner_id = $2,
                    assigned_at = NOW(),
                    attempts_since_assign = 0,
                    hold_until = NULL,
                    hold_reason = '',
                    reassign_count = COALESCE(reassign_count, 0) + 1,
                    updated_at = NOW()
              WHERE sqlite_lead_id = $1`,
            [row.id, nextId],
          );
          await this.db.query(
            `INSERT INTO crm_lead_assignment_log
               (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
             VALUES ($1, $2, $3, 'pre_b2_hold_expired', $4, NOW())`,
            [row.id, row.owner_id, nextId, actor.slice(0, 120)],
          );
          reassigned += 1;
          continue;
        }
      }
      await this.queueLeadForReview(row.id, {
        actor,
        previousOwnerId: row.owner_id,
        assignedAt: row.first_assigned_at || row.updated_at || '',
        deadlineHours,
      });
      queued += 1;
    }
    return { nudged, reassigned, failed, queued };
  }

  private async queueLeadForReview(
    leadId: number,
    opts: {
      actor: string;
      previousOwnerId: number | null;
      assignedAt: string;
      deadlineHours: number;
    },
  ): Promise<void> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return;
    const meta = parseLeadMeta(row.meta_json);
    if (isLeadInReviewQueue(meta)) return;
    const ts = this.ts();
    meta.review_queue = {
      active: true,
      reason: REVIEW_QUEUE_REASON,
      queued_at: ts,
      previous_owner_id: opts.previousOwnerId,
      assigned_at: opts.assignedAt,
      deadline_hours: opts.deadlineHours,
    };
    await this.db.query(
      `UPDATE crm_leads
       SET owner_id = NULL, meta_json = $2::jsonb, updated_at = NOW(), updated_by = $3
       WHERE sqlite_lead_id = $1`,
      [leadId, JSON.stringify(meta), opts.actor.slice(0, 120)],
    );
    if (opts.previousOwnerId) {
      await this.db.query(
        `INSERT INTO crm_lead_assignment_log
           (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
         VALUES ($1, $2, NULL, $3, $4, NOW())`,
        [
          leadId,
          opts.previousOwnerId,
          'Quá hạn B2 — chuyển Lead Phải tra soát (GDKD)',
          opts.actor.slice(0, 120),
        ],
      );
    }
  }

  async releaseFromReviewQueue(
    leadId: number,
    body: ReleaseReviewQueueBody,
    actor: string,
  ): Promise<{ row: LeadFunnelRow; targetOwner: number; fromOwnerId: number | null }> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const fromOwnerId = row.owner_id != null ? Number(row.owner_id) : null;
    const meta = parseLeadMeta(row.meta_json);
    const rq = meta.review_queue as Record<string, unknown> | undefined;
    if (!rq?.active) throw new Error('Lead không ở danh mục Phải tra soát.');
    const mode = String(body.mode || '').trim().toLowerCase();
    if (mode !== 'auto' && mode !== 'manual') throw new Error('mode phải là auto hoặc manual.');

    let targetOwner: number | null = null;
    if (mode === 'manual') {
      if (!body.owner_id) throw new Error('Chọn AM để gán lại.');
      await assertEligibleLeadOwner((sql, params) => this.db.query(sql, params), Number(body.owner_id));
      targetOwner = Number(body.owner_id);
    } else {
      const prev = rq.previous_owner_id ? Number(rq.previous_owner_id) : null;
      if (prev) {
        try {
          await assertEligibleLeadOwner((sql, params) => this.db.query(sql, params), prev);
          targetOwner = prev;
        } catch {
          targetOwner = null;
        }
      }
      if (!targetOwner) throw new Error('Không tìm được AM để gán lại (auto).');
    }

    delete meta.review_queue;
    await this.db.query(
      `UPDATE crm_leads
       SET owner_id = $2,
           assigned_at = NOW(),
           meta_json = $3::jsonb,
           updated_at = NOW(),
           updated_by = $4
       WHERE sqlite_lead_id = $1`,
      [leadId, targetOwner, JSON.stringify(meta), actor.slice(0, 120)],
    );
    await this.db.query(
      `INSERT INTO crm_lead_assignment_log
         (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
       VALUES ($1, NULL, $2, $3, $4, NOW())`,
      [
        leadId,
        targetOwner,
        String(body.note || 'GDKD release từ Phải tra soát').slice(0, 500),
        actor.slice(0, 120),
      ],
    );

    const updated = await this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');
    return { row: updated, targetOwner, fromOwnerId };
  }

  async getPresalesRowByLeadId(leadId: number): Promise<PresalesRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
    const row = result.rows[0] as PgPresalesRow | undefined;
    return row ? this.mapPresalesRow(row) : null;
  }

  async getPresalesSnapshot(leadId: number): Promise<PresalesSnapshot | null> {
    await this.ensureQuoteCaseColumns();
    const psResult = await this.db.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
    const psRow = psResult.rows[0] as PgPresalesRow | undefined;
    if (!psRow) return null;
    const ps = this.mapPresalesRow(psRow);

    const taskResult = await this.db.query(
      `SELECT * FROM crm_lead_presales_tasks
       WHERE presales_id = $1
       ORDER BY stage, step_index, id`,
      [ps.id],
    );
    const tasks: Record<string, PresalesTaskRow[]> = {};
    for (const raw of taskResult.rows as Array<Record<string, unknown>>) {
      const stage = String(raw.stage);
      const task: PresalesTaskRow = {
        id: Number(raw.id),
        presales_id: Number(raw.presales_id),
        stage,
        step_index: Number(raw.step_index),
        title: String(raw.title),
        description: String(raw.description),
        form_fields: Array.isArray(raw.form_fields)
          ? (raw.form_fields as unknown[])
          : (JSON.parse(String(raw.form_fields ?? '[]')) as unknown[]),
        form_data:
          typeof raw.form_data === 'object' && raw.form_data !== null
            ? (raw.form_data as Record<string, unknown>)
            : (JSON.parse(String(raw.form_data ?? '{}')) as Record<string, unknown>),
        ai_prompt_key: String(raw.ai_prompt_key ?? ''),
        ai_output: String(raw.ai_output ?? ''),
        is_done: Boolean(raw.is_done),
        done_at: raw.done_at ? String(raw.done_at) : '',
        notes: String(raw.notes ?? ''),
      };
      (tasks[stage] ||= []).push(task);
    }

    const progress: Record<string, { total: number; done: number }> = {};
    for (const stage of PRESALES_STAGES) {
      const list = tasks[stage] || [];
      progress[stage] = {
        total: list.length,
        done: list.filter((t) => t.is_done).length,
      };
    }

    const current = String(ps.stage || 'lead');
    const currentIdx = PRESALES_STAGES.indexOf(current as (typeof PRESALES_STAGES)[number]);
    const nextStage =
      currentIdx >= 0 && currentIdx < PRESALES_STAGES.length - 1
        ? PRESALES_STAGES[currentIdx + 1]
        : null;
    const curProg = progress[current] || { total: 0, done: 0 };
    const currentComplete = curProg.total === 0 || curProg.done >= curProg.total;
    let blockReason = '';
    let canAdvance = false;

    if (ps.status !== 'active') {
      blockReason = 'Pre-sales đã đóng hoặc đã chuyển lifecycle.';
    } else if (!nextStage) {
      blockReason = 'Đã ở giai đoạn Proposal — chờ ký HĐ để tạo Lifecycle.';
    } else if (!currentComplete) {
      blockReason = 'Hoàn thành tất cả task giai đoạn hiện tại trước khi chuyển bước.';
    } else if (nextStage === 'consult' && current === 'lead') {
      const gate = await this.buildConsultAdvanceGate(leadId, ps.id);
      if (!gate.ok || gate.requires_confirm) {
        blockReason = gate.messages[0] || 'Chưa đủ điều kiện chuyển Tư vấn';
      } else {
        canAdvance = true;
      }
    } else if (nextStage === 'proposal' && current === 'consult') {
      if (blocksDirectProposalAdvance(ps.handoff_status)) {
        blockReason =
          'Lead đang Solution/MKT — dùng Trả Sales (release) hoặc chờ Solution hoàn tất Consult + R5.';
      } else {
        const plan = await this.getPreliminaryPlan(ps.id);
        const val = validatePreliminaryPlan(plan);
        if (!val.ok) blockReason = val.messages[0] || 'KH MKT sơ bộ chưa đủ';
        else {
          blockReason = await this.clientPlanLeaveBlock(
            leadId,
            tasks.lead ?? [],
            tasks.consult ?? [],
            plan,
          );
          canAdvance = blockReason === '';
        }
      }
    } else {
      canAdvance = true;
    }

    await this.syncQuoteWithSolutionOwner(ps);
    const assigneeName = await this.quoteAssigneeName(ps.quote_assignee_staff_id);
    const now = new Date();
    let quoteCase = buildQuoteCaseView(
      {
        ...ps,
        quote_assignee_name: assigneeName,
      },
      now,
    );
    const desk = quoteCase ? quoteDeskForPhase(quoteCase.phase) : null;
    if (quoteCase && desk) {
      const people = await this.staffForDesk(desk);
      const currentId =
        desk === 'marketing_leader' ? quoteCase.assignee_staff_id : await this.leadOwnerId(ps.lead_id);
      quoteCase = {
        ...quoteCase,
        transfer_candidates: people
          .filter((person) => person.id !== currentId)
          .map((person) => ({ id: person.id, name: person.name, title: person.title })),
      };
    }
    const handoff = await this.buildHandoffView(ps);
    const solutionCase = buildSolutionCaseView(
      {
        ...ps,
        solution_owner_name: handoff.solution_owner_name,
      },
      now,
    );

    return {
      presales: ps,
      handoff,
      solution_case: solutionCase,
      quote_case: quoteCase,
      l2_docs: buildPresalesL2DocsView(ps.service_slug, ps.l2_docs_json),
      consult_proposal_sla: buildPresalesConsultProposalSla({
        presalesStage: ps.stage,
        consultEnteredAt: ps.consult_entered_at,
        stageEnteredAt: ps.stage_entered_at,
      }),
      tasks,
      progress,
      advance: {
        current_stage: current,
        next_stage: nextStage,
        can_advance_forward: canAdvance,
        block_reason: blockReason,
        current_complete: currentComplete,
        current_done: curProg.done,
        current_total: curProg.total,
        status: ps.status,
      },
    };
  }

  async buildConsultAdvanceGate(leadId: number, presalesId: number) {
    const sessionResult = await this.db.query(
      `SELECT status, mode, decision, bant_total, answers_json
       FROM crm_lead_intake_sessions
       WHERE lead_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT 20`,
      [leadId],
    );
    const sessions = sessionResult.rows as Array<{
      status: string;
      mode: string;
      decision: string;
      bant_total: number;
      answers_json?: Record<string, unknown>;
    }>;
    const taskResult = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
       FROM crm_lead_presales_tasks
       WHERE presales_id = $1 AND stage = 'lead'`,
      [presalesId],
    );
    let leadTasks = taskResult.rows[0] as { total: number; done: number | null };
    let leadTaskDone =
      Number(leadTasks.total) === 0 || Number(leadTasks.done ?? 0) >= Number(leadTasks.total);

    if (!leadTaskDone) {
      await repairPresalesLeadTasksFromLatestGoIntake(this.db, leadId);
      const retry = await this.db.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
         FROM crm_lead_presales_tasks
         WHERE presales_id = $1 AND stage = 'lead'`,
        [presalesId],
      );
      leadTasks = retry.rows[0] as { total: number; done: number | null };
      leadTaskDone =
        Number(leadTasks.total) === 0 || Number(leadTasks.done ?? 0) >= Number(leadTasks.total);
    }

    return validatePresalesConsultAdvance({ leadTaskDone, sessions });
  }

  async ensurePresales(leadId: number, serviceSlug: string, actor: string): Promise<PresalesRow> {
    const row = (await this.fetchLeadRow(leadId)) ?? null;
    if (!row) throw new Error('Không tìm thấy lead.');
    assertPresalesCareGate(row.care_stage_current, row.care_stages_done_json);
    const slug = String(serviceSlug || '').trim();
    if (!slug) throw new Error('Cần service_slug để tạo pre-sales');

    const existing = await this.getPresalesRowByLeadId(leadId);
    if (existing) {
      if (existing.status === 'converted') return existing;
      await this.seedPresalesTasks(existing.id, slug);
      return existing;
    }

    const ownerId = row.owner_id;
    const insert = await this.db.query(
      `INSERT INTO crm_lead_presales
         (lead_id, service_slug, stage, status, assigned_am, stage_entered_at, notes, created_at, updated_at)
       VALUES ($1, $2, 'lead', 'active', $3, NOW(), $4, NOW(), NOW())
       RETURNING *`,
      [leadId, slug, ownerId, `Pre-sales tạo bởi ${actor}`.slice(0, 4000)],
    );
    const ps = this.mapPresalesRow(insert.rows[0] as PgPresalesRow);
    await this.seedPresalesTasks(ps.id, slug);
    return ps;
  }

  private async seedPresalesTasks(presalesId: number, serviceSlug: string): Promise<void> {
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_presales_tasks WHERE presales_id = $1 AND is_custom = FALSE`,
      [presalesId],
    );
    if (Number(countResult.rows[0]?.c ?? 0) > 0) return;

    const steps = workflowStepsForService(serviceSlug);
    for (const stage of PRESALES_STAGES) {
      const stageSteps = steps[stage] || [];
      for (let idx = 0; idx < stageSteps.length; idx += 1) {
        const step = stageSteps[idx];
        await this.db.query(
          `INSERT INTO crm_lead_presales_tasks
             (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
              is_done, is_custom, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, '{}'::jsonb, FALSE, FALSE, NOW(), NOW())`,
          [
            presalesId,
            stage,
            idx,
            step.title,
            step.description,
            step.ai_prompt_key || '',
            JSON.stringify(step.form_fields || []),
          ],
        );
      }
    }
  }

  async getLeadConvertedCustomerId(leadId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT converted_customer_id FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const raw = result.rows[0] as { converted_customer_id: number | null } | undefined;
    const id = Number(raw?.converted_customer_id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async getPresalesTaskById(taskId: number): Promise<PresalesTaskRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_lead_presales_tasks WHERE id = $1 LIMIT 1`, [
      taskId,
    ]);
    const raw = result.rows[0] as Record<string, unknown> | undefined;
    if (!raw) return null;
    return {
      id: Number(raw.id),
      presales_id: Number(raw.presales_id),
      stage: String(raw.stage),
      step_index: Number(raw.step_index),
      title: String(raw.title),
      description: String(raw.description),
      form_fields: Array.isArray(raw.form_fields)
        ? (raw.form_fields as unknown[])
        : (JSON.parse(String(raw.form_fields ?? '[]')) as unknown[]),
      form_data:
        typeof raw.form_data === 'object' && raw.form_data !== null
          ? (raw.form_data as Record<string, unknown>)
          : (JSON.parse(String(raw.form_data ?? '{}')) as Record<string, unknown>),
      ai_prompt_key: String(raw.ai_prompt_key ?? ''),
      ai_output: String(raw.ai_output ?? ''),
      is_done: Boolean(raw.is_done),
      done_at: raw.done_at ? String(raw.done_at) : '',
      notes: String(raw.notes ?? ''),
    };
  }

  async updatePresalesTaskAiOutput(taskId: number, aiOutput: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_lead_presales_tasks SET ai_output = $2, updated_at = NOW() WHERE id = $1`,
      [taskId, aiOutput.slice(0, 16000)],
    );
  }

  async runPresalesConsultPrefill(
    leadId: number,
    overwrite = false,
  ): Promise<{ task_id: number | null; filled: number; fields: string[]; skipped_existing: string[] }> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const consultTasks = snap.tasks.consult ?? [];
    const leadTasks = snap.tasks.lead ?? [];
    if (consultTasks.length === 0) throw new Error('Chưa có task Consult');

    const intakeResult = await this.db.query(
      `SELECT * FROM crm_lead_intake_sessions WHERE lead_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
      [leadId],
    );
    const sessions = intakeResult.rows as IntakeSessionRow[];
    const latest = pickLatestCompletedIntake(sessions);
    const out = prefillPresalesConsultTaskForm({
      serviceSlug: snap.presales.service_slug,
      consultTask: consultTasks[0]!,
      leadTask: leadTasks[0] ?? null,
      latestIntake: latest,
      overwrite,
    });
    if (out.filled.length > 0 || out.notes !== consultTasks[0]!.notes) {
      await this.updatePresalesTask(
        consultTasks[0]!.id,
        { form_data: out.form_data, notes: out.notes },
        null,
      );
    }
    return {
      task_id: consultTasks[0]!.id,
      filled: out.filled.length,
      fields: out.filled,
      skipped_existing: out.skipped_existing,
    };
  }

  async listPresalesWorkflowUpgradeCohort(opts?: {
    leadIds?: number[];
    limit?: number;
  }): Promise<PresalesWorkflowUpgradeCohortRow[]> {
    const params: unknown[] = [PRESALES_UPGRADE_CONSULT_FIELD_MIN];
    let leadFilter = '';
    if (opts?.leadIds?.length) {
      const ids = capBatchLeadIds(opts.leadIds, opts.limit);
      params.push(ids);
      leadFilter = ` AND ps.lead_id = ANY($${params.length}::bigint[])`;
    }
    const rowLimit = opts?.leadIds?.length
      ? capBatchLeadIds(opts.leadIds, opts.limit).length
      : Math.min(PRESALES_BATCH_UPGRADE_MAX, opts?.limit ?? PRESALES_BATCH_UPGRADE_MAX);
    params.push(rowLimit);

    const result = await this.db.query(
      `SELECT ps.lead_id, ps.id AS presales_id, ps.service_slug, ps.stage,
              COALESCE(
                (
                  SELECT jsonb_agg(f->>'key' ORDER BY f->>'key')
                  FROM crm_lead_presales_tasks t,
                       jsonb_array_elements(COALESCE(t.form_fields, '[]'::jsonb)) f
                  WHERE t.presales_id = ps.id AND t.stage = 'consult' AND t.is_custom = FALSE
                ),
                '[]'::jsonb
              ) AS consult_field_keys
       FROM crm_lead_presales ps
       WHERE ps.status = 'active'
         AND ps.stage IN ('lead', 'consult', 'proposal')
         AND EXISTS (
           SELECT 1 FROM crm_lead_presales_tasks t
           WHERE t.presales_id = ps.id
             AND t.stage = 'consult'
             AND t.is_custom = FALSE
             AND jsonb_array_length(COALESCE(t.form_fields, '[]'::jsonb)) < $1
         )
         ${leadFilter}
       ORDER BY ps.updated_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      lead_id: Number(row.lead_id),
      presales_id: Number(row.presales_id),
      service_slug: String(row.service_slug ?? ''),
      stage: String(row.stage ?? ''),
      consult_field_keys: Array.isArray(row.consult_field_keys)
        ? (row.consult_field_keys as string[])
        : [],
    }));
  }

  async upgradePresalesWorkflowTemplate(
    leadId: number,
    opts: { stages?: string[]; dryRun?: boolean; prefillConsult?: boolean },
  ): Promise<{
    ok: boolean;
    dry_run: boolean;
    service_slug: string;
    stages: Array<{
      stage: string;
      deleted: number;
      inserted: number;
      preserved_done: boolean;
      mapped_fields: string[];
    }>;
    prefill?: { task_id: number | null; filled: number; fields: string[] };
  }> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.status !== 'active') throw new Error('Pre-sales không còn active');

    const stages = normalizeUpgradeStages(opts.stages);
    const slug = snap.presales.service_slug;
    const steps = workflowStepsForService(slug);
    const plan = buildPresalesWorkflowUpgradePlan(slug, stages, snap.tasks);
    const stageResults: Array<{
      stage: string;
      deleted: number;
      inserted: number;
      preserved_done: boolean;
      mapped_fields: string[];
    }> = [];

    if (!opts.dryRun) {
      for (const stage of stages) {
        const stageSteps = steps[stage] ?? [];
        const oldTasks = snap.tasks[stage] ?? [];
        const newKeys = stageSteps.flatMap((s) => (s.form_fields ?? []).map((f) => f.key));
        const { form_data, is_done } = mergeLegacyPresalesFormData(oldTasks, newKeys);

        const del = await this.db.query(
          `DELETE FROM crm_lead_presales_tasks
           WHERE presales_id = $1 AND stage = $2 AND is_custom = FALSE
           RETURNING id`,
          [snap.presales.id, stage],
        );
        let inserted = 0;
        for (let idx = 0; idx < stageSteps.length; idx += 1) {
          const step = stageSteps[idx]!;
          await this.db.query(
            `INSERT INTO crm_lead_presales_tasks
               (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
                is_done, is_custom, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, FALSE, NOW(), NOW())`,
            [
              snap.presales.id,
              stage,
              idx,
              step.title,
              step.description,
              step.ai_prompt_key || '',
              JSON.stringify(step.form_fields || []),
              JSON.stringify(form_data),
              is_done,
            ],
          );
          inserted += 1;
        }
        stageResults.push({
          stage,
          deleted: del.rowCount ?? oldTasks.length,
          inserted,
          preserved_done: is_done,
          mapped_fields: Object.keys(form_data),
        });
      }
    } else {
      stageResults.push(...plan.stages);
    }

    let prefill: { task_id: number | null; filled: number; fields: string[] } | undefined;
    if (!opts.dryRun && opts.prefillConsult !== false && stages.includes('consult')) {
      const pf = await this.runPresalesConsultPrefill(leadId, false);
      prefill = { task_id: pf.task_id, filled: pf.filled, fields: pf.fields };
    }

    return {
      ok: true,
      dry_run: Boolean(opts.dryRun),
      service_slug: slug,
      stages: stageResults,
      prefill,
    };
  }

  async getPresalesFunnelMetrics(
    query: PresalesFunnelMetricsQuery,
  ): Promise<PresalesFunnelMetricsPayload> {
    return loadPresalesFunnelMetricsPg(this.db, query);
  }

  async getPresalesConsultSlaSummary(amId?: number | null): Promise<PresalesConsultSlaSummary> {
    const params: unknown[] = [];
    let amFilter = '';
    if (amId != null && Number.isFinite(amId) && amId > 0) {
      amFilter = ' AND COALESCE(ps.assigned_am, l.owner_id) = $1';
      params.push(amId);
    }

    const activeResult = await this.db.query(
      `SELECT ps.stage, ps.consult_entered_at, ps.stage_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       WHERE ps.status = 'active' AND ps.stage = 'consult'${amFilter}`,
      params,
    );

    let slaOk = 0;
    let slaWarning = 0;
    let slaBreach = 0;
    for (const row of activeResult.rows as Array<Record<string, unknown>>) {
      const sla = buildPresalesConsultProposalSla({
        presalesStage: 'consult',
        consultEnteredAt: row.consult_entered_at ? String(row.consult_entered_at) : '',
        stageEnteredAt: row.stage_entered_at ? String(row.stage_entered_at) : '',
      });
      if (sla.sla_state === 'breach') slaBreach += 1;
      else if (sla.sla_state === 'warning') slaWarning += 1;
      else if (sla.sla_state === 'ok') slaOk += 1;
    }

    const completedResult = await this.db.query(
      `SELECT ps.consult_entered_at, ps.proposal_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       WHERE ps.consult_entered_at IS NOT NULL
         AND ps.proposal_entered_at IS NOT NULL
         AND ps.consult_entered_at::text != ''
         AND ps.proposal_entered_at::text != ''${amFilter}`,
      params,
    );

    let within48 = 0;
    for (const row of completedResult.rows as Array<Record<string, unknown>>) {
      if (
        isConsultToProposalWithin48h(
          row.consult_entered_at ? String(row.consult_entered_at) : '',
          row.proposal_entered_at ? String(row.proposal_entered_at) : '',
        )
      ) {
        within48 += 1;
      }
    }
    const denom = completedResult.rows.length;
    return {
      active_consult: activeResult.rows.length,
      sla_ok: slaOk,
      sla_warning: slaWarning,
      sla_breach: slaBreach,
      consult_to_proposal_48h_pct: denom > 0 ? Math.round((within48 / denom) * 1000) / 10 : 0,
      consult_to_proposal_48h_num: within48,
      consult_to_proposal_48h_denom: denom,
    };
  }

  async updatePresalesL2Docs(leadId: number, patch: Record<string, boolean>): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const merged = mergePresalesL2DocsPatch(
      snap.presales.service_slug,
      snap.presales.l2_docs_json,
      patch,
    );
    await this.db.query(
      `UPDATE crm_lead_presales SET l2_docs_json = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [snap.presales.id, JSON.stringify(merged)],
    );
    const updated = await this.getPresalesRowByLeadId(leadId);
    if (!updated) throw new Error('Không tìm thấy pre-sales');
    return updated;
  }

  async updatePresalesTask(taskId: number, body: PatchPresalesTaskBody, doneBy: number | null): Promise<void> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (body.is_done !== undefined) {
      sets.push(`is_done = $${idx++}`);
      params.push(Boolean(body.is_done));
      sets.push(`done_at = $${idx++}`);
      params.push(body.is_done ? new Date().toISOString() : null);
      if (doneBy != null) {
        sets.push(`done_by = $${idx++}`);
        params.push(doneBy);
      }
    }
    if (body.notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      params.push(String(body.notes).slice(0, 4000));
    }
    if (body.form_data !== undefined) {
      sets.push(`form_data = $${idx++}::jsonb`);
      params.push(JSON.stringify(body.form_data));
    }
    params.push(taskId);
    await this.db.query(
      `UPDATE crm_lead_presales_tasks SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
  }

  async advancePresales(
    leadId: number,
    opts: { confirm?: boolean; overrideReason?: string; allowOverride?: boolean } = {},
  ): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.advance.next_stage) {
      throw new Error(snap.advance.block_reason || 'Không thể chuyển giai đoạn');
    }
    if (snap.advance.next_stage === 'consult' && snap.advance.current_stage === 'lead') {
      const gate = await this.buildConsultAdvanceGate(leadId, snap.presales.id);
      const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
      if (block) throw new Error(block);
      if (opts.overrideReason?.trim()) {
        const note = `Director override: ${opts.overrideReason.trim().slice(0, 500)}`;
        await this.db.query(
          `UPDATE crm_lead_presales SET notes = TRIM(BOTH FROM notes || E'\\n' || $2), updated_at = NOW() WHERE id = $1`,
          [snap.presales.id, note],
        );
      }
    } else if (!snap.advance.can_advance_forward) {
      throw new Error(snap.advance.block_reason || 'Không thể chuyển giai đoạn');
    } else if (
      snap.advance.next_stage === 'proposal' &&
      snap.advance.current_stage === 'consult' &&
      blocksDirectProposalAdvance(snap.presales.handoff_status)
    ) {
      throw new Error(
        'Lead đang Solution/MKT — Solution dùng Trả Sales sau khi hoàn tất Consult + R5.',
      );
    }

    const nextStage = snap.advance.next_stage;
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = $2,
           stage_entered_at = NOW(),
           updated_at = NOW(),
           consult_entered_at = CASE
             WHEN $2 = 'consult' AND consult_entered_at IS NULL
             THEN NOW()
             ELSE consult_entered_at
           END,
           proposal_entered_at = CASE
             WHEN $2 = 'proposal' THEN NOW()
             ELSE proposal_entered_at
           END
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, nextStage],
    );
    let row = this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
    if (nextStage === 'proposal' && !row.consult_entered_at && snap.presales.stage_entered_at) {
      await this.db.query(
        `UPDATE crm_lead_presales SET consult_entered_at = $2::timestamptz WHERE id = $1`,
        [snap.presales.id, snap.presales.stage_entered_at],
      );
      const fixed = await this.getPresalesRowByLeadId(leadId);
      if (fixed) row = fixed;
    }
    if (nextStage === 'consult' && snap.advance.current_stage === 'lead') {
      await this.applyPresalesConsultPrefill(leadId, snap.presales.id, snap.presales.service_slug);
    }
    return row;
  }

  private async applyPresalesConsultPrefill(
    leadId: number,
    _presalesId: number,
    _serviceSlug: string,
  ): Promise<void> {
    await this.runPresalesConsultPrefill(leadId, false);
  }

  async getPreliminaryPlan(presalesId: number): Promise<Record<string, unknown> | null> {
    const psResult = await this.db.query(
      `SELECT draft_marketing_plan_id FROM crm_lead_presales WHERE id = $1`,
      [presalesId],
    );
    const draftId = psResult.rows[0]?.draft_marketing_plan_id;
    if (draftId != null) {
      const planResult = await this.db.query(`SELECT * FROM crm_marketing_plans WHERE id = $1`, [draftId]);
      return (planResult.rows[0] as Record<string, unknown> | undefined) ?? null;
    }
    const planResult = await this.db.query(
      `SELECT * FROM crm_marketing_plans
       WHERE presales_id = $1 AND plan_kind = 'preliminary'
       ORDER BY id DESC LIMIT 1`,
      [presalesId],
    );
    return (planResult.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async getOrCreatePreliminaryPlan(
    leadId: number,
    presalesId: number,
    serviceSlug: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.getPreliminaryPlan(presalesId);
    if (existing) return existing;
    const name = `KH MKT sơ bộ — Lead #${leadId}${serviceSlug ? ` (${serviceSlug})` : ''}`;
    const insert = await this.db.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lead_id, presales_id,
         north_star, objectives, strategy_framework_json, target_market_prof_json,
         target_market_steps4_json, created_at, updated_at
       ) VALUES ($1, $2, 'draft', 'preliminary', $3, $4, '', '', $5::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
       RETURNING *`,
      [`PS-${presalesId}-DRAFT`, name.slice(0, 200), leadId, presalesId, JSON.stringify(defaultStrategyJson())],
    );
    const plan = insert.rows[0] as Record<string, unknown>;
    await this.db.query(
      `UPDATE crm_lead_presales SET draft_marketing_plan_id = $2, updated_at = NOW() WHERE id = $1`,
      [presalesId, plan.id],
    );
    return plan;
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody): Promise<Record<string, unknown>> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const plan = await this.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const planId = Number(plan.id);
    const content = planContentFromRow(plan);
    const northStar = body.north_star !== undefined ? String(body.north_star) : String(plan.north_star || '');
    const objectives =
      body.objectives !== undefined ? String(body.objectives) : String(plan.objectives || '');
    if (body.name !== undefined) content.name = String(body.name);
    if (body.strategy_framework) {
      content.strategy_framework = { ...content.strategy_framework, ...body.strategy_framework };
    }
    let targetMarketProf = parsePresalesJsonRecord(plan.target_market_prof_json);
    if (body.target_market_prof) {
      targetMarketProf = { ...targetMarketProf, ...body.target_market_prof };
    }
    const updated = await this.db.query(
      `UPDATE crm_marketing_plans
       SET name = $2, north_star = $3, objectives = $4,
           strategy_framework_json = $5::jsonb, target_market_prof_json = $6::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        planId,
        content.name.slice(0, 200),
        northStar,
        objectives,
        JSON.stringify(content.strategy_framework),
        JSON.stringify(targetMarketProf),
      ],
    );
    return updated.rows[0] as Record<string, unknown>;
  }

  private async clientPlanLeaveBlock(
    leadId: number,
    leadTasks: PresalesTaskRow[],
    consultTasks: PresalesTaskRow[],
    plan: Record<string, unknown> | null,
  ): Promise<string> {
    const companyName = await this.getLeadCompanyName(leadId);
    const facts = leadQualifyFacts(leadTasks);
    const niche = resolveLeadNiche(facts.niche, await this.getLeadIndustryName(leadId));
    const brief = prefillClientBriefFromTasks(readClientBrief(plan?.target_market_prof_json), [
      ...leadTasks,
      ...consultTasks,
    ]);
    const missing = clientBriefMissing(brief, {
      company_name: companyName,
      niche,
      need: facts.need || (await this.getLeadNeed(leadId)),
    });
    if (missing[0]) return missing[0];
    if (!brief.saved_after_ai) return 'Solution chưa lưu sau bản AI.';
    return '';
  }

  async getLeadNeed(leadId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT COALESCE(need, '') AS need FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    return String(result.rows[0]?.need ?? '').trim();
  }

  async getLeadIndustryName(leadId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT meta_json FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const meta = parseLeadMetaIndustry(result.rows[0]?.meta_json);
    if (meta.industry) return meta.industry;
    if (!meta.industry_slug) return '';
    const catalog = await this.db.query(
      `SELECT name FROM crm_catalog_industries WHERE slug = $1 AND active IS TRUE LIMIT 1`,
      [meta.industry_slug],
    );
    return String(catalog.rows[0]?.name ?? '').trim();
  }

  async getLeadCompanyName(leadId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT company_name, meta_json FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] ?? {};
    return prefillCompanyName({ column: row.company_name, meta: leadMetaRecord(row.meta_json) });
  }

  async getLeadPlanContact(leadId: number): Promise<{ company_name: string; address: string; phone: string; email: string }> {
    const result = await this.db.query(
      `SELECT COALESCE(company_name, '') AS company_name,
              meta_json,
              COALESCE(company_address, '') AS company_address,
              COALESCE(phone, '') AS phone,
              COALESCE(email, '') AS email
       FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] ?? {};
    return {
      company_name: prefillCompanyName({ column: row.company_name, meta: leadMetaRecord(row.meta_json) }),
      address: String(row.company_address ?? '').trim(),
      phone: String(row.phone ?? '').trim(),
      email: String(row.email ?? '').trim(),
    };
  }

  async replacePreliminaryProf(leadId: number, prof: Record<string, string>): Promise<Record<string, unknown>> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const plan = await this.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const updated = await this.db.query(
      `UPDATE crm_marketing_plans
       SET target_market_prof_json = $2::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(plan.id), JSON.stringify(prof)],
    );
    return updated.rows[0] as Record<string, unknown>;
  }

  async markPresalesConverted(presalesId: number, lifecycleId: number, client?: PoolClient): Promise<void> {
    const q = client ?? this.db;
    await q.query(
      `UPDATE crm_lead_presales
       SET status = 'converted', lifecycle_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [presalesId, lifecycleId],
    );
  }

  async getPresalesProgress(presalesId: number): Promise<Record<string, { total: number; done: number }>> {
    const result = await this.db.query(
      `SELECT stage, is_done FROM crm_lead_presales_tasks WHERE presales_id = $1`,
      [presalesId],
    );
    const progress: Record<string, { total: number; done: number }> = {};
    for (const stage of PRESALES_STAGES) progress[stage] = { total: 0, done: 0 };
    for (const row of result.rows as Array<{ stage: string; is_done: boolean }>) {
      const stage = String(row.stage);
      if (!progress[stage]) progress[stage] = { total: 0, done: 0 };
      progress[stage].total += 1;
      if (row.is_done) progress[stage].done += 1;
    }
    return progress;
  }

  async getPresalesTasksForPromote(presalesId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.query(
      `SELECT * FROM crm_lead_presales_tasks WHERE presales_id = $1 ORDER BY stage, step_index, id`,
      [presalesId],
    );
    return result.rows as Array<Record<string, unknown>>;
  }

  async assertPendingTasksComplete(presalesId: number): Promise<void> {
    for (const stage of PRESALES_STAGES) {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM crm_lead_presales_tasks
         WHERE presales_id = $1 AND stage = $2 AND is_custom = FALSE AND is_done = FALSE`,
        [presalesId, stage],
      );
      if (Number(result.rows[0]?.c ?? 0) > 0) {
        throw new Error(`Chưa hoàn thành task giai đoạn ${stage}`);
      }
    }
  }

  async handoffToSolution(
    leadId: number,
    staffId: number,
    opts: { confirm?: boolean; overrideReason?: string } = {},
  ): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const stage = snap.presales.stage;
    const handoff = snap.presales.handoff_status;
    if (handoff === 'pending' || handoff === 'with_solution') {
      throw new Error('Lead đã được giao Solution.');
    }
    if (stage !== 'lead' && !(stage === 'consult' && handoff === '')) {
      throw new Error('Chỉ giao Solution khi đang ở giai đoạn Lead (hoặc Tư vấn chưa giao queue).');
    }
    const gate = await this.buildConsultAdvanceGate(leadId, snap.presales.id);
    const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
    if (block) throw new Error(block);
    if (opts.overrideReason?.trim()) {
      const note = `Director override handoff: ${opts.overrideReason.trim().slice(0, 500)}`;
      await this.db.query(
        `UPDATE crm_lead_presales SET notes = TRIM(BOTH FROM notes || E'\\n' || $2), updated_at = NOW() WHERE id = $1`,
        [snap.presales.id, note],
      );
    }

    const leaders = await this.marketingLeaders();
    const assigneeId = preferredMarketingLeaderId(
      leaders.map((row) => row.id),
      null,
    );
    const assigneeName = leaders.find((row) => row.id === assigneeId)?.name ?? '';
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'consult',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           consult_entered_at = CASE
             WHEN consult_entered_at IS NULL THEN NOW()
             ELSE consult_entered_at
           END,
           handoff_status = 'pending',
           handed_off_at = NOW(),
           handed_off_by_staff_id = $2,
           solution_owner_staff_id = $3,
           solution_accept_due_at = NOW() + ($4::int * INTERVAL '1 minute'),
           solution_claimed_at = NULL,
           solution_due_at = NULL,
           solution_released_at = NULL,
           solution_customer_due_at = NULL,
           solution_revision_note = '',
           solution_revision_due_at = NULL
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, staffId, assigneeId, SOLUTION_ACCEPT_MINUTES],
    );
    await this.applyPresalesConsultPrefill(leadId, snap.presales.id, snap.presales.service_slug);
    await this.promoteLeadStatusOnSolutionHandoff(leadId, `staff:${staffId}`);
    const status = await this.currentLeadStatus(leadId);
    const who = assigneeName ? ` Đã giao ${assigneeName}.` : '';
    await this.noteLeadStep(
      leadId,
      staffId,
      status,
      `Lead chờ Solutions.${who} Hạn nhận case ${SOLUTION_ACCEPT_MINUTES} phút.`,
    );
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  /** Giao Solution writes Đang tư vấn. A lost or quoted lead keeps its status. */
  private async promoteLeadStatusOnSolutionHandoff(leadId: number, actor: string): Promise<void> {
    const current = await this.db.query(
      `SELECT lower(status) AS status FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const next = leadStatusAfterSolutionHandoff(current.rows[0]?.status);
    if (!next) return;
    const updated = await this.db.query(
      `UPDATE crm_leads
       SET status = $2, updated_at = NOW(), updated_by = $3
       WHERE sqlite_lead_id = $1
         AND lower(status) = ANY($4::text[])`,
      [leadId, SOLUTION_HANDOFF_LEAD_STATUS, actor.slice(0, 120), [...STATUSES_PROMOTED_ON_SOLUTION_HANDOFF]],
    );
    if (!updated.rowCount) return;
    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
       ) VALUES ($1, 'system', $2, '', '', NOW(), $3, $4)`,
      [
        leadId,
        'Giao Solution — trạng thái lead chuyển sang Đang tư vấn.',
        actor.slice(0, 120),
        SOLUTION_HANDOFF_LEAD_STATUS,
      ],
    );
  }

  async claimSolution(leadId: number, staffId: number, asSuperAdmin = false): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status !== 'pending') {
      throw new Error('Lead không ở trạng thái chờ Solution nhận case.');
    }
    if (
      !asSuperAdmin &&
      snap.presales.solution_owner_staff_id &&
      snap.presales.solution_owner_staff_id !== staffId
    ) {
      throw new Error('Case Solutions đang giao cho Marketing Leader khác.');
    }
    const due = solutionWorkDueAt(new Date());
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET handoff_status = 'with_solution',
           solution_owner_staff_id = $2,
           solution_claimed_at = NOW(),
           solution_due_at = $3,
           solution_revision_note = '',
           solution_revision_due_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, staffId, due.toISOString()],
    );
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(leadId, staffId, status, 'Đã nhận case Solutions. Hạn trả theo giờ làm việc 8:30–16:00.');
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async returnToSalesForMissingInfo(leadId: number, staffId: number, reason: string): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const handoff = snap.presales.handoff_status;
    if (handoff !== 'pending' && handoff !== 'with_solution') {
      throw new Error('Lead không đang ở Solution.');
    }
    if (
      handoff === 'with_solution' &&
      snap.presales.solution_owner_staff_id &&
      snap.presales.solution_owner_staff_id !== staffId
    ) {
      throw new Error('Chỉ Solution owner được trả lại Sales.');
    }
    const note = reason.trim().slice(0, 500);
    if (note.length < 5) {
      throw new Error('Nhập lý do thông tin chưa đủ (ít nhất 5 ký tự).');
    }
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'lead',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           handoff_status = '',
           solution_owner_staff_id = NULL,
           solution_accept_due_at = NULL,
           solution_due_at = NULL,
           solution_customer_due_at = NULL,
           solution_revision_note = '',
           solution_revision_due_at = NULL,
           notes = TRIM(BOTH FROM COALESCE(notes, '') || E'\\n' || $2)
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, `MKT trả lại Sales — thông tin chưa đủ: ${note}`],
    );
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async releaseToSales(leadId: number, staffId: number): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status === 'released') {
      throw new Error('Solution đã nộp cho Sales.');
    }
    if (snap.presales.handoff_status !== 'with_solution') {
      throw new Error('Nhận case trước khi nộp Solution.');
    }
    if (
      snap.presales.solution_owner_staff_id &&
      snap.presales.solution_owner_staff_id !== staffId
    ) {
      throw new Error('Chỉ Solution owner được trả Sales.');
    }
    const plan = await this.getPreliminaryPlan(snap.presales.id);
    const gaps = solutionSubmitGaps(plan);
    if (gaps.length) {
      throw new Error(gaps.join('\n'));
    }

    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'proposal',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           proposal_entered_at = NOW(),
           handoff_status = 'released',
           solution_released_at = NOW(),
           solution_due_at = NULL,
           solution_customer_due_at = NOW() + ($2::int * INTERVAL '1 hour'),
           solution_revision_note = '',
           solution_revision_due_at = NULL,
           consult_entered_at = CASE
             WHEN consult_entered_at IS NULL
             THEN COALESCE(stage_entered_at, NOW())
             ELSE consult_entered_at
           END
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, SOLUTION_CUSTOMER_HOURS],
    );
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(
      leadId,
      staffId,
      status,
      `Đã trả Sales. Khách có ${SOLUTION_CUSTOMER_HOURS} giờ để phản hồi Solutions.`,
    );
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async requestSolutionEdits(leadId: number, staffId: number, note: string): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status !== 'released') {
      throw new Error('Trả Sales trước khi yêu cầu chỉnh Solutions.');
    }
    if (snap.presales.solution_approved_at) {
      throw new Error('Solution đã được duyệt.');
    }
    const text = note.trim().slice(0, 500);
    if (text.length < 5) {
      throw new Error('Nhập nội dung cần chỉnh, ít nhất 5 ký tự.');
    }
    await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'consult',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           handoff_status = 'with_solution',
           solution_revision_note = $2,
           solution_revision_due_at = NOW() + ($3::int * INTERVAL '1 hour'),
           solution_due_at = NOW() + ($3::int * INTERVAL '1 hour'),
           solution_customer_due_at = NULL
       WHERE id = $1`,
      [snap.presales.id, text, SOLUTION_REVISION_HOURS],
    );
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(
      leadId,
      staffId,
      status,
      `Sale yêu cầu chỉnh Solutions: ${text}. Hạn trả lại ${SOLUTION_REVISION_HOURS} giờ.`,
    );
  }

  private async staffForDesk(
    desk: 'sale' | 'marketing_leader',
  ): Promise<Array<{ id: number; name: string; title: string }>> {
    const deskSql =
      desk === 'marketing_leader'
        ? `lower(replace(p.code, ' ', '')) IN ('mkl', 'mkt-01', 'mkt01')
           AND lower(btrim(COALESCE(s.job_function_primary, ''))) IN ('', 'leader')
           AND lower(btrim(COALESCE(s.job_title, ''))) IN ('mkl', 'marketing leader')`
        : `lower(replace(p.code, ' ', '')) IN ('ae')
           AND lower(btrim(COALESCE(s.job_function_primary, ''))) <> 'ops'
           AND (
             lower(btrim(COALESCE(s.job_function_primary, ''))) = 'sales'
             OR lower(btrim(COALESCE(s.job_title, ''))) IN ('account executive', 'ae')
           )`;
    const result = await this.db.query(
      `SELECT s.id, s.name, p.code AS position_code, p.name AS position_name,
              COALESCE(s.job_title, '') AS job_title,
              COALESCE(s.job_function_primary, '') AS job_function
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND ${deskSql}
        ORDER BY s.name, s.id`,
    );
    return result.rows
      .filter((row) =>
        holdsQuoteDesk(desk, {
          position_code: row.position_code,
          job_title: row.job_title,
          job_function: row.job_function,
        }),
      )
      .map((row) => ({
        id: Number(row.id),
        name: String(row.name ?? '').trim(),
        title: desk === 'marketing_leader' ? 'Marketing Leader' : 'Sale',
      }));
  }

  private async marketingLeaders(): Promise<Array<{ id: number; name: string }>> {
    const result = await this.db.query(
      `SELECT s.id, s.name
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) IN ('mkl', 'mkt-01', 'mkt01')
        ORDER BY s.id`,
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? '').trim(),
    }));
  }

  private async leadOwnerId(leadId: number): Promise<number | null> {
    const result = await this.db.query(`SELECT owner_id FROM crm_leads WHERE sqlite_lead_id = $1`, [leadId]);
    const owner = Number(result.rows[0]?.owner_id);
    return Number.isInteger(owner) && owner > 0 ? owner : null;
  }

  private async quoteAssigneeName(staffId: number | null): Promise<string> {
    if (staffId == null || staffId <= 0) return '';
    const leaders = await this.marketingLeaders();
    return leaders.find((row) => row.id === staffId)?.name || (await this.staffNameById(staffId));
  }

  /** A missed quote timer stays with the Solution Marketing Leader and is logged for the CEO. */
  private async syncQuoteWithSolutionOwner(ps: PresalesRow): Promise<void> {
    const forcedAccept = await this.restoreQuoteToSolutionOwner(ps);
    await this.recordQuoteLateness(ps, forcedAccept);
  }

  private async restoreQuoteToSolutionOwner(ps: PresalesRow): Promise<boolean> {
    if (ps.quote_accepted_at || ps.quote_approved_at || ps.quote_sent_back_at) return false;
    if (!ps.solution_approved_at) return false;
    const owner = ps.solution_owner_staff_id;
    if (owner == null || owner <= 0 || ps.quote_assignee_staff_id === owner) return false;
    if (String(ps.quote_reassign_note ?? '').trim().startsWith('CEO chuyển')) return false;
    const stolen = quoteWasAutoReassigned(ps.quote_reassign_note);
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
          SET quote_assignee_staff_id = $2,
              quote_reassign_note = '',
              updated_at = NOW()
        WHERE id = $1
          AND quote_accepted_at IS NULL
          AND quote_approved_at IS NULL
          AND quote_sent_back_at IS NULL
          AND solution_owner_staff_id = $2
          AND quote_assignee_staff_id IS DISTINCT FROM $2
          AND COALESCE(quote_reassign_note, '') NOT LIKE 'CEO chuyển%'
        RETURNING quote_assignee_staff_id`,
      [ps.id, owner],
    );
    if (!updated.rowCount) return false;
    ps.quote_assignee_staff_id = owner;
    ps.quote_reassign_note = '';
    return stolen;
  }

  private async recordQuoteLateness(ps: PresalesRow, forcedAccept = false): Promise<void> {
    if (ps.quote_approved_at || ps.quote_sent_back_at) return;
    const acceptDue = Date.parse(ps.quote_accept_due_at);
    const finishDue = Date.parse(ps.quote_due_at);
    const acceptLate =
      forcedAccept ||
      (Boolean(ps.solution_approved_at) &&
        !ps.quote_accepted_at &&
        Number.isFinite(acceptDue) &&
        Date.now() > acceptDue);
    const finishLate =
      Boolean(ps.quote_accepted_at) && Number.isFinite(finishDue) && Date.now() > finishDue;
    if (!acceptLate && !finishLate) return;

    const timer: QuoteLateTimer = acceptLate ? 'accept' : 'finish';
    const dueRaw = acceptLate ? ps.quote_accept_due_at : ps.quote_due_at;
    const dueAt = quoteDeadlineIso(dueRaw) || new Date().toISOString();
    const staffName = await this.quoteAssigneeName(ps.quote_assignee_staff_id);
    const event: QuoteLateEvent = {
      staff_id: ps.quote_assignee_staff_id,
      staff_name: staffName,
      timer,
      timer_label: quoteTimerLabel(timer),
      due_at: dueAt,
      logged_at: new Date().toISOString(),
    };
    const existing = readQuoteLateEvents(ps.quote_late_events);
    const already = existing.some((row) => quoteLateEventKey(row) === quoteLateEventKey(event));
    if (already && ps.quote_ceo_escalated_at) return;
    const events = already ? existing : [...existing, event];
    const who = staffName || 'Marketing Leader';
    const note = acceptLate
      ? `Quá ${QUOTE_ACCEPT_MINUTES} phút chưa bấm Nhận Case Báo Giá — ${who} trễ, đã báo CEO. Giữ nguyên người phụ trách.`
      : `Quá ${QUOTE_FINISH_HOURS} giờ chưa nộp báo giá — ${who} trễ, đã báo CEO. Giữ nguyên người phụ trách.`;
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
          SET quote_late_events = $2::jsonb,
              quote_ceo_escalated_at = COALESCE(quote_ceo_escalated_at, NOW()),
              updated_at = NOW()
        WHERE id = $1
          AND quote_approved_at IS NULL
          AND quote_sent_back_at IS NULL
          AND quote_assignee_staff_id IS NOT DISTINCT FROM $3
        RETURNING quote_ceo_escalated_at, quote_late_events, quote_assignee_staff_id`,
      [ps.id, JSON.stringify(events), ps.quote_assignee_staff_id],
    );
    if (!updated.rowCount) return;
    const row = updated.rows[0] as {
      quote_ceo_escalated_at?: Date | string | null;
      quote_late_events?: unknown;
    };
    ps.quote_ceo_escalated_at = row.quote_ceo_escalated_at ? String(row.quote_ceo_escalated_at) : '';
    ps.quote_late_events = readQuoteLateEvents(row.quote_late_events);
    if (!already) {
      const status = await this.currentLeadStatus(ps.lead_id);
      await this.noteLeadStep(ps.lead_id, ps.quote_assignee_staff_id ?? 0, status, note.slice(0, 500));
    }
  }

  async transferQuoteCase(leadId: number, actorStaffId: number, targetStaffId: number): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const ps = snap.presales;
    const desk = snap.quote_case ? quoteDeskForPhase(snap.quote_case.phase) : null;
    if (!desk) throw new Error('Giai đoạn này không giao lại người nhận.');
    const people = await this.staffForDesk(desk);
    const target = people.find((row) => row.id === targetStaffId);
    if (!target) {
      throw new Error(
        desk === 'sale' ? 'Chỉ giao cho nhân sự đang làm Sale.' : 'Chỉ giao cho nhân sự đang làm Marketing Leader.',
      );
    }
    if (desk === 'sale') {
      const ownerId = await this.leadOwnerId(leadId);
      if (ownerId === targetStaffId) throw new Error('Lead đang giao cho Sale này.');
      const note = `Giao Sale ${target.name} nhận bước ${snap.quote_case?.step_label || 'Sale'}.`;
      await this.db.query(
        `UPDATE crm_leads
            SET owner_id = $2, assigned_at = NOW(), updated_at = NOW()
          WHERE sqlite_lead_id = $1`,
        [leadId, targetStaffId],
      );
      await this.db.query(
        `INSERT INTO crm_lead_assignment_log
           (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [leadId, ownerId, targetStaffId, note.slice(0, 500), String(actorStaffId)],
      );
      const status = await this.currentLeadStatus(leadId);
      await this.noteLeadStep(leadId, actorStaffId, status, note.slice(0, 500));
      return;
    }
    if (!ps.solution_approved_at) throw new Error('Chưa có case báo giá để chuyển.');
    if (ps.quote_approved_at) throw new Error('Báo giá đã được Approve.');
    if (ps.quote_sent_back_at) throw new Error('Báo giá đang chờ Sale.');
    if (ps.quote_assignee_staff_id === targetStaffId) {
      throw new Error('Case đang giao cho Marketing Leader này.');
    }
    const accepted = Boolean(ps.quote_accepted_at);
    const note = accepted
      ? `CEO chuyển case báo giá cho ${target.name}. Hạn nộp ${QUOTE_FINISH_HOURS} giờ.`
      : `CEO chuyển case báo giá cho ${target.name}. Hạn nhận case ${QUOTE_ACCEPT_MINUTES} phút.`;
    const updated = accepted
      ? await this.db.query(
          `UPDATE crm_lead_presales
              SET quote_assignee_staff_id = $2,
                  quote_due_at = NOW() + ($3::int * INTERVAL '1 hour'),
                  quote_ceo_escalated_at = NULL,
                  quote_reassign_note = $4,
                  updated_at = NOW()
            WHERE id = $1
              AND quote_accepted_at IS NOT NULL
              AND quote_sent_back_at IS NULL
              AND quote_approved_at IS NULL
            RETURNING id`,
          [ps.id, targetStaffId, QUOTE_FINISH_HOURS, note.slice(0, 500)],
        )
      : await this.db.query(
          `UPDATE crm_lead_presales
              SET quote_assignee_staff_id = $2,
                  quote_accept_due_at = NOW() + ($3::int * INTERVAL '1 minute'),
                  quote_ceo_escalated_at = NULL,
                  quote_reassign_note = $4,
                  updated_at = NOW()
            WHERE id = $1
              AND quote_accepted_at IS NULL
              AND quote_approved_at IS NULL
            RETURNING id`,
          [ps.id, targetStaffId, QUOTE_ACCEPT_MINUTES, note.slice(0, 500)],
        );
    if (!updated.rowCount) throw new Error('Không chuyển được case báo giá.');
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(leadId, actorStaffId, status, note.slice(0, 500));
  }

  private assertQuoteAssignee(ps: PresalesRow, staffId: number, bypass = false): void {
    if (bypass) return;
    if (ps.quote_assignee_staff_id && ps.quote_assignee_staff_id !== staffId) {
      throw new Error('Case báo giá đang giao cho Marketing Leader khác.');
    }
  }

  private async storedQuoteSheet(presalesId: number) {
    const result = await this.db.query(`SELECT quote_sheet FROM crm_lead_presales WHERE id = $1`, [presalesId]);
    return readStoredQuoteSheet(result.rows[0]?.quote_sheet);
  }

  private async loadQuoteCatalog(selectedCodes: string[]): Promise<{
    services: QuoteSheetService[];
    staff: QuoteSheetStaff[];
    items: QuoteSheetItem[];
    selected: string[];
  }> {
    const serviceResult = await this.db.query(
      `SELECT s.code, s.name, COUNT(i.id)::int AS item_count
         FROM crm_services s
         LEFT JOIN crm_service_items i ON i.service_id = s.id AND i.is_active
        WHERE s.is_active
        GROUP BY s.id
        ORDER BY s.sort_order, s.code`,
    );
    const services: QuoteSheetService[] = serviceResult.rows.map((row) => ({
      code: String(row.code ?? '').trim().toUpperCase(),
      name: String(row.name ?? ''),
      item_count: Number(row.item_count) || 0,
    }));
    const known = new Set(services.map((service) => service.code));
    const selected = selectedCodes.filter((code) => known.has(code)).slice(0, QUOTE_SHEET_MAX_SERVICES);
    const staffResult = await this.db.query(
      `SELECT s.id, s.name, upper(p.code) AS position_code, p.name AS position_name,
              r.monthly_salary_vnd, r.hours_per_month
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
         LEFT JOIN crm_position_rates r ON r.position_id = p.id
        WHERE s.active IS TRUE
          AND upper(p.code) IN ('AE', 'GDKD', 'MKL')
        ORDER BY upper(p.code), s.name, s.id`,
    );
    const staff: QuoteSheetStaff[] = staffResult.rows.map((row) => {
      const monthly = Number(row.monthly_salary_vnd) || 0;
      const hours = Number(row.hours_per_month) || 0;
      return {
        id: Number(row.id),
        name: String(row.name ?? '').trim(),
        position_code: String(row.position_code ?? ''),
        position_name: String(row.position_name ?? ''),
        monthly_salary_vnd: monthly,
        hours_per_month: hours,
        hourly_vnd: hourlyFromPosition(monthly, hours),
      };
    });
    let items: QuoteSheetItem[] = [];
    if (selected.length) {
      const itemResult = await this.db.query(
        `SELECT i.code, s.code AS service_code, s.name AS service_name,
                i.phase_code, COALESCE(ph.name, i.phase_code) AS phase_name,
                i.task, COALESCE(i.subtask, '') AS subtask,
                COALESCE(i.main_role_code, '') AS role_code,
                COALESCE(i.planned_hours, i.est_hours) AS est_hours, i.default_qty, COALESCE(i.unit, '') AS unit,
                i.billable, i.client_only
           FROM crm_service_items i
           JOIN crm_services s ON s.id = i.service_id
           LEFT JOIN crm_service_phases ph ON ph.code = i.phase_code
          WHERE i.is_active AND s.is_active AND s.code = ANY($1::text[])
          ORDER BY s.sort_order, i.sort_order, i.code`,
        [selected],
      );
      items = itemResult.rows.map((row) => ({
        code: String(row.code ?? ''),
        service_code: String(row.service_code ?? '').trim().toUpperCase(),
        service_name: String(row.service_name ?? ''),
        phase_code: String(row.phase_code ?? ''),
        phase_name: String(row.phase_name ?? ''),
        task: String(row.task ?? ''),
        subtask: String(row.subtask ?? ''),
        role_code: String(row.role_code ?? ''),
        est_hours: Number(row.est_hours) || 0,
        qty: Number(row.default_qty) || 0,
        unit: String(row.unit ?? ''),
        billable: Boolean(row.billable),
        client_only: Boolean(row.client_only),
      }));
    }
    return { services, staff, items, selected };
  }

  private async assembledQuoteSheet(presalesId: number, editable: boolean): Promise<QuoteSheetView> {
    const stored = await this.storedQuoteSheet(presalesId);
    const catalog = await this.loadQuoteCatalog(stored.service_codes);
    return assembleQuoteSheet({
      editable,
      services: catalog.services,
      staff: catalog.staff,
      items: catalog.items,
      selectedServiceCodes: catalog.selected,
      overrides: stored.lines,
      vatPercent: stored.vat_percent,
      promoPercent: stored.promo_percent,
    });
  }

  private async assertQuoteSheetReady(presalesId: number): Promise<void> {
    const view = await this.assembledQuoteSheet(presalesId, false);
    if (view.included_count < 1) {
      throw new Error('Chọn dịch vụ và giữ ít nhất một việc được tính tiền.');
    }
    if (view.missing_staff_count > 0) {
      throw new Error('Gán nhân sự cho từng việc được tính tiền.');
    }
  }

  private async assertBaoGiaSheet(leadId: number, snap: PresalesSnapshot): Promise<void> {
    if (!snap.presales.solution_approved_at && !snap.presales.quote_accepted_at) {
      throw new Error('Sale chưa Approve Solution.');
    }
    const status = await this.currentLeadStatus(leadId);
    const phase = snap.quote_case?.phase;
    if (!isBaoGiaColumnStatus(status) && phase !== 'bao_gia' && phase !== 'sale_review') {
      throw new Error('Bảng báo giá chỉ mở ở giai đoạn Báo giá.');
    }
  }

  private async assertQuoteSheetReadable(leadId: number, snap: PresalesSnapshot): Promise<void> {
    const phase = snap.quote_case?.phase;
    const kept =
      phase === 'trien_khai' ||
      Boolean(snap.presales.quote_approved_at) ||
      Boolean(snap.presales.quote_sent_back_at);
    if (kept) return;
    await this.assertBaoGiaSheet(leadId, snap);
  }

  async getQuoteSheet(leadId: number, requestedCodes: string[] | null): Promise<QuoteSheetView> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    await this.assertQuoteSheetReadable(leadId, snap);
    const stored = await this.storedQuoteSheet(snap.presales.id);
    const catalog = await this.loadQuoteCatalog(requestedCodes ?? stored.service_codes);
    return assembleQuoteSheet({
      editable: snap.quote_case?.phase === 'bao_gia',
      services: catalog.services,
      staff: catalog.staff,
      items: catalog.items,
      selectedServiceCodes: catalog.selected,
      overrides: stored.lines,
      vatPercent: stored.vat_percent,
      promoPercent: stored.promo_percent,
    });
  }

  async saveQuoteSheet(
    leadId: number,
    staffId: number,
    body: { service_codes?: unknown; lines?: unknown; vat_percent?: unknown; promo_percent?: unknown },
    asSuperAdmin = false,
  ): Promise<QuoteSheetView> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (asSuperAdmin) {
      if (snap.presales.quote_approved_at) throw new Error('Bảng báo giá đang khóa.');
    } else {
      await this.assertBaoGiaSheet(leadId, snap);
      if (snap.quote_case?.phase !== 'bao_gia') throw new Error('Bảng báo giá đang khóa.');
      this.assertQuoteAssignee(snap.presales, staffId);
    }
    const parsed = readStoredQuoteSheet({
      service_codes: body.service_codes,
      lines: body.lines,
      vat_percent: body.vat_percent,
      promo_percent: body.promo_percent,
    });
    const catalog = await this.loadQuoteCatalog(parsed.service_codes);
    const allowed = new Set(catalog.staff.map((person) => person.id));
    for (const line of parsed.lines) {
      if (line.staff_id != null && !allowed.has(line.staff_id)) {
        throw new Error('Nhân sự không thuộc AE, GDKD hoặc Marketing Leader.');
      }
    }
    const payload = {
      service_codes: catalog.selected,
      lines: parsed.lines,
      vat_percent: parsed.vat_percent,
      promo_percent: parsed.promo_percent,
    };
    await this.db.query(
      `UPDATE crm_lead_presales SET quote_sheet = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [snap.presales.id, JSON.stringify(payload)],
    );
    return assembleQuoteSheet({
      editable: true,
      services: catalog.services,
      staff: catalog.staff,
      items: catalog.items,
      selectedServiceCodes: catalog.selected,
      overrides: parsed.lines,
      vatPercent: parsed.vat_percent,
      promoPercent: parsed.promo_percent,
    });
  }

  async quoteSheetPdf(leadId: number): Promise<{ filename: string; buffer: Buffer }> {
    const view = await this.getQuoteSheet(leadId, null);
    if (view.included_count < 1) throw new Error('Chưa có việc được tính tiền để tải báo giá.');
    const name = await this.db.query(`SELECT full_name FROM crm_leads WHERE sqlite_lead_id = $1`, [leadId]);
    const label = String(name.rows[0]?.full_name ?? '').trim() || `Lead ${leadId}`;
    const buffer = await renderLeadQuoteDocx(view, label);
    return { filename: `bao-gia-${leadId}.docx`, buffer };
  }

  async quoteSheetXlsx(leadId: number): Promise<{ filename: string; buffer: Buffer }> {
    const view = await this.getQuoteSheet(leadId, null);
    const name = await this.db.query(`SELECT full_name FROM crm_leads WHERE sqlite_lead_id = $1`, [leadId]);
    const label = String(name.rows[0]?.full_name ?? '').trim() || `Lead ${leadId}`;
    const buffer = await renderLeadQuoteXlsx(view, label);
    return { filename: `bao-gia-${leadId}.xlsx`, buffer };
  }

  async quoteContractDocx(leadId: number): Promise<{ filename: string; buffer: Buffer }> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.quote_approved_at && !snap.presales.contract_created_at) {
      throw new Error('Sale chưa Approve báo giá.');
    }
    const view = await this.assembledQuoteSheet(snap.presales.id, false);
    const contact = await this.getLeadPlanContact(leadId);
    const name = await this.db.query(`SELECT full_name FROM crm_leads WHERE sqlite_lead_id = $1`, [leadId]);
    const person = String(name.rows[0]?.full_name ?? '').trim();
    const client = contact.company_name || person || `Lead ${leadId}`;
    const contract = await this.db.query(
      `SELECT c.amount_vnd, c.status, c.signed_on, a.status AS approval_status
         FROM crm_contracts c
         LEFT JOIN LATERAL (
           SELECT status
             FROM crm_contract_approvals
            WHERE contract_id = c.id
            ORDER BY id DESC
            LIMIT 1
         ) a ON TRUE
        WHERE c.lead_id = $1
        ORDER BY c.id DESC
        LIMIT 1`,
      [leadId],
    );
    const row = contract.rows[0] as
      | { amount_vnd?: number | string; status?: string; signed_on?: string; approval_status?: string }
      | undefined;
    const approval = String(row?.approval_status ?? '');
    const contractStatus = String(row?.status ?? '');
    const approved =
      approval === 'approved' || contractStatus === 'active' || Boolean(snap.presales.contract_signed_at);
    const statusLabel = approved ? 'Đã duyệt' : approval === 'pending' ? 'Chờ GĐKD duyệt' : 'Bản gửi GĐKD';
    const storedAmount = Number(row?.amount_vnd);
    const amountVnd =
      Number.isFinite(storedAmount) && storedAmount > 0
        ? storedAmount
        : Number(snap.presales.contract_amount_vnd) || view.grand_total_vnd;
    const buffer = await renderLeadContractDocx(view, {
      client,
      contactName: person && person !== client ? person : '',
      address: contact.address,
      phone: contact.phone,
      email: contact.email,
      contractNo: `HĐ-${leadId}`,
      statusLabel,
      createdLabel: contractDateLabel(snap.presales.quote_approved_at || snap.presales.contract_created_at),
      signedLabel: approved ? contractDateLabel(row?.signed_on || snap.presales.contract_signed_at) : '',
      amountVnd,
    });
    return { filename: `hop-dong-${leadId}.docx`, buffer };
  }

  async approveSubmittedSolution(leadId: number, staffId: number): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status !== 'released') {
      throw new Error('Nộp Solution trước khi Sale Approve.');
    }
    if (snap.presales.solution_approved_at) {
      throw new Error('Solution đã được Approve.');
    }
    const leaders = await this.marketingLeaders();
    const ownerId = snap.presales.solution_owner_staff_id;
    const assigneeId =
      ownerId != null && ownerId > 0
        ? ownerId
        : preferredMarketingLeaderId(
            leaders.map((row) => row.id),
            null,
          );
    const assigneeName =
      leaders.find((row) => row.id === assigneeId)?.name || (await this.staffNameById(assigneeId));
    await this.db.query(
      `UPDATE crm_lead_presales
       SET solution_approved_at = NOW(),
           solution_customer_due_at = NULL,
           quote_offered_at = NOW(),
           quote_accept_due_at = NOW() + ($3::int * INTERVAL '1 minute'),
           quote_assignee_staff_id = $2,
           quote_reassign_note = '',
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id, assigneeId, QUOTE_ACCEPT_MINUTES],
    );
    const status = await this.currentLeadStatus(leadId);
    const who = assigneeName ? ` ${assigneeName} có ${QUOTE_ACCEPT_MINUTES} phút để nhận case.` : '';
    await this.noteLeadStep(leadId, staffId, status, `Sale Approve Solution — sang bước Chuyển Báo Giá.${who}`);
  }

  async acceptQuoteCase(leadId: number, staffId: number, asSuperAdmin = false): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.solution_approved_at) {
      throw new Error('Sale chưa Approve Solution.');
    }
    if (snap.presales.quote_accepted_at) {
      throw new Error('Case đã được nhận lên báo giá.');
    }
    if (!asSuperAdmin) {
      const leaders = await this.marketingLeaders();
      const isLeader = leaders.some((row) => row.id === staffId);
      const isAssignee = snap.presales.quote_assignee_staff_id === staffId;
      const isSolutionOwner = snap.presales.solution_owner_staff_id === staffId;
      if (!isLeader && !isAssignee && !isSolutionOwner) {
        throw new Error('Chỉ Marketing Leader được nhận case báo giá.');
      }
      this.assertQuoteAssignee(snap.presales, staffId);
    }
    await this.db.query(
      `UPDATE crm_lead_presales
       SET quote_accepted_at = NOW(),
           quote_assignee_staff_id = $2,
           quote_due_at = NOW() + ($3::int * INTERVAL '1 hour'),
           quote_reassign_note = '',
           quote_ceo_escalated_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id, staffId, QUOTE_FINISH_HOURS],
    );
    await this.setLeadStatus(leadId, 'bao_gia', staffId, 'Marketing Leader nhận case báo giá.');
  }

  async sendQuoteToSales(leadId: number, staffId: number, asSuperAdmin = false): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.quote_approved_at) {
      throw new Error('Báo giá đã được Approve.');
    }
    const status = await this.currentLeadStatus(leadId);
    if (!snap.presales.quote_accepted_at && !isBaoGiaColumnStatus(status)) {
      throw new Error('Nhận case báo giá trước khi gửi Sale.');
    }
    if (snap.quote_case?.phase !== 'bao_gia') {
      throw new Error('Báo giá không còn ở bước Marketing Leader.');
    }
    this.assertQuoteAssignee(snap.presales, staffId, asSuperAdmin);
    await this.assertQuoteSheetReady(snap.presales.id);
    await this.db.query(
      `UPDATE crm_lead_presales
       SET quote_sent_back_at = NOW(),
           quote_change_note = '',
           quote_accepted_at = COALESCE(quote_accepted_at, NOW()),
           quote_due_at = NULL,
           quote_ceo_escalated_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id],
    );
    await this.noteLeadStep(leadId, staffId, status, 'Marketing Leader nộp báo giá cho Sale.');
  }

  async approveQuote(leadId: number, staffId: number): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.quote_sent_back_at) {
      throw new Error('Marketing Leader chưa nộp báo giá.');
    }
    if (snap.presales.quote_approved_at) {
      throw new Error('Báo giá đã được Approve.');
    }
    await this.db.query(
      `UPDATE crm_lead_presales
       SET quote_approved_at = NOW(),
           implementation_status = '',
           quote_accept_due_at = NULL,
           quote_due_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id],
    );
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(
      leadId,
      staffId,
      status,
      'Sale Approve báo giá. Lập hợp đồng và chờ GĐKD duyệt trước khi sang Triển Khai.',
    );
    try {
      await this.syncQuoteDeliveryKpi(leadId);
    } catch {
      // Triển Khai đã lưu. Màn KPI gọi lại sync này.
    }
  }

  private ensureDeliveryKpi(): Promise<void> {
    if (!this.deliveryKpiReady) {
      this.deliveryKpiReady = this.db
        .query(
          `CREATE TABLE IF NOT EXISTS crm_quote_delivery_alloc (
             lead_id      BIGINT NOT NULL,
             staff_id     BIGINT NOT NULL REFERENCES crm_staff (id) ON DELETE CASCADE,
             hours        NUMERIC(10, 2) NOT NULL DEFAULT 0,
             task_count   INTEGER NOT NULL DEFAULT 0,
             year         INTEGER NOT NULL,
             month        INTEGER NOT NULL,
             updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             PRIMARY KEY (lead_id, staff_id)
           )`,
        )
        .then(() =>
          this.db.query(
            `INSERT INTO crm_kpi_metrics (code, name, unit, description, sort_order, active, higher_is_better)
             SELECT $1, $2, 'giờ', 'Tổng giờ việc được phân trên báo giá đã Approve.', 900, TRUE, TRUE
             WHERE NOT EXISTS (SELECT 1 FROM crm_kpi_metrics WHERE code = $1)`,
            [QUOTE_DELIVERY_HOURS_CODE, QUOTE_DELIVERY_HOURS_NAME],
          ),
        )
        .then(() => undefined)
        .catch((err) => {
          this.deliveryKpiReady = null;
          throw err;
        });
    }
    return this.deliveryKpiReady;
  }

  async syncQuoteDeliveryKpi(leadId: number): Promise<
    DeliveryKpiSplit & { year: number; month: number; metric_name: string }
  > {
    await this.ensureQuoteCaseColumns();
    await this.ensureDeliveryKpi();
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.quote_approved_at) throw new Error('Báo giá chưa Approve.');
    const approvedAt = new Date(snap.presales.quote_approved_at);
    if (!Number.isFinite(approvedAt.getTime())) throw new Error('Thiếu ngày Approve báo giá.');
    const period = deliveryPeriod(approvedAt);
    const leads = await this.db.query(
      `SELECT id, lead_id
         FROM crm_lead_presales
        WHERE quote_approved_at IS NOT NULL
          AND EXTRACT(YEAR FROM quote_approved_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1
          AND EXTRACT(MONTH FROM quote_approved_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $2`,
      [period.year, period.month],
    );
    await this.db.query(`DELETE FROM crm_quote_delivery_alloc WHERE year = $1 AND month = $2`, [
      period.year,
      period.month,
    ]);
    let current = deliveryKpiFromSheet({ groups: [], included_count: 0 } as unknown as QuoteSheetView);
    for (const row of leads.rows) {
      const rowLeadId = Number(row.lead_id);
      let split = deliveryKpiFromSheet({ groups: [], included_count: 0 } as unknown as QuoteSheetView);
      try {
        split = deliveryKpiFromSheet(await this.assembledQuoteSheet(Number(row.id), false));
      } catch (err) {
        if (rowLeadId === leadId) throw err;
        continue;
      }
      if (rowLeadId === leadId) current = split;
      for (const person of split.people) {
        await this.db.query(
          `INSERT INTO crm_quote_delivery_alloc (lead_id, staff_id, hours, task_count, year, month)
           SELECT $1, s.id, $3, $4, $5, $6
             FROM crm_staff s
            WHERE s.id = $2
           ON CONFLICT (lead_id, staff_id) DO UPDATE
             SET hours = EXCLUDED.hours,
                 task_count = EXCLUDED.task_count,
                 year = EXCLUDED.year,
                 month = EXCLUDED.month,
                 updated_at = NOW()`,
          [rowLeadId, person.staff_id, person.hours, person.tasks.length, period.year, period.month],
        );
      }
    }
    const metric = await this.db.query(`SELECT id FROM crm_kpi_metrics WHERE code = $1 ORDER BY id LIMIT 1`, [
      QUOTE_DELIVERY_HOURS_CODE,
    ]);
    const metricId = Number(metric.rows[0]?.id);
    if (metricId) {
      await this.db.query(
        `INSERT INTO crm_staff_kpi (staff_id, metric_id, year, month, target_value, status, notes)
         SELECT a.staff_id, $1, $2, $3, ROUND(SUM(a.hours), 2), 'on_track',
                'Giờ được phân trên báo giá đã Approve'
           FROM crm_quote_delivery_alloc a
          WHERE a.year = $2 AND a.month = $3
          GROUP BY a.staff_id
         ON CONFLICT (staff_id, metric_id, year, month) DO UPDATE
           SET target_value = EXCLUDED.target_value,
               notes = EXCLUDED.notes,
               updated_at = NOW()`,
        [metricId, period.year, period.month],
      );
      await this.db.query(
        `UPDATE crm_staff_kpi k
            SET target_value = 0, updated_at = NOW()
          WHERE k.metric_id = $1 AND k.year = $2 AND k.month = $3
            AND NOT EXISTS (
              SELECT 1 FROM crm_quote_delivery_alloc a
               WHERE a.staff_id = k.staff_id AND a.year = k.year AND a.month = k.month
            )`,
        [metricId, period.year, period.month],
      );
    }
    return { ...current, year: period.year, month: period.month, metric_name: QUOTE_DELIVERY_HOURS_NAME };
  }

  async createQuoteContract(leadId: number, staffId: number): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.quote_approved_at) {
      throw new Error('Sale chưa Approve báo giá.');
    }
    if (snap.presales.contract_created_at) {
      throw new Error('Hợp đồng đã được tạo.');
    }
    const sheet = await this.assembledQuoteSheet(snap.presales.id, false);
    await this.db.query(
      `UPDATE crm_lead_presales
       SET contract_created_at = NOW(),
           contract_amount_vnd = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id, sheet.grand_total_vnd],
    );
    await this.noteLeadStep(
      leadId,
      staffId,
      'trien_khai',
      `Đã tạo hợp đồng từ báo giá đã Approve. Giá trị ${sheet.grand_total_vnd} đ.`,
    );
  }

  async signQuoteContract(leadId: number, staffId: number): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.contract_created_at) {
      throw new Error('Tạo hợp đồng trước khi ký.');
    }
    if (snap.presales.contract_signed_at) {
      throw new Error('Hợp đồng đã ký.');
    }
    await this.db.query(
      `UPDATE crm_lead_presales
       SET contract_signed_at = NOW(),
           implementation_status = 'ke_hoach',
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id],
    );
    await this.noteLeadStep(leadId, staffId, 'trien_khai', 'Hợp đồng đã ký. Mở kế hoạch triển khai.');
  }

  async getImplementationPlan(leadId: number) {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.contract_signed_at) {
      throw new Error('Kế hoạch triển khai mở sau khi hợp đồng đã ký.');
    }
    const sheet = await this.assembledQuoteSheet(snap.presales.id, false);
    return {
      grand_total_vnd: sheet.grand_total_vnd,
      groups: implementationPlanFromSheet(sheet),
    };
  }

  async requestQuoteEdits(leadId: number, staffId: number, note: string): Promise<void> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.presales.quote_sent_back_at) {
      throw new Error('Chưa có báo giá để yêu cầu chỉnh.');
    }
    if (snap.presales.quote_approved_at) {
      throw new Error('Báo giá đã Approve.');
    }
    const text = note.trim().slice(0, 500);
    if (text.length < 5) {
      throw new Error('Nhập nội dung cần chỉnh, ít nhất 5 ký tự.');
    }
    await this.db.query(
      `UPDATE crm_lead_presales
       SET quote_change_note = $2,
           quote_sent_back_at = NULL,
           quote_due_at = NOW() + ($3::int * INTERVAL '1 hour'),
           quote_ceo_escalated_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [snap.presales.id, text, QUOTE_FINISH_HOURS],
    );
    const status = await this.currentLeadStatus(leadId);
    await this.noteLeadStep(leadId, staffId, status, `Sale yêu cầu chỉnh báo giá: ${text}`);
  }

  private async currentLeadStatus(leadId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT lower(status) AS status FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    return String(result.rows[0]?.status ?? '');
  }

  async hasSolutionHandoffActivity(leadId: number, handedOffAt?: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND activity_type = $2
       LIMIT 1`,
      [leadId, SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff],
    );
    if (result.rows.length) return true;
    return Boolean(String(handedOffAt ?? '').trim());
  }

  async listSolutionQueue(
    statuses: Array<'pending' | 'with_solution'> = ['pending', 'with_solution'],
    limit = 50,
    opts: { ownerStaffId?: number | null; includeAmRework?: boolean } = {},
  ): Promise<SolutionQueueRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const allowed = statuses.filter((s) => s === 'pending' || s === 'with_solution');
    const filterStatuses = allowed.length ? allowed : ['pending', 'with_solution'];
    const ownerId =
      opts.ownerStaffId != null && Number.isFinite(Number(opts.ownerStaffId))
        ? Number(opts.ownerStaffId)
        : null;
    const params: unknown[] = [filterStatuses, lim];
    let ownerClause = '';
    if (ownerId != null) {
      params.push(ownerId);
      ownerClause = ` AND l.owner_id = $${params.length}`;
    }
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id, l.full_name, l.phone, l.owner_id,
              ps.service_slug, ps.stage AS presales_stage, ps.handoff_status,
              COALESCE(ps.handed_off_at::text, '') AS handed_off_at,
              ps.solution_owner_staff_id,
              COALESCE(am.name, '') AS owner_name,
              COALESCE(sol.name, '') AS solution_owner_name,
              'solution'::text AS queue_kind
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       LEFT JOIN crm_staff am ON am.id = l.owner_id
       LEFT JOIN crm_staff sol ON sol.id = ps.solution_owner_staff_id
       WHERE ps.status = 'active'
         AND ps.handoff_status = ANY($1::text[])
         ${ownerClause}
       ORDER BY ps.handed_off_at DESC NULLS LAST, ps.id DESC
       LIMIT $2`,
      params,
    );
    const rows = (result.rows as Array<Record<string, unknown>>).map((row) =>
      this.mapSolutionQueueRow(row),
    );

    if (!opts.includeAmRework || ownerId == null) return rows;

    const rework = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id, l.full_name, l.phone, l.owner_id,
              COALESCE(ps.service_slug, '') AS service_slug,
              COALESCE(ps.stage, 'consult') AS presales_stage,
              COALESCE(ps.handoff_status, '') AS handoff_status,
              COALESCE(ps.handed_off_at::text, l.updated_at::text, '') AS handed_off_at,
              ps.solution_owner_staff_id,
              COALESCE(am.name, '') AS owner_name,
              COALESCE(sol.name, '') AS solution_owner_name,
              'am_rework'::text AS queue_kind
       FROM crm_leads l
       LEFT JOIN crm_lead_presales ps
         ON ps.lead_id = l.sqlite_lead_id AND ps.status = 'active'
       LEFT JOIN crm_staff am ON am.id = l.owner_id
       LEFT JOIN crm_staff sol ON sol.id = ps.solution_owner_staff_id
       WHERE l.owner_id = $1
         AND lower(trim(COALESCE(l.status, ''))) IN ('dang_tu_van', 'da_lien_he', 'moi')
         AND COALESCE(ps.handoff_status, '') NOT IN ('pending', 'with_solution')
         AND EXISTS (
           SELECT 1
           FROM crm_lead_activities a
           WHERE a.lead_id = l.sqlite_lead_id
             AND (
               a.content ILIKE '%trả lại%'
               OR a.content ILIKE '%tra lai%'
               OR a.content ILIKE '%Account Manager%'
               OR a.content ILIKE '%AM trả%'
               OR a.content ILIKE '%AM/%'
             )
         )
       ORDER BY l.updated_at DESC NULLS LAST
       LIMIT $2`,
      [ownerId, lim],
    );
    const seen = new Set(rows.map((r) => r.lead_id));
    for (const row of rework.rows as Array<Record<string, unknown>>) {
      const mapped = this.mapSolutionQueueRow(row);
      if (seen.has(mapped.lead_id)) continue;
      seen.add(mapped.lead_id);
      rows.push(mapped);
    }
    return rows;
  }

  private mapSolutionQueueRow(row: Record<string, unknown>): SolutionQueueRow {
    return {
      lead_id: Number(row.lead_id),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      service_slug: String(row.service_slug ?? ''),
      presales_stage: String(row.presales_stage ?? 'consult') as PresalesRow['stage'],
      handoff_status: normalizeHandoffStatus(row.handoff_status),
      handed_off_at: String(row.handed_off_at ?? ''),
      solution_owner_staff_id:
        row.solution_owner_staff_id != null ? Number(row.solution_owner_staff_id) : null,
      solution_owner_name: String(row.solution_owner_name ?? ''),
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
      owner_name: String(row.owner_name ?? ''),
      queue_kind: row.queue_kind === 'am_rework' ? 'am_rework' : 'solution',
    };
  }
}

function contractDateLabel(value: string | null | undefined): string {
  const text = String(value ?? '').trim();
  const ms = Date.parse(text);
  if (!text || !Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

function leadMetaRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}
