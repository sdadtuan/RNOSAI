import { createOpsContextTools } from './ops-context.tools';
import type { OpsCrmContextService } from '../ops-crm-context.service';

describe('createOpsContextTools', () => {
  const buildPack = jest.fn(async (tool: string, input: Record<string, unknown>) => ({
    ok: true,
    wired: true,
    phase: 'P2',
    tool,
    input,
  }));
  const context = { buildPack } as unknown as OpsCrmContextService;
  const tools = createOpsContextTools(context);
  const byName = new Map(tools.map((t) => [t.name, t]));

  beforeEach(() => {
    buildPack.mockClear();
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
    ).rejects.toMatchObject({
      response: { error: 'human_approval_required' },
    });
  });

  it('write draft succeeds when human approved', async () => {
    const tool = byName.get('task.create_draft')!;
    const out = (await tool.handler(
      { title: 'Kickoff' },
      {
        apiKeyId: 'k',
        clientId: null,
        actorId: 'a',
        correlationId: 'r',
        humanApproved: true,
      },
    )) as { ok: boolean; human_approved: boolean };
    expect(out.ok).toBe(true);
    expect(out.human_approved).toBe(true);
  });
});
