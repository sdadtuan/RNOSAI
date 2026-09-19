import { ForbiddenException } from '@nestjs/common';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';

function emptyContextPack(tool: string, input: Record<string, unknown>) {
  return {
    source: 'ptt-crm',
    as_of: new Date().toISOString(),
    tool,
    wired: false,
    phase: 'P1',
    client: {
      id: String(input.client_id ?? input.clientId ?? ''),
      name: '',
      lifecycle: '',
    },
    marketing_plan: { id: '', status: '', period: '', milestones: [] },
    service_delivery: { id: '', stage: '', open_tasks: [], health: '' },
    campaigns: [],
    known: [],
    assumed: [],
    unknown: [
      'Live CrmContextPack wiring ships in P2 — catalog/policy/API are enabled.',
    ],
    links: [],
    ok: true,
  };
}

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

const clientIdSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    client_id: { type: 'string' },
  },
};

/** SRS-PTT-Ops-Module PO-52 tools (P1 stubs; live pack = P2). */
export function createOpsContextTools(): AiToolDefinition[] {
  return [
    {
      name: 'marketing_plan.read',
      description: 'Read marketing plan context for a client (CrmContextPack slice).',
      inputSchema: clientIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_leads.view'],
      handler: async (input) => emptyContextPack('marketing_plan.read', input),
    },
    {
      name: 'service_delivery.read',
      description: 'Read service delivery board/detail for a client.',
      inputSchema: clientIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_service_lifecycle.view'],
      handler: async (input) => emptyContextPack('service_delivery.read', input),
    },
    {
      name: 'delivery_project.read',
      description: 'Read delivery project health and milestones.',
      inputSchema: clientIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_service_lifecycle.view'],
      handler: async (input) => emptyContextPack('delivery_project.read', input),
    },
    {
      name: 'kpi_campaign.read',
      description: 'Read campaign KPI quoted vs actual for a client/period.',
      inputSchema: clientIdSchema,
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_kpi.view'],
      handler: async (input) => emptyContextPack('kpi_campaign.read', input),
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
      handler: async (input, context) => {
        assertHumanApprovedForWrite('marketing_plan.write_draft', context);
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
      handler: async (input, context) => {
        assertHumanApprovedForWrite('task.create_draft', context);
        return draftResult('task.create_draft', input);
      },
    },
  ];
}
