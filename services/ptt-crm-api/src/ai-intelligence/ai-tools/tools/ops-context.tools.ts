import { ForbiddenException } from '@nestjs/common';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';
import { OpsCrmContextService } from '../ops-crm-context.service';

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

function draftResult(tool: string, input: Record<string, unknown>) {
  return {
    ok: true,
    wired: false,
    phase: 'P1',
    status: 'draft_accepted_pending_persist',
    tool,
    requires_human_approval: true,
    human_approved: true,
    input,
    hint: 'P3 will persist Marketing Plan / task draft to CRM.',
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

/** SRS-PTT-Ops-Module PO-52 tools — P2 live CrmContextPack reads. */
export function createOpsContextTools(context: OpsCrmContextService): AiToolDefinition[] {
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
          title: { type: 'string' },
          period: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('marketing_plan.write_draft', ctx);
        return draftResult('marketing_plan.write_draft', input);
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
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.edit'],
      handler: async (input, ctx) => {
        assertHumanApprovedForWrite('task.create_draft', ctx);
        return draftResult('task.create_draft', input);
      },
    },
  ];
}
