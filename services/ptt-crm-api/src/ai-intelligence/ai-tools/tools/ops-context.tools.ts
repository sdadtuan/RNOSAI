import { ForbiddenException } from '@nestjs/common';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';
import { OpsCrmContextService } from '../ops-crm-context.service';
import { OpsDraftWriteService } from '../ops-draft-write.service';
import { OpsInsightDraftService } from '../ops-insight-draft.service';
import { OpsInsightApproveService } from '../ops-insight-approve.service';
import { OpsKpiTargetWriteService } from '../ops-kpi-target-write.service';
import { OpsPlanBreakdownService } from '../ops-plan-breakdown.service';
import { OpsPlanGenerateReviewService } from '../ops-plan-generate-review.service';
import { OpsPresalesAutofillService } from '../ops-presales-autofill.service';
import { OpsPresalesContextService } from '../ops-presales-context.service';
import { OpsConsultDraftService } from '../ops-consult-draft.service';
import { OpsProposalDraftService } from '../ops-proposal-draft.service';
import { OpsReturnToAmService } from '../ops-return-to-am.service';
import { OpsServiceRecommendService } from '../ops-service-recommend.service';
import { OpsStageTransitionService } from '../ops-stage-transition.service';

function assertHumanApprovedForWrite(
  tool: string,
  context: AiToolExecutionContext,
): void {
  if (context.humanApproved) return;
  throw new ForbiddenException({
    error: 'human_approval_required',
    tool_name: tool,
    message:
      'Write draft requires human approval (X-AI-Human-Approved: 1) per SRS PO-51/PO-52.',
  });
}

function writeMeta(ctx: AiToolExecutionContext) {
  return {
    actor: String(ctx.actorId ?? ctx.apiKeyId ?? 'ai-tool'),
    approvedAt: new Date().toISOString(),
  };
}

const contextIdSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    client_id: { type: 'string' },
    lifecycle_id: { type: 'integer', minimum: 1 },
    plan_id: { type: 'integer', minimum: 1 },
    project_id: { type: 'string' },
  },
};

/** SRS-PTT-Ops-Module PO-52 tools — P2–P8. */
export function createOpsContextTools(
  context: OpsCrmContextService,
  draftWrite: OpsDraftWriteService,
  stageTransition: OpsStageTransitionService,
  planBreakdown: OpsPlanBreakdownService,
  kpiTargetWrite: OpsKpiTargetWriteService,
  presalesContext?: OpsPresalesContextService,
  autofill?: OpsPresalesAutofillService,
  insightDraft?: OpsInsightDraftService,
  planReview?: OpsPlanGenerateReviewService,
  serviceRecommend?: OpsServiceRecommendService,
  consultDraft?: OpsConsultDraftService,
  returnToAm?: OpsReturnToAmService,
  proposalDraft?: OpsProposalDraftService,
  insightApprove?: OpsInsightApproveService,
): AiToolDefinition[] {
  return [
    {
      name: 'presales.context.read',
      description:
        'Read presales context pack (TMMT, BANT, L2 Ads, contract, proposal gaps, approved insights, hub campaign map, consult_ready, winning_plan_ready). Non-mutating. P6/P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          client_id: { type: 'string' },
          lifecycle_id: { type: 'integer', minimum: 1 },
          plan_id: { type: 'integer', minimum: 1 },
          lead_id: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_leads.view'],
      handler: async (input) => {
        if (!presalesContext) {
          throw new ForbiddenException({ error: 'presales_context_unavailable' });
        }
        return presalesContext.buildPack(input);
      },
    },
    {
      name: 'service.recommend_from_signals',
      description:
        'Recommend primary+alternate+menu services from industry/utterance/CRM signals. Writes recommended_draft only — never selected. Human approval. P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lead_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          signals: { type: 'object' },
          dry_run: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!serviceRecommend) {
          throw new ForbiddenException({ error: 'service_recommend_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('service.recommend_from_signals', ctx);
        }
        return serviceRecommend.recommend(input);
      },
    },
    {
      name: 'consult.draft_from_research',
      description:
        'Draft Need/Pain + Consult ICP/Đối tượng mục tiêu as assumed_draft from research/CRM/SKU. No fee fabrication. Human approval. P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lead_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          overwrite_mode: { type: 'string' },
          include_web_research: { type: 'boolean' },
          dry_run: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!consultDraft) {
          throw new ForbiddenException({ error: 'consult_draft_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('consult.draft_from_research', ctx);
        }
        return consultDraft.draftFromResearch(input, writeMeta(ctx).actor);
      },
    },
    {
      name: 'presales.return_to_am',
      description:
        'Flag needs_am_rework with blockers when pain/service unknown or assumed rejected. In-app only (no email). dry_run=true previews without writing. Human approval when mutating. P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lead_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          reason_codes: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
          assignee_user_id: { type: 'integer', minimum: 1 },
          dry_run: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!returnToAm) {
          throw new ForbiddenException({ error: 'return_to_am_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('presales.return_to_am', ctx);
        }
        return returnToAm.returnToAm(input);
      },
    },
    {
      name: 'proposal.draft_from_consult',
      description:
        'Create proposal draft from Consult (never send). Watermark CHƯA CONFIRM if pain unconfirmed. Human approval. P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lead_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          dry_run: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!proposalDraft) {
          throw new ForbiddenException({ error: 'proposal_draft_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('proposal.draft_from_consult', ctx);
        }
        return proposalDraft.draftFromConsult(input, writeMeta(ctx).actor);
      },
    },
    {
      name: 'presales.autofill_tmmt',
      description:
        'Fill empty TMMT fields from Consult/BANT/L2/contract (fill_empty_only default). Maps Đối tượng mục tiêu→segmentation_icp, Need/Pain→pains_desired_outcomes. Human approval. Never fakes gate_passed. P7/P8.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lifecycle_id: { type: 'integer', minimum: 1 },
          lead_id: { type: 'integer', minimum: 1 },
          overwrite_mode: { type: 'string' },
          dry_run: { type: 'boolean' },
          include_upload_file_ids: { type: 'array', items: { type: 'integer' } },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!autofill) {
          throw new ForbiddenException({ error: 'presales_autofill_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('presales.autofill_tmmt', ctx);
        }
        return autofill.autofill(input);
      },
    },
    {
      name: 'insight.draft_from_presales',
      description:
        'Create a pending_review research insight from presales pack. Cannot approve. Human approval required. P7.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lifecycle_id: { type: 'integer', minimum: 1 },
          client_id: { type: 'string' },
          plan_id: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          dry_run: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!insightDraft) {
          throw new ForbiddenException({ error: 'insight_draft_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('insight.draft_from_presales', ctx);
        }
        return insightDraft.draftFromPresales(input, writeMeta(ctx).actor);
      },
    },
    {
      name: 'insight.approve',
      description:
        'Approve an ai_generated P7 insight to approved_internal (WinningPlanGate). Requires X-AI-Human-Approved. dry_run supported. P7.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          insight_id: { type: 'integer', minimum: 1 },
          target_status: { type: 'string' },
          comments: { type: 'string' },
          dry_run: { type: 'boolean' },
        },
        required: ['insight_id'],
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!insightApprove) {
          throw new ForbiddenException({ error: 'insight_approve_unavailable' });
        }
        if (!Boolean(input.dry_run ?? input.dryRun)) {
          assertHumanApprovedForWrite('insight.approve', ctx);
        }
        return insightApprove.approve(input, writeMeta(ctx).actor);
      },
    },
    {
      name: 'marketing_plan.generate_review',
      description:
        'Create marketing plan status=review from presales (soft-allow when WinningPlanGate fails; embed blockers). Never active. Human approval. P7.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lifecycle_id: { type: 'integer', minimum: 1 },
          plan_id: { type: 'integer', minimum: 1 },
          clone_from_plan_id: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          supersede: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        if (!planReview) {
          throw new ForbiddenException({ error: 'plan_generate_review_unavailable' });
        }
        assertHumanApprovedForWrite('marketing_plan.generate_review', ctx);
        return planReview.generateReview(input, writeMeta(ctx).actor);
      },
    },
    {
      name: 'marketing_plan.read',
      description: 'Read marketing plan context for a client (CrmContextPack).',
      inputSchema: contextIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_leads.view'],
      handler: async (input) => context.buildPack('marketing_plan.read', input),
    },
    {
      name: 'service_delivery.read',
      description: 'Read service delivery board/detail for a client (CrmContextPack).',
      inputSchema: contextIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_service_lifecycle.view'],
      handler: async (input) => context.buildPack('service_delivery.read', input),
    },
    {
      name: 'delivery_project.read',
      description: 'Read delivery project health and milestones (CrmContextPack).',
      inputSchema: contextIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_service_lifecycle.view'],
      handler: async (input) => context.buildPack('delivery_project.read', input),
    },
    {
      name: 'kpi_campaign.read',
      description: 'Read campaign KPI quoted vs actual (CrmContextPack).',
      inputSchema: contextIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_kpi.view'],
      handler: async (input) => context.buildPack('kpi_campaign.read', input),
    },
    {
      name: 'marketing_plan.write_draft',
      description:
        'Create or update a marketing plan draft (requires human approval header).',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          client_id: { type: 'string' },
          plan_id: { type: 'integer', minimum: 1 },
          clone_to_draft: { type: 'boolean' },
          title: { type: 'string' },
          period: { type: 'string' },
          objectives: { type: 'string' },
          notes: { type: 'string' },
          lifecycle_id: { type: 'integer', minimum: 1 },
          project_id: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('marketing_plan.write_draft', ctx);
        return draftWrite.writeMarketingPlanDraft(input, writeMeta(ctx));
      },
    },
    {
      name: 'task.create_draft',
      description:
        'Create a task draft linked to plan/delivery (requires human approval header). Supports assignee/owner, priority, due_date.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          client_id: { type: 'string' },
          title: { type: 'string' },
          acceptance_criteria: { type: 'string' },
          lifecycle_id: { type: 'integer', minimum: 1 },
          plan_id: { type: 'integer', minimum: 1 },
          project_id: { type: 'string' },
          campaign_id: {},
          assignee: { type: 'string' },
          owner: { type: 'string' },
          assignee_staff_id: { type: 'integer', minimum: 1 },
          priority: { type: 'string' },
          due_date: { type: 'string' },
          due_in_days: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('task.create_draft', ctx);
        return draftWrite.createTaskDraft(input, writeMeta(ctx));
      },
    },
    {
      name: 'task.update_draft',
      description:
        'Update a svc task draft: title, acceptance_criteria, assignee/owner, priority, due_date (stored in form_data). Requires human approval.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['task_id'],
        properties: {
          task_id: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          acceptance_criteria: { type: 'string' },
          assignee: { type: 'string' },
          owner: { type: 'string' },
          assignee_staff_id: { type: 'integer', minimum: 1 },
          priority: { type: 'string' },
          due_date: { type: 'string' },
          due_in_days: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('task.update_draft', ctx);
        return draftWrite.updateTaskDraft(input, writeMeta(ctx));
      },
    },
    {
      name: 'service_delivery.propose_transition',
      description:
        'Propose (dry_run default) or apply a forward-only service delivery stage transition. Apply requires human approval; force/skip/backward forbidden.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['lifecycle_id'],
        properties: {
          lifecycle_id: { type: 'integer', minimum: 1 },
          to_stage: { type: 'string' },
          dry_run: { type: 'boolean' },
          notes: { type: 'string' },
          force: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_service_lifecycle.edit'],
      handler: async (input, ctx) =>
        stageTransition.proposeTransition(input, writeMeta(ctx), {
          humanApproved: Boolean(ctx.humanApproved),
        }),
    },
    {
      name: 'plan.breakdown_to_roles',
      description:
        'Break an approved marketing plan into a role KPI matrix (dry-run default). Optionally persist task drafts via task.create_draft (requires human approval).',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['plan_id'],
        properties: {
          plan_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          persist_tasks: { type: 'boolean' },
          persist_kpis: { type: 'boolean' },
          allow_review: { type: 'boolean' },
          roles: {
            type: 'array',
            items: { type: 'string' },
          },
          due_in_days: { type: 'integer', minimum: 1 },
          owner_map: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) =>
        planBreakdown.breakdownToRoles(input, writeMeta(ctx), {
          humanApproved: Boolean(ctx.humanApproved),
        }),
    },
    {
      name: 'kpi_target.write_draft',
      description:
        'Create/update Role KPI target drafts (never sets actual or approved). Requires human approval.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'integer', minimum: 1 },
          plan_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          client_id: { type: 'string' },
          campaign_id: { type: 'integer', minimum: 1 },
          role_key: { type: 'string' },
          kpi_key: { type: 'string' },
          kpi_label: { type: 'string' },
          period_start: { type: 'string' },
          period_end: { type: 'string' },
          target_value: {},
          target_unit: { type: 'string' },
          owner_staff_id: { type: 'string' },
          notes: { type: 'string' },
          upsert_key: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_kpi_hub.view'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('kpi_target.write_draft', ctx);
        return kpiTargetWrite.writeDraft(input, writeMeta(ctx), {
          humanApproved: true,
        });
      },
    },
    {
      name: 'kpi_target.read',
      description: 'Read Role KPI targets filtered by plan/lifecycle/role/status.',
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          plan_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          client_id: { type: 'string' },
          role_key: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_kpi_hub.view'],
      handler: async (input) => kpiTargetWrite.read(input),
    },
  ];
}
