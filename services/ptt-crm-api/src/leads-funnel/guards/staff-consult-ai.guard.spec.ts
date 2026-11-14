import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { canGenerateConsultAi, StaffConsultAiGenerateGuard } from './staff-consult-ai.guard';
import { StaffPresalesSolutionReleaseGuard } from './staff-presales-solution.guard';
import {
  canUseAssignedSolutionAction,
  pickSolutionAssignee,
} from '../solution-assignee-access.util';

describe('canGenerateConsultAi (legacy cap helper)', () => {
  it('requires generate plus consult or board edit', () => {
    expect(
      canGenerateConsultAi([
        { section: 'crm_presales_solution', action: 'edit' },
        { section: 'crm_mkt_ai', action: 'generate' },
      ]),
    ).toBe(true);
    expect(canGenerateConsultAi([{ section: 'crm_presales_solution', action: 'edit' }])).toBe(false);
  });
});

describe('canUseAssignedSolutionAction', () => {
  it('allows an AM in the pool who is assigned', () => {
    expect(canUseAssignedSolutionAction({ staffId: 7, assigneeStaffId: 7, isAccountManager: true })).toBe(true);
  });
  it('allows a ticked (Nhận Solution) non-AM who is assigned', () => {
    expect(canUseAssignedSolutionAction({ staffId: 8, assigneeStaffId: 8, canReceiveSolution: true })).toBe(true);
  });
  it('denies an AM who is not assigned to this lead', () => {
    expect(canUseAssignedSolutionAction({ staffId: 9, assigneeStaffId: 7, isAccountManager: true })).toBe(false);
  });
  it('denies a ticked person who is not assigned', () => {
    expect(canUseAssignedSolutionAction({ staffId: 9, assigneeStaffId: 8, canReceiveSolution: true })).toBe(false);
  });
  it('denies an assigned person outside the pool (not AM, not ticked)', () => {
    expect(canUseAssignedSolutionAction({ staffId: 5, assigneeStaffId: 5 })).toBe(false);
  });
  it('denies when no one is assigned', () => {
    expect(canUseAssignedSolutionAction({ staffId: 7, assigneeStaffId: null, isAccountManager: true })).toBe(false);
  });
  it('allows SUPER-ADMIN regardless of assignment', () => {
    expect(canUseAssignedSolutionAction({ isSuperAdmin: true, staffId: 1, assigneeStaffId: null })).toBe(true);
  });
});

describe('pickSolutionAssignee', () => {
  it('uses assigned_am once it points at a pool member', () => {
    expect(pickSolutionAssignee({ assignedAm: 7, solutionOwnerStaffId: 3, assignedAmInPool: true })).toBe(7);
  });
  it('falls back to solution_owner_staff_id while assigned_am is still the Sales owner', () => {
    expect(pickSolutionAssignee({ assignedAm: 3, solutionOwnerStaffId: 7, assignedAmInPool: false })).toBe(7);
  });
  it('returns null when nothing is set', () => {
    expect(pickSolutionAssignee({ assignedAm: null, solutionOwnerStaffId: null, assignedAmInPool: false })).toBeNull();
  });
});

type Who = { staffId: number; superAdmin?: boolean; position?: string; ticked?: boolean };

function ctx(leadId = 121): ExecutionContext {
  const req = { staffAuthVia: 'jwt', staffUser: { sub: 'x', email: 'x@ptt.vn' }, params: { id: String(leadId) } };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function deps(who: Who, assignee: number | null) {
  const staffAuth = {
    isSuperAdminUser: jest.fn().mockResolvedValue(Boolean(who.superAdmin)),
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(who.staffId),
    me: jest.fn().mockResolvedValue({ caps: [], position_code: who.position ?? 'ae' }),
    canReceiveSolution: jest.fn().mockResolvedValue(Boolean(who.ticked)),
  };
  const leadPg = { solutionAssigneeStaffId: jest.fn().mockResolvedValue(assignee) };
  return { staffAuth, leadPg };
}

describe.each([
  ['StaffConsultAiGenerateGuard', (a: never, b: never) => new StaffConsultAiGenerateGuard(a, b)],
  ['StaffPresalesSolutionReleaseGuard', (a: never, b: never) => new StaffPresalesSolutionReleaseGuard(a, b)],
])('%s', (_name, make) => {
  it('allows the assigned AM in the pool', async () => {
    const d = deps({ staffId: 7, position: 'acm' }, 7);
    await expect(make(d.staffAuth as never, d.leadPg as never).canActivate(ctx())).resolves.toBe(true);
    expect(d.leadPg.solutionAssigneeStaffId).toHaveBeenCalledWith(121);
  });
  it('allows a ticked non-AM who is assigned', async () => {
    const d = deps({ staffId: 8, position: 'ae', ticked: true }, 8);
    await expect(make(d.staffAuth as never, d.leadPg as never).canActivate(ctx())).resolves.toBe(true);
  });
  it('denies an unassigned AM', async () => {
    const d = deps({ staffId: 9, position: 'acm' }, 7);
    await expect(make(d.staffAuth as never, d.leadPg as never).canActivate(ctx())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('denies an assigned person who is neither AM nor ticked', async () => {
    const d = deps({ staffId: 5, position: 'ae' }, 5);
    await expect(make(d.staffAuth as never, d.leadPg as never).canActivate(ctx())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('allows SUPER-ADMIN without looking up the assignee', async () => {
    const d = deps({ staffId: 1, superAdmin: true }, null);
    await expect(make(d.staffAuth as never, d.leadPg as never).canActivate(ctx())).resolves.toBe(true);
    expect(d.leadPg.solutionAssigneeStaffId).not.toHaveBeenCalled();
  });
});
