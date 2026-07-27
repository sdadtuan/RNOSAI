import { OrchestratorCronService } from './orchestrator-cron.service';
import { OrchestratorService } from './orchestrator.service';

describe('OrchestratorCronService', () => {
  const orchestrator = {
    run: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  };
  const upsellContext = {
    listActiveClientIds: jest.fn().mockReturnValue(['client-1', 'client-2']),
  };

  const buildService = (overrides?: {
    orchestratorEnabled?: boolean;
    orchestratorCronEnabled?: boolean;
  }) =>
    new OrchestratorCronService(
      {
        orchestratorEnabled: overrides?.orchestratorEnabled ?? true,
        orchestratorCronEnabled: overrides?.orchestratorCronEnabled ?? true,
      } as never,
      orchestrator as unknown as OrchestratorService,
      upsellContext as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    upsellContext.listActiveClientIds.mockReturnValue(['client-1', 'client-2']);
    orchestrator.run.mockResolvedValue({
      data: { orchestration_id: 'orch-1', status: 'succeeded' },
    });
  });

  it('skips cron when PTT_AI_ORCHESTRATOR_CRON_ENABLED is off', async () => {
    const service = buildService({ orchestratorCronEnabled: false, orchestratorEnabled: true });

    const result = await service.runDailyRetainHealth();

    expect(result).toEqual({ ok: true, skipped: true, reason: 'orchestrator_cron_disabled' });
    expect(orchestrator.run).not.toHaveBeenCalled();
    expect(upsellContext.listActiveClientIds).not.toHaveBeenCalled();
  });

  it('skips cron when PTT_AI_ORCHESTRATOR_ENABLED is off', async () => {
    const service = buildService({ orchestratorCronEnabled: true, orchestratorEnabled: false });

    const result = await service.runDailyRetainHealth();

    expect(result).toEqual({ ok: true, skipped: true, reason: 'orchestrator_disabled' });
    expect(orchestrator.run).not.toHaveBeenCalled();
  });

  it('runs retain_health_v1 for active-contract clients with trigger_type cron', async () => {
    const service = buildService();

    const result = await service.runDailyRetainHealth({
      correlationId: 'retain_health_cron:2026-07-27',
      actorId: 'system',
    });

    expect(result).toMatchObject({
      ok: true,
      plan_key: 'retain_health_v1',
      clients: 2,
      succeeded: 2,
      failed: 0,
    });
    expect(orchestrator.run).toHaveBeenCalledTimes(2);
    expect(orchestrator.run).toHaveBeenCalledWith(
      expect.objectContaining({
        planKey: 'retain_health_v1',
        clientId: 'client-1',
        triggerType: 'cron',
        triggerRef: 'retain_health_cron:2026-07-27',
        actorId: 'system',
        input: expect.objectContaining({
          entityType: 'agency_client',
          entityId: 'client-1',
          clientId: 'client-1',
        }),
      }),
    );
  });

  it('continues batch when one client orchestration fails', async () => {
    orchestrator.run
      .mockRejectedValueOnce(new Error('schema not ready'))
      .mockResolvedValueOnce({ data: { orchestration_id: 'orch-2', status: 'succeeded' } });

    const service = buildService();
    const result = await service.runDailyRetainHealth();

    expect(result).toMatchObject({
      ok: false,
      clients: 2,
      succeeded: 1,
      failed: 1,
      errors: ['client-1: schema not ready'],
    });
  });
});
