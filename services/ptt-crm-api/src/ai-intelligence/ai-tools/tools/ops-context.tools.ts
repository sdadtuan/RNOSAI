import { ForbiddenException } from '@nestjs/common';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';
import { OpsCrmContextService } from '../ops-crm-context.service';
import { OpsDraftWriteService } from '../ops-draft-write.service';
import { OpsPlanBreakdownService } from '../ops-plan-breakdown.service';
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

/** SRS-PTT-Ops-Module PO-52 tools — P2–P5 (reads, drafts, stage propose, plan breakdown). */
export function createOpsContextTools(
  context: OpsCrmContextService,
  draftWrite: OpsDraftWriteService,
  stageTransition: OpsStageTransitionService,
  planBreakdown: OpsPlanBreakdownService,
): AiToolDefinition[] {
  return [
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
        'Create a task draft linked to plan/delivery (requires human approval header).',
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
  ];
}
