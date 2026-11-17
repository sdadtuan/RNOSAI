import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalCareRebalanceService } from './portal-care-rebalance.service';
import { PortalCareService } from './portal-care.service';
import { careDueAt, receiveDueAt, shouldSkipHop } from './portal-care.util';

function mockRepo(overrides: Record<string, unknown> = {}) {
  const repo = {
    withClientLock: jest.fn(async (_id: string, fn: () => Promise<void>) => fn()),
    staffPoolByPage: jest.fn().mockResolvedValue({ p1: ['s1', 's2'] }),
    listApprovers: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    listOpenAssigned: jest.fn().mockResolvedValue([]),
    releaseCases: jest.fn().mockResolvedValue(0),
    openLoads: jest.fn().mockResolvedValue({ s1: 1, s2: 0 }),
    listHopRows: jest.fn().mockResolvedValue([]),
    listUnassigned: jest.fn().mockResolvedValue([]),
    listUnassignedCare: jest.fn().mockResolvedValue([]),
    assignReceive: jest.fn().mockResolvedValue(true),
    assignCare: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  return repo;
}

describe('PortalCareRebalanceService', () => {
  const clientId = 'client-1';
  const now = new Date('2026-11-13T07:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('assigns unassigned waiting_receive cases to the least-loaded active staff', async () => {
    const repo = mockRepo({
      listUnassigned: jest.fn().mockResolvedValue([{ id: 'c-new', page_id: 'p1' }]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.withClientLock).toHaveBeenCalledWith(clientId, expect.any(Function));
    expect(repo.assignReceive).toHaveBeenCalledWith('c-new', 's2', receiveDueAt(now), null);
    expect(repo.assignCare).not.toHaveBeenCalled();
  });

  it('skips held (manually unassigned) cases — they are absent from listUnassigned', async () => {
    const repo = mockRepo({
      listUnassigned: jest.fn().mockResolvedValue([]),
      listUnassignedCare: jest.fn().mockResolvedValue([]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).not.toHaveBeenCalled();
    expect(repo.assignCare).not.toHaveBeenCalled();
  });

  it('does not hop a pinned manual assignment whose assignee is still active', async () => {
    const expired = new Date(now.getTime() - 60_000);
    const repo = mockRepo({
      listHopRows: jest.fn().mockResolvedValue([
        {
          id: 'pinned',
          page_id: 'p1',
          assignee_user_id: 's1',
          status: 'waiting_receive',
          receive_due_at: expired,
          care_due_at: null,
          assigned_manually: true,
        },
      ]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).not.toHaveBeenCalled();
    expect(repo.assignCare).not.toHaveBeenCalled();
  });

  it('hops a pinned assignment when the assignee is no longer active', async () => {
    const expired = new Date(now.getTime() - 60_000);
    const repo = mockRepo({
      listHopRows: jest.fn().mockResolvedValue([
        {
          id: 'orphan',
          page_id: 'p1',
          assignee_user_id: 'disabled',
          status: 'waiting_receive',
          receive_due_at: expired,
          care_due_at: null,
          assigned_manually: true,
        },
      ]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).toHaveBeenCalledWith('orphan', 's2', receiveDueAt(now), 'disabled');
  });

  it('hops an expired auto-assigned waiting_receive and an expired caring case', async () => {
    const repo = mockRepo({
      openLoads: jest.fn().mockResolvedValue({ s1: 1, s2: 0 }),
      listHopRows: jest.fn().mockResolvedValue([
        {
          id: 'late-recv',
          page_id: 'p1',
          assignee_user_id: 's1',
          status: 'waiting_receive',
          receive_due_at: new Date(now.getTime() - 1),
          care_due_at: null,
          assigned_manually: false,
        },
        {
          id: 'late-care',
          page_id: 'p1',
          assignee_user_id: 's1',
          status: 'caring',
          receive_due_at: null,
          care_due_at: new Date(now.getTime() - 1),
          assigned_manually: false,
        },
      ]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).toHaveBeenCalledWith('late-recv', 's2', receiveDueAt(now), 's1');
    expect(repo.assignCare).toHaveBeenCalledWith('late-care', 's2', careDueAt(now), 's1');
  });

  it('does not update loads when a conditional assign loses the race (rowCount 0)', async () => {
    const repo = mockRepo({
      openLoads: jest.fn().mockResolvedValue({ s1: 0, s2: 0 }),
      listUnassigned: jest.fn().mockResolvedValue([{ id: 'c1', page_id: 'p1' }, { id: 'c2', page_id: 'p1' }]),
      assignReceive: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).toHaveBeenCalledTimes(2);
    // First assign lost the race — load of s1 stays 0, so second case also goes to s1 (tie-break by id).
    expect(repo.assignReceive.mock.calls[0][1]).toBe('s1');
    expect(repo.assignReceive.mock.calls[1][1]).toBe('s1');
  });

  it('assigns nobody and releases nothing when a Page has no staff and no approver', async () => {
    const repo = mockRepo({
      staffPoolByPage: jest.fn().mockResolvedValue({}),
      listApprovers: jest.fn().mockResolvedValue([]),
      listOpenAssigned: jest.fn().mockResolvedValue([{ id: 'x', page_id: 'p1', assignee_user_id: 's9' }]),
      listUnassigned: jest.fn().mockResolvedValue([{ id: 'c-new', page_id: 'p1' }]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.releaseCases).not.toHaveBeenCalled();
    expect(repo.assignReceive).not.toHaveBeenCalled();
  });

  it('only assigns a case to staff assigned to its Page; a Page without staff goes to the approver', async () => {
    const repo = mockRepo({
      staffPoolByPage: jest.fn().mockResolvedValue({ pA: ['sa'], pB: ['sb'] }),
      openLoads: jest.fn().mockResolvedValue({ sa: 5, sb: 0 }),
      listUnassigned: jest.fn().mockResolvedValue([
        { id: 'case-a', page_id: 'pA' },
        { id: 'case-b', page_id: 'pB' },
        { id: 'case-c', page_id: 'pC' },
      ]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignReceive).toHaveBeenCalledWith('case-a', 'sa', receiveDueAt(now), null);
    expect(repo.assignReceive).toHaveBeenCalledWith('case-b', 'sb', receiveDueAt(now), null);
    expect(repo.assignReceive).toHaveBeenCalledWith('case-c', 'a1', receiveDueAt(now), null);
  });

  it('releases open cases held by someone outside the Page pool', async () => {
    const repo = mockRepo({
      staffPoolByPage: jest.fn().mockResolvedValue({ pA: ['sa'] }),
      listOpenAssigned: jest.fn().mockResolvedValue([
        { id: 'keep', page_id: 'pA', assignee_user_id: 'sa' },
        { id: 'moved', page_id: 'pA', assignee_user_id: 'sb' },
        { id: 'owner', page_id: 'pZ', assignee_user_id: 'a1' },
      ]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.releaseCases).toHaveBeenCalledWith(clientId, ['moved']);
  });

  it('assigns unassigned caring cases', async () => {
    const repo = mockRepo({
      listUnassignedCare: jest.fn().mockResolvedValue([{ id: 'care-1', page_id: 'p1' }]),
    });
    const service = new PortalCareRebalanceService(repo as never);
    await service.rebalance(clientId);
    expect(repo.assignCare).toHaveBeenCalledWith('care-1', 's2', careDueAt(now), null);
  });

  it('notifies the new assignee after an auto-assign', async () => {
    const repo = mockRepo({
      listUnassigned: jest.fn().mockResolvedValue([{ id: 'c-new', page_id: 'p1' }]),
    });
    const careNotify = { notifyAssignment: jest.fn().mockResolvedValue(undefined) };
    const service = new PortalCareRebalanceService(repo as never, careNotify as never);
    await service.rebalance(clientId);
    expect(careNotify.notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        caseId: 'c-new',
        assigneeId: 's2',
        previousAssigneeId: null,
        reason: 'auto',
      }),
    );
  });

  it('notifies both parties when a case hops to another staff member', async () => {
    const past = new Date(now.getTime() - 60_000);
    const repo = mockRepo({
      listHopRows: jest.fn().mockResolvedValue([
        {
          id: 'c-hop',
          page_id: 'p1',
          assignee_user_id: 's1',
          status: 'waiting_receive',
          receive_due_at: past,
          care_due_at: null,
          assigned_manually: false,
        },
      ]),
    });
    const careNotify = { notifyAssignment: jest.fn().mockResolvedValue(undefined) };
    const service = new PortalCareRebalanceService(repo as never, careNotify as never);
    await service.rebalance(clientId);
    expect(careNotify.notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        caseId: 'c-hop',
        assigneeId: 's2',
        previousAssigneeId: 's1',
        reason: 'hop',
      }),
    );
  });
});

describe('shouldSkipHop', () => {
  const active = new Set(['s1']);

  it('skips only pinned cases whose assignee is still in the active pool', () => {
    expect(shouldSkipHop({ assigned_manually: true, assignee_user_id: 's1' }, active)).toBe(true);
    expect(shouldSkipHop({ assigned_manually: true, assignee_user_id: 'gone' }, active)).toBe(false);
    expect(shouldSkipHop({ assigned_manually: false, assignee_user_id: 's1' }, active)).toBe(false);
    expect(shouldSkipHop({ assigned_manually: true, assignee_user_id: null }, active)).toBe(false);
  });
});

describe('PortalCareService.assign and setStaffActive', () => {
  function makeService(repo: Record<string, jest.Mock>, users: Record<string, jest.Mock>, rebalancer: { rebalance: jest.Mock }) {
    return new PortalCareService(
      repo as never,
      {} as never,
      {} as never,
      users as never,
      {} as never,
      {} as never,
      rebalancer as never,
    );
  }

  const approver = { sub: 'owner-1', role: 'approver', client_id: 'client-1', email: 'o@x.com' };
  const viewer = { sub: 'view-1', role: 'viewer', client_id: 'client-1', email: 'v@x.com' };
  const CASE_ID = '11111111-1111-4111-8111-111111111111';

  it('rejects manual assign to staff who is not assigned to the case Page', async () => {
    const repo = {
      ensure: jest.fn(),
      findCase: jest.fn().mockResolvedValue({ id: 'c1', page_id: 'p1', status: 'waiting_receive' }),
      findActiveClientUser: jest.fn().mockResolvedValue({ id: 's2', email: 's2@x.com' }),
      listUserPageIds: jest.fn().mockResolvedValue(['p2']),
      assignManual: jest.fn(),
    };
    const service = makeService(repo as never, {}, { rebalance: jest.fn() });
    await expect(service.assign(approver as never, CASE_ID, 's2')).rejects.toMatchObject({
      response: { error: 'staff_page_not_assigned' },
    });
    expect(repo.assignManual).not.toHaveBeenCalled();
  });

  it('lets only an approver assign or unassign; viewers are read-only', async () => {
    const repo = {
      ensure: jest.fn(),
      findCase: jest.fn().mockResolvedValue({ id: 'c1', page_id: 'p1', status: 'waiting_receive' }),
      unassign: jest.fn(),
    };
    const rebalancer = { rebalance: jest.fn() };
    const service = makeService(repo as never, {}, rebalancer);
    await expect(service.assign(viewer as never, CASE_ID, '')).rejects.toBeInstanceOf(ForbiddenException);
    await service.assign(approver as never, CASE_ID, '');
    expect(repo.unassign).toHaveBeenCalledWith('c1');
    expect(rebalancer.rebalance).toHaveBeenCalledWith('client-1');
  });

  it('rejects manual assign to a user who is not an active staff member', async () => {
    const repo = {
      ensure: jest.fn(),
      findCase: jest.fn().mockResolvedValue({ id: 'c1', page_id: 'p1', status: 'waiting_receive' }),
      findActiveClientUser: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo as never, {}, { rebalance: jest.fn() });
    await expect(service.assign(approver as never, CASE_ID, 'viewer-id')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('releases a disabled staff member’s open cases (including received) and rebalances', async () => {
    const repo = {
      listManagedStaff: jest.fn().mockResolvedValue([{ id: 's1', email: 's@x.com', active: true }]),
      releaseOpenCasesForUser: jest.fn().mockResolvedValue(3),
    };
    const users = {
      update: jest.fn().mockResolvedValue({ id: 's1', email: 's@x.com', active: false }),
    };
    const rebalancer = { rebalance: jest.fn() };
    const service = makeService(repo as never, users, rebalancer);
    const out = await service.setStaffActive(approver as never, 's1', false);
    expect(repo.releaseOpenCasesForUser).toHaveBeenCalledWith('client-1', 's1');
    expect(rebalancer.rebalance).toHaveBeenCalledWith('client-1');
    expect(out.user.active).toBe(false);
  });

  it('does not release cases when re-enabling a staff member', async () => {
    const repo = {
      listManagedStaff: jest.fn().mockResolvedValue([{ id: 's1', email: 's@x.com', active: false }]),
      releaseOpenCasesForUser: jest.fn(),
    };
    const users = {
      update: jest.fn().mockResolvedValue({ id: 's1', email: 's@x.com', active: true }),
    };
    const rebalancer = { rebalance: jest.fn() };
    const service = makeService(repo as never, users, rebalancer);
    await service.setStaffActive(approver as never, 's1', true);
    expect(repo.releaseOpenCasesForUser).not.toHaveBeenCalled();
    expect(rebalancer.rebalance).not.toHaveBeenCalled();
  });
});

describe('PortalCareService.addStaff', () => {
  function makeService(repo: Record<string, jest.Mock>, users: Record<string, jest.Mock>) {
    return new PortalCareService(
      repo as never,
      {} as never,
      {} as never,
      users as never,
      {} as never,
      {} as never,
      { rebalance: jest.fn() } as never,
    );
  }

  const approver = { sub: 'owner-1', role: 'approver', client_id: 'client-1', email: 'o@x.com' };
  const viewer = { sub: 'view-1', role: 'viewer', client_id: 'client-1', email: 'v@x.com' };
  const staff = { sub: 's-1', role: 'staff', client_id: 'client-1', email: 's@x.com' };

  it('rejects viewer and staff, and creates a staff account for an approver', async () => {
    const users = {
      create: jest.fn().mockResolvedValue({
        user: {
          id: 'n1',
          email: 'new@x.com',
          role: 'staff',
          display_name: 'Nam',
          phone: '0901112222',
          active: true,
        },
        temporary_password: 'PtSecret1!',
      }),
    };
    const repo = { ensure: jest.fn() };
    const service = makeService(repo as never, users);
    await expect(service.addStaff(viewer as never, { email: 'new@x.com' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addStaff(staff as never, { email: 'new@x.com' })).rejects.toBeInstanceOf(ForbiddenException);
    const out = await service.addStaff(approver as never, {
      name: 'Nam',
      email: 'new@x.com',
      phone: '090 111 2222',
    });
    expect(repo.ensure).toHaveBeenCalled();
    expect(users.create).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({
        email: 'new@x.com',
        role: 'staff',
        display_name: 'Nam',
        phone: '0901112222',
        send_email: false,
      }),
    );
    expect(out.user.email).toBe('new@x.com');
    expect(out.temporary_password).toBe('PtSecret1!');
  });

  it('lets an approver create a viewer and rejects an approver role', async () => {
    const users = {
      create: jest.fn().mockResolvedValue({
        user: { id: 'n2', email: 'v2@x.com', role: 'viewer', display_name: '', phone: '', active: true },
      }),
    };
    const service = makeService({ ensure: jest.fn() } as never, users);
    const out = await service.addStaff(approver as never, { email: 'v2@x.com', role: 'viewer', password: 'password1' });
    expect(users.create).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ role: 'viewer', password: 'password1' }),
    );
    expect(out.user.role).toBe('viewer');
    await expect(service.addStaff(approver as never, { email: 'a@x.com', role: 'approver' })).rejects.toMatchObject({
      response: { error: 'invalid_role' },
    });
  });
});


describe('PortalCareService.updateStaff and removeStaff', () => {
  function makeService(
    repo: Record<string, jest.Mock>,
    users: Record<string, jest.Mock>,
    rebalancer: { rebalance: jest.Mock } = { rebalance: jest.fn() },
  ) {
    return new PortalCareService(
      repo as never,
      {} as never,
      {} as never,
      users as never,
      {} as never,
      {} as never,
      rebalancer as never,
    );
  }

  const approver = { sub: 'owner-1', role: 'approver', client_id: 'client-1', email: 'o@x.com' };
  const viewer = { sub: 'view-1', role: 'viewer', client_id: 'client-1', email: 'v@x.com' };
  const staffUser = { sub: 's-1', role: 'staff', client_id: 'client-1', email: 's@x.com' };
  const target = {
    id: 's1',
    email: 's@x.com',
    active: true,
    role: 'staff',
    display_name: 'Nam',
    phone: '0901112222',
  };

  it('rejects viewer and staff for update and delete', async () => {
    const service = makeService({ ensure: jest.fn(), listManagedStaff: jest.fn() }, {});
    await expect(service.updateStaff(viewer as never, 's1', { name: 'A' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateStaff(staffUser as never, 's1', { name: 'A' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeStaff(viewer as never, 's1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeStaff(staffUser as never, 's1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects editing or deleting self, and a missing or approver target', async () => {
    const repo = {
      ensure: jest.fn(),
      listManagedStaff: jest.fn().mockResolvedValue([target]),
    };
    const service = makeService(repo, {});
    await expect(service.updateStaff({ ...approver, sub: 's1' } as never, 's1', { name: 'A' })).rejects.toMatchObject({
      response: { error: 'cannot_change_self' },
    });
    await expect(service.removeStaff({ ...approver, sub: 's1' } as never, 's1')).rejects.toMatchObject({
      response: { error: 'cannot_change_self' },
    });
    await expect(service.updateStaff(approver as never, 'approver-1', { name: 'A' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.removeStaff(approver as never, 'approver-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates display name, phone and role, and can reset a temporary password', async () => {
    const updated = { ...target, display_name: 'Mai', phone: '0902223333', role: 'viewer' };
    const repo = {
      ensure: jest.fn(),
      listManagedStaff: jest.fn().mockResolvedValueOnce([target]).mockResolvedValueOnce([updated]),
      releaseOpenCasesForUser: jest.fn(),
    };
    const users = {
      update: jest.fn().mockResolvedValue(updated),
      resetPassword: jest.fn().mockResolvedValue({ ok: true, temporary_password: 'PtReset1!' }),
    };
    const rebalancer = { rebalance: jest.fn() };
    const service = makeService(repo, users, rebalancer);
    const out = await service.updateStaff(approver as never, 's1', {
      name: 'Mai',
      phone: '090 222 3333',
      role: 'viewer',
      reset_password: true,
    });
    expect(users.update).toHaveBeenCalledWith(
      'client-1',
      's1',
      expect.objectContaining({ display_name: 'Mai', phone: '0902223333', role: 'viewer' }),
    );
    expect(users.resetPassword).toHaveBeenCalledWith('client-1', 's1', expect.objectContaining({ send_email: false }));
    expect(out.temporary_password).toBe('PtReset1!');
    expect(out.user.display_name).toBe('Mai');
    expect(out.user.role).toBe('viewer');
    expect(repo.releaseOpenCasesForUser).not.toHaveBeenCalled();
    expect(rebalancer.rebalance).not.toHaveBeenCalled();
  });

  it('releases open cases, soft-deletes, and rebalances on remove', async () => {
    const repo = {
      ensure: jest.fn(),
      listManagedStaff: jest.fn().mockResolvedValue([target]),
      releaseOpenCasesForUser: jest.fn().mockResolvedValue(2),
    };
    const users = {
      update: jest.fn().mockResolvedValue({ ...target, active: false }),
      softDelete: jest.fn().mockResolvedValue({ ...target, active: false }),
    };
    const rebalancer = { rebalance: jest.fn() };
    const service = makeService(repo, users, rebalancer);
    const out = await service.removeStaff(approver as never, 's1');
    expect(users.update).toHaveBeenCalledWith('client-1', 's1', { active: false });
    expect(repo.releaseOpenCasesForUser).toHaveBeenCalledWith('client-1', 's1');
    expect(users.softDelete).toHaveBeenCalledWith('client-1', 's1');
    expect(rebalancer.rebalance).toHaveBeenCalledWith('client-1');
    expect(out).toMatchObject({ ok: true, deleted: true, released: 2, user: { id: 's1', email: 's@x.com' } });
  });
});
