import { ForbiddenException } from '@nestjs/common';
import { createOpsContextTools } from './ops-context.tools';
import type { OpsCrmContextService } from '../ops-crm-context.service';
import type { OpsDraftWriteService } from '../ops-draft-write.service';
import type { OpsPlanBreakdownService } from '../ops-plan-breakdown.service';
import type { OpsKpiTargetWriteService } from '../ops-kpi-target-write.service';
import type { OpsStageTransitionService } from '../ops-stage-transition.service';

describe('createOpsContextTools', () => {
  const buildPack = jest.fn(async (tool: string, input: Record<string, unknown>) => ({
    ok: true,
    wired: true,
    phase: 'P2',
    tool,
    input,
  }));
  const context = { buildPack } as unknown as OpsCrmContextService;
  const draftWrite = {
    writeMarketingPlanDraft: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'marketing_plan.write_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { plan_id: 1 },
      links: ['/crm/marketing-plan/1'],
    })),
    createTaskDraft: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'task.create_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { task_id: 2, lifecycle_id: 5 },
      links: ['/crm/service-delivery/5'],
    })),
  } as unknown as OpsDraftWriteService;
  const stageTransition = {
    proposeTransition: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P4',
      status: 'proposed',
      lifecycle_id: 5,
      from_stage: 'onboard',
      to_stage: 'deliver',
      dry_run: true,
      dod_checklist: [],
      blockers: [],
      requires_human_approval: true,
      human_approved: false,
      entity_ids: { lifecycle_id: 5 },
      links: ['/crm/service-delivery/5'],
    })),
  } as unknown as OpsStageTransitionService;
  const planBreakdown = {
    breakdownToRoles: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P5',
      plan_id: 8,
      plan_status: 'active',
      persist_tasks: false,
      persist_kpis: false,
      matrix: [],
      task_ids: [],
      kpi_target_ids: [],
      known: [],
      assumed: [],
      unknown: [],
      links: ['/crm/marketing-plan/8'],
    })),
  } as unknown as OpsPlanBreakdownService;
  const kpiTargetWrite = {
    writeDraft: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P5-KPI',
      status: 'persisted',
      kpi_target_id: 101,
      role_key: 'content',
      kpi_key: 'posts_shipped',
      kpi_status: 'draft',
      links: ['/crm/kpi-hub/role-kpi?plan_id=8'],
    })),
    read: jest.fn(async () => ({
      ok: true,
      wired: true,
      phase: 'P5-KPI',
      tool: 'kpi_target.read',
      rows: [],
      known: [],
      assumed: [],
      unknown: [],
      links: [],
    })),
  } as unknown as OpsKpiTargetWriteService;
  const tools = createOpsContextTools(
    context,
    draftWrite,
    stageTransition,
    planBreakdown,
    kpiTargetWrite,
  );
  const byName = new Map(tools.map((t) => [t.name, t]));

  beforeEach(() => {
    buildPack.mockClear();
    (draftWrite.writeMarketingPlanDraft as jest.Mock).mockClear();
    (draftWrite.createTaskDraft as jest.Mock).mockClear();
    (stageTransition.proposeTransition as jest.Mock).mockClear();
    (planBreakdown.breakdownToRoles as jest.Mock).mockClear();
    (kpiTargetWrite.writeDraft as jest.Mock).mockClear();
    (kpiTargetWrite.read as jest.Mock).mockClear();
  });

  it('registers PO-52 allowlist tools including P4/P5/KPI', () => {
    expect([...byName.keys()].sort()).toEqual(
      [
        'delivery_project.read',
        'kpi_campaign.read',
        'kpi_target.read',
        'kpi_target.write_draft',
        'marketing_plan.read',
        'marketing_plan.write_draft',
        'plan.breakdown_to_roles',
        'service_delivery.propose_transition',
        'service_delivery.read',
        'task.create_draft',
      ].sort(),
    );
  });

  it('read tools call CrmContextPack builder', async () => {
    const tool = byName.get('marketing_plan.read')!;
    const out = (await tool.handler(
      { plan_id: 6 },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
      },
    )) as { wired: boolean; tool: string };
    expect(buildPack).toHaveBeenCalledWith('marketing_plan.read', { plan_id: 6 });
    expect(out.wired).toBe(true);
    expect(out.tool).toBe('marketing_plan.read');
  });

  it('write draft requires human approval', async () => {
    const tool = byName.get('marketing_plan.write_draft')!;
    await expect(
      tool.handler(
        { client_id: 'c1', title: 'Q4' },
        {
          apiKeyId: 'k',
          clientId: 'c1',
          actorId: 'a',
          correlationId: 'r',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(draftWrite.writeMarketingPlanDraft).not.toHaveBeenCalled();
  });

  it('write draft persists when human approved', async () => {
    const tool = byName.get('marketing_plan.write_draft')!;
    const out = (await tool.handler(
      { title: 'Q4' },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
        humanApproved: true,
      },
    )) as { ok: boolean; wired: boolean; phase: string; status: string };
    expect(draftWrite.writeMarketingPlanDraft).toHaveBeenCalled();
    expect(out).toMatchObject({ wired: true, phase: 'P3', status: 'persisted' });
  });

  it('task.create_draft persists when human approved', async () => {
    const tool = byName.get('task.create_draft')!;
    const out = (await tool.handler(
      { title: 'Kickoff', lifecycle_id: 5 },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
        humanApproved: true,
      },
    )) as { entity_ids: Record<string, number> };
    expect(draftWrite.createTaskDraft).toHaveBeenCalled();
    expect(out.entity_ids).toEqual({ task_id: 2, lifecycle_id: 5 });
  });

  it('propose_transition dry_run does not require human approval at tool gate', async () => {
    const tool = byName.get('service_delivery.propose_transition')!;
    const out = (await tool.handler(
      { lifecycle_id: 5, dry_run: true },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
      },
    )) as { phase: string; status: string };
    expect(stageTransition.proposeTransition).toHaveBeenCalledWith(
      { lifecycle_id: 5, dry_run: true },
      expect.objectContaining({ actor: 'a' }),
      { humanApproved: false },
    );
    expect(out).toMatchObject({ phase: 'P4', status: 'proposed' });
  });

  it('plan.breakdown_to_roles dry-run does not require human approval at tool gate', async () => {
    const tool = byName.get('plan.breakdown_to_roles')!;
    const out = (await tool.handler(
      { plan_id: 8, persist_tasks: false },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
      },
    )) as { phase: string; persist_tasks: boolean };
    expect(planBreakdown.breakdownToRoles).toHaveBeenCalledWith(
      { plan_id: 8, persist_tasks: false },
      expect.objectContaining({ actor: 'a' }),
      { humanApproved: false },
    );
    expect(out).toMatchObject({ phase: 'P5', persist_tasks: false });
  });
});
