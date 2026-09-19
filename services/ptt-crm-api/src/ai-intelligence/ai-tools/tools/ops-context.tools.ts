import { ForbiddenException } from '@nestjs/common';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';
import { OpsCrmContextService } from '../ops-crm-context.service';
import { OpsDraftWriteService } from '../ops-draft-write.service';

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

/** SRS-PTT-Ops-Module PO-52 tools — P2 reads + P3 draft writes. */
export function createOpsContextTools(
  context: OpsCrmContextService,
  draftWrite: OpsDraftWriteService,
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
  ];
}
