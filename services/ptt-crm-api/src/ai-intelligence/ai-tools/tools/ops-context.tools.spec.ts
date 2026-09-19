import { ForbiddenException } from '@nestjs/common';
import { createOpsContextTools } from './ops-context.tools';
import type { OpsCrmContextService } from '../ops-crm-context.service';
import type { OpsDraftWriteService } from '../ops-draft-write.service';

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
  const tools = createOpsContextTools(context, draftWrite);
  const byName = new Map(tools.map((t) => [t.name, t]));

  beforeEach(() => {
    buildPack.mockClear();
    (draftWrite.writeMarketingPlanDraft as jest.Mock).mockClear();
    (draftWrite.createTaskDraft as jest.Mock).mockClear();
  });

  it('registers PO-52 allowlist tools', () => {
    expect([...byName.keys()].sort()).toEqual(
      [
        'delivery_project.read',
        'kpi_campaign.read',
        'marketing_plan.read',
        'marketing_plan.write_draft',
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
});
