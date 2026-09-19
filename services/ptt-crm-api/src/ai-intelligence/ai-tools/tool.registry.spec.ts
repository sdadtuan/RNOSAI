import { ForbiddenException } from '@nestjs/common';
import { AI_USE_CASE } from '../ai-audit.constants';
import { ToolRegistry } from './tool.registry';

describe('ToolRegistry', () => {
  const audit = {
    wrap: jest.fn(async (ctx, fn) => {
      const result = await fn({ runId: '', requestId: ctx.correlationId ?? 'request-1' });
      return {
        data: result.data,
        runId: 'tool-run-1',
        requestId: ctx.correlationId ?? 'request-1',
        latencyMs: 1,
      };
    }),
  };
  const agents = { get: jest.fn() };
  const leads = { listLeads: jest.fn(), getLeadById: jest.fn() };
  const b2bAi = {
    resolveListScope: jest.fn(),
    assertLeadVisible: jest.fn(),
  };
  const forecast = { getDashboard: jest.fn() };
  const orchestrator = { run: jest.fn(), list: jest.fn() };
  const opsContext = {
    buildPack: jest.fn(async (tool: string) => ({
      ok: true,
      wired: true,
      tool,
      phase: 'P2',
    })),
  };
  const draftWrite = {
    writeMarketingPlanDraft: jest.fn(),
    createTaskDraft: jest.fn(),
  };
  const stageTransition = {
    proposeTransition: jest.fn(),
  };

  let registry: ToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry(
      audit as never,
      agents as never,
      leads as never,
      b2bAi as never,
      forecast as never,
      orchestrator as never,
      opsContext as never,
      draftWrite as never,
      stageTransition as never,
    );
  });

  it('lists RNOS-33 tools plus Ops PO-52/P4 tools', () => {
    const tools = registry.list();

    expect(tools).toHaveLength(17);
    expect(tools.map((tool) => tool.name)).toEqual([
      'score_lead',
      'route_lead',
      'list_leads',
      'get_lead',
      'get_forecast_snapshot',
      'suggest_upsell',
      'get_anomaly_digest',
      'run_orchestration',
      'list_orchestrations',
      'health_check',
      'marketing_plan.read',
      'service_delivery.read',
      'delivery_project.read',
      'kpi_campaign.read',
      'marketing_plan.write_draft',
      'task.create_draft',
      'service_delivery.propose_transition',
    ]);
    expect(tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
    expect(tools.map((t) => t.name)).not.toEqual(
      expect.arrayContaining(['email.send', 'proposal.send', 'stage.transition']),
    );
  });

  it('denies PO-53 banned tools even if named in allowlist', async () => {
    await expect(
      registry.call(
        'email.send',
        {},
        {
          apiKey: {
            id: 'key-1',
            client_id: null,
            allowed_tools: ['email.send'],
          },
        },
      ),
    ).rejects.toMatchObject({
      response: { error: 'tool_denied_by_policy', tool_name: 'email.send' },
    });
  });

  it('throws 403 when the API key does not allow the requested tool', async () => {
    expect.assertions(3);

    try {
      await registry.call(
        'score_lead',
        { lead_id: 42 },
        {
          apiKey: { id: 'key-1', client_id: 'client-1', allowed_tools: ['health_check'] },
          actorId: 'external-agent',
        },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({
          error: 'tool_not_allowed',
          tool_name: 'score_lead',
        }),
      );
    }
  });

  it('audits an allowed call as ai-tool-proxy TOOL_CALL', async () => {
    const result = await registry.call(
      'health_check',
      {},
      {
        apiKey: { id: 'key-1', client_id: null, allowed_tools: ['health_check'] },
        actorId: 'external-agent',
        correlationId: 'corr-1',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
    expect(audit.wrap).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'ai-tool-proxy',
        useCase: AI_USE_CASE.TOOL_CALL,
        actorId: 'external-agent',
        correlationId: 'corr-1',
        input: { tool_name: 'health_check' },
      }),
      expect.any(Function),
    );
  });

  it('exposes the audit run id for API call-log linkage', async () => {
    await expect(
      registry.callWithMetadata(
        'health_check',
        {},
        {
          apiKey: { id: 'key-1', client_id: null, allowed_tools: ['health_check'] },
          actorId: 'external-agent',
        },
      ),
    ).resolves.toEqual({
      data: expect.objectContaining({ status: 'ok' }),
      runId: 'tool-run-1',
    });
  });
});
