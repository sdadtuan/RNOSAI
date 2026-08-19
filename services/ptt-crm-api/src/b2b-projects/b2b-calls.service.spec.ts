import { B2bCallsService } from './b2b-calls.service';
import { B2bCpaasDownError } from './b2b-calls.types';

describe('B2bCallsService', () => {
  it('answered marks first-touch via repository', async () => {
    const repo = {
      insertSession: jest.fn(async () => ({ id: 's1', leadId: 1, staffId: 10, state: 'queued', kind: 'human', provider: 'mock', providerCallId: null })),
      attachProviderCallId: jest.fn(),
      updateState: jest.fn(),
      findByProviderCallId: jest.fn(async () => ({
        id: 's1',
        leadId: 1,
        staffId: 10,
        state: 'ringing',
        kind: 'human',
        provider: 'mock',
        providerCallId: 'mock-s1',
      })),
      markLeadAnswered: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'mock' } as never);
    await svc.applyWebhook({ providerCallId: 'mock-s1', state: 'answered' });
    expect(repo.updateState).toHaveBeenCalledWith(expect.objectContaining({ state: 'answered' }));
    expect(repo.markLeadAnswered).toHaveBeenCalledWith(1);
  });

  it('cpaas down surfaces tel fallback', async () => {
    const repo = {
      insertSession: jest.fn(async () => ({ id: 's1', leadId: 1, staffId: 10, state: 'queued', kind: 'human', provider: 'down', providerCallId: null })),
      attachProviderCallId: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'down' } as never);
    await expect(
      svc.startHumanCall({ leadId: 1, staffId: 10, phone: '090' }),
    ).rejects.toMatchObject({ code: 'cpaas_down' });
  });
});
