import { BadRequestException } from '@nestjs/common';
import { DeliveryOpsService } from './delivery-ops.service';

describe('DeliveryOpsService.patchRisk', () => {
  it('rejects close without note', async () => {
    const svc = new DeliveryOpsService(
      {
        getRisk: jest.fn().mockResolvedValue({
          id: 'r1',
          project_id: 'p1',
          status: 'open',
          note: null,
        }),
        patchRisk: jest.fn(),
      } as never,
      { getById: jest.fn().mockResolvedValue({ id: 'p1' }) } as never,
    );
    await expect(svc.patchRisk('p1', 'r1', { status: 'closed' })).rejects.toMatchObject({
      response: { error: 'RISK_NOTE_REQUIRED' },
    });
  });

  it('allows close with note', async () => {
    const patched = { id: 'r1', status: 'closed', note: 'Mitigated' };
    const opsRepo = {
      getRisk: jest.fn().mockResolvedValue({ id: 'r1', project_id: 'p1', status: 'open', note: null }),
      patchRisk: jest.fn().mockResolvedValue(patched),
    };
    const svc = new DeliveryOpsService(opsRepo as never, { getById: jest.fn().mockResolvedValue({ id: 'p1' }) } as never);
    await expect(svc.patchRisk('p1', 'r1', { status: 'closed', note: 'Mitigated' })).resolves.toEqual(patched);
  });
});

describe('DeliveryOpsService.createChangeRequest', () => {
  it('creates pending CR when submit=true', async () => {
    const opsRepo = {
      getProjectVersion: jest.fn().mockResolvedValue(2),
      insertChangeRequest: jest.fn().mockResolvedValue({ id: 'cr1', status: 'pending' }),
    };
    const svc = new DeliveryOpsService(opsRepo as never, { getById: jest.fn().mockResolvedValue({ id: 'p1' }) } as never);
    const out = await svc.createChangeRequest(
      'p1',
      { kind: 'budget', payload_json: { delta_pct: 6 }, submit: true },
      9,
    );
    expect(opsRepo.insertChangeRequest).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ kind: 'budget' }),
      9,
      2,
      'pending',
    );
    expect(out.status).toBe('pending');
  });
});
