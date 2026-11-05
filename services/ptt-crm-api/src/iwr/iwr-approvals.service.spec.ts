import { ForbiddenException } from '@nestjs/common';
import { IwrApprovalsService } from './iwr-approvals.service';
import type { IwrActor } from './iwr.types';

describe('IwrApprovalsService', () => {
  const actor: IwrActor = {
    staffId: 1,
    staffLabel: 'Req',
    departmentId: null,
    caps: [{ section: 'iwr', action: 'view' }],
  };

  it('decide rejects non-approver without manage', async () => {
    const repo = {
      getApproval: jest.fn().mockResolvedValue({
        id: 'a1',
        report_id: 'r1',
        kind: 'budget',
        requester_staff_id: 1,
        approver_staff_id: 2,
        status: 'pending',
        payload_json: {},
        decided_at: null,
        decided_by_staff_id: null,
        decision_note: null,
        created_at: '2026-09-01',
      }),
      decideApproval: jest.fn(),
    };
    const reports = { get: jest.fn() };
    const svc = new IwrApprovalsService(repo as never, reports as never);
    await expect(
      svc.decide(actor, 'a1', { status: 'approved' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
