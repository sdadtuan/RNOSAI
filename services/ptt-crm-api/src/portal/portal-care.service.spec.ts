import { ForbiddenException } from '@nestjs/common';
import { staffCanViewCareCase } from './portal-care.util';

/** Mirrors PortalCareService.requireActor guard (staff GET/mutations on cases). */
function assertCaseActor(
  user: { role: string; sub: string },
  row: { assignee_user_id: string | null },
): void {
  if (!staffCanViewCareCase(user, row.assignee_user_id)) {
    throw new ForbiddenException({ error: 'not_assignee' });
  }
}

describe('portal care staff assignee guard', () => {
  const staff = { role: 'staff', sub: 's1' };

  it('allows staff on their assigned case', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: 's1' })).not.toThrow();
  });

  it('forbids staff on another assignee', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: 's2' })).toThrow(ForbiddenException);
    try {
      assertCaseActor(staff, { assignee_user_id: 's2' });
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'not_assignee' });
    }
  });

  it('forbids staff on unassigned cases', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: null })).toThrow(ForbiddenException);
  });

  it('allows approver/viewer on unassigned', () => {
    expect(() => assertCaseActor({ role: 'approver', sub: 'm1' }, { assignee_user_id: null })).not.toThrow();
    expect(() => assertCaseActor({ role: 'viewer', sub: 'v1' }, { assignee_user_id: null })).not.toThrow();
  });
});

describe('PortalCareService Page scope (t350u)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PortalCareService } = require('./portal-care.service');
  const { NotFoundException } = require('@nestjs/common');
  const CASE = '22222222-2222-4222-8222-222222222222';
  const pages = [
    { page_id: 'pA', page_name: 'A', channel: 'facebook', active: true },
    { page_id: 'pB', page_name: 'B', channel: 'facebook', active: true },
    { page_id: 'act_1', page_name: 'Ads', channel: 'ad_account', active: true },
  ];
  function makeService(repo: Record<string, jest.Mock>) {
    return new PortalCareService(
      { ensure: jest.fn(), ...repo } as never,
      { listForPortal: jest.fn().mockResolvedValue(pages) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { rebalance: jest.fn() } as never,
    );
  }
  const staffA = { sub: '33333333-3333-4333-8333-333333333333', role: 'staff', client_id: 'c1', email: 'a@x' };
  const viewer = { ...staffA, role: 'viewer' };
  const owner = { ...staffA, role: 'approver' };

  it('approver sees every Page; staff/viewer only assigned active Pages; none when unassigned', async () => {
    const svc = makeService({ listUserPageIds: jest.fn().mockResolvedValue(['pA', 'gone']) });
    expect(await svc.pageScope(owner)).toEqual({ all: true });
    expect(await svc.pageScope(staffA)).toEqual({ all: false, pageIds: ['pA'] });
    expect(await svc.pageScope(viewer)).toEqual({ all: false, pageIds: ['pA'] });
    const none = makeService({ listUserPageIds: jest.fn().mockResolvedValue([]) });
    expect(await none.pageScope(staffA)).toEqual({ all: false, pageIds: [] });
  });

  it('returns 404 for a case on another Page and for a non-uuid id', async () => {
    const svc = makeService({
      listUserPageIds: jest.fn().mockResolvedValue(['pA']),
      findCase: jest.fn().mockResolvedValue({ id: CASE, page_id: 'pB', assignee_user_id: staffA.sub }),
      markRead: jest.fn(),
    });
    await expect(svc.markRead(staffA, CASE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.markRead(staffA, 'not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pages/:pageId: `all` and out-of-scope Pages are 404 for staff, allowed for approver', async () => {
    const svc = makeService({ listUserPageIds: jest.fn().mockResolvedValue(['pA']) });
    await expect(svc.assertWorkspaceVisible(staffA, 'all')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.assertWorkspaceVisible(staffA, 'act_1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.assertWorkspaceVisible(staffA, 'pA')).resolves.toBeUndefined();
    await expect(svc.assertWorkspaceVisible(owner, 'all')).resolves.toBeUndefined();
  });

  it('viewer (Chỉ xem) is read-only: case, comment, quick-reply and manager writes are 403 viewer_read_only', async () => {
    const { ForbiddenException: Forbidden } = require('@nestjs/common');
    const repo = {
      listUserPageIds: jest.fn().mockResolvedValue(['pA']),
      findCase: jest.fn().mockResolvedValue({ id: CASE, page_id: 'pA', assignee_user_id: null }),
      findComment: jest.fn().mockResolvedValue({ comment_id: '1_2', page_id: 'pA' }),
      markRead: jest.fn(),
      saveNotes: jest.fn(),
      insertQuickReply: jest.fn(),
      deleteQuickReply: jest.fn(),
    };
    const svc = makeService(repo);
    const expect403 = async (p: Promise<unknown>) => {
      const err = await p.then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(Forbidden);
      expect((err as InstanceType<typeof Forbidden>).getResponse()).toMatchObject({ error: 'viewer_read_only' });
    };
    await expect403(svc.saveNotes(viewer, CASE, 'x'));
    await expect403(svc.hideComment(viewer, '1_2', true));
    await expect403(svc.addQuickReply(viewer, { shortcut: 'a', body: 'b' }));
    await expect403(svc.removeQuickReply(viewer, 'q1'));
    await expect403(svc.assign(viewer, CASE, staffA.sub));
    await expect403(svc.addProduct(viewer, 'pA', { name: 'x' }));
    expect(repo.saveNotes).not.toHaveBeenCalled();
    expect(repo.insertQuickReply).not.toHaveBeenCalled();
    expect(repo.deleteQuickReply).not.toHaveBeenCalled();
    // Opening a case is still allowed but never clears the unread flag for a viewer.
    await expect(svc.markRead(viewer, CASE)).resolves.toEqual({ ok: true, skipped: true });
    expect(repo.markRead).not.toHaveBeenCalled();
    // Out-of-scope stays 404 (no existence leak), even for writes.
    repo.findCase.mockResolvedValueOnce({ id: CASE, page_id: 'pB', assignee_user_id: null });
    await expect(svc.saveNotes(viewer, CASE, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
