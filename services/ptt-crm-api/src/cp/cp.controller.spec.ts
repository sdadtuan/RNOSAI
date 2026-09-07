import { ForbiddenException } from '@nestjs/common';
import { CpController } from './cp.controller';

const VERSION_ID = '55555555-5555-4555-8555-555555555555';

function makeController(opts: {
  hasLegalCap?: boolean;
  comments?: { create: jest.Mock };
  approvals?: { submit: jest.Mock };
}) {
  const comments = opts.comments ?? { create: jest.fn().mockResolvedValue({ id: 'c1' }) };
  const approvals = opts.approvals ?? { submit: jest.fn().mockResolvedValue({ id: 'a1' }) };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(9),
    me: jest.fn().mockResolvedValue({ caps: [], teams: [{ id: 3 }] }),
    hasCap: jest.fn((_caps: unknown, section: string, action: string) => {
      if (section === 'crm_cp' && (action === 'edit' || action === 'view')) return true;
      if (section === 'crm_cp.approve_legal' && action === 'execute') {
        return opts.hasLegalCap === true;
      }
      return false;
    }),
  };
  const unused = {} as never;
  const controller = new CpController(
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    comments as never,
    approvals as never,
    unused,
    unused,
    unused,
    staffAuth as never,
    unused,
    unused,
    unused,
    unused,
    unused,
  );
  const req = {
    staffUser: { sub: 'staff-1' },
    staffAuthVia: 'jwt' as const,
  };
  return { controller, req, comments, approvals, staffAuth };
}

describe('CpController review mutations', () => {
  it('forbids legal_approved without crm_cp.approve_legal execute', async () => {
    const { controller, req, approvals } = makeController({ hasLegalCap: false });

    await expect(
      controller.submitVideoApproval(req as never, VERSION_ID, { status: 'legal_approved' }),
    ).rejects.toMatchObject({
      response: {
        error: 'missing_cap',
        section: 'crm_cp.approve_legal',
        action: 'execute',
      },
    });
    expect(approvals.submit).not.toHaveBeenCalled();
  });

  it('forbids a legal step when only decision is legal_approved', async () => {
    const { controller, req, approvals } = makeController({ hasLegalCap: false });

    await expect(
      controller.submitVideoApproval(
        req as never,
        VERSION_ID,
        { status: 'brand_approved', decision: 'legal_approved' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(approvals.submit).not.toHaveBeenCalled();
  });

  it('submits legal_approved when the legal execute cap is present', async () => {
    const { controller, req, approvals } = makeController({ hasLegalCap: true });

    await controller.submitVideoApproval(
      req as never,
      VERSION_ID,
      { status: 'legal_approved' },
      'team',
    );

    expect(approvals.submit).toHaveBeenCalledWith(
      VERSION_ID,
      { status: 'legal_approved' },
      9,
      expect.objectContaining({ scope: 'team', staffId: 9 }),
    );
  });

  it('keeps brand_approved on the edit cap', async () => {
    const { controller, req, approvals } = makeController({ hasLegalCap: false });

    await controller.submitVideoApproval(
      req as never,
      VERSION_ID,
      { status: 'brand_approved' },
      'all',
    );

    expect(approvals.submit).toHaveBeenCalledWith(
      VERSION_ID,
      { status: 'brand_approved' },
      9,
      expect.objectContaining({ scope: 'me', staffId: 9 }),
    );
  });

  it('honors request scope on comment POST', async () => {
    const { controller, req, comments } = makeController({});

    await controller.createVideoComment(
      req as never,
      VERSION_ID,
      { body: 'check safe area' },
      'team',
    );

    expect(comments.create).toHaveBeenCalledWith(
      VERSION_ID,
      { body: 'check safe area' },
      9,
      expect.objectContaining({ scope: 'team', staffId: 9 }),
    );
  });
});

describe('CpController.submitCreative', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  it('forwards version_id and returns creative_id', async () => {
    const projects = {
      submitCreative: jest.fn().mockResolvedValue({ creative_id: 'c-1' }),
    };
    const { controller, req } = makeController({});
    Object.assign(controller, { projects });

    await expect(
      controller.submitCreative(req as never, PROJECT_ID, { version_id: VERSION_ID }, 'team'),
    ).resolves.toEqual({ creative_id: 'c-1' });
    expect(projects.submitCreative).toHaveBeenCalledWith(
      PROJECT_ID,
      VERSION_ID,
      expect.objectContaining({ scope: 'team', staffId: 9 }),
    );
  });
});

describe('CpController.contentOsHandoff', () => {
  it('resolves staff and returns draft_id + href without rendering', async () => {
    const handoff = {
      handoff: jest.fn().mockResolvedValue({
        draft_id: '22222222-2222-4222-8222-222222222222',
        href: '/crm/creative-os/video/22222222-2222-4222-8222-222222222222',
      }),
    };
    const renders = { submit: jest.fn() };
    const { controller, req, staffAuth } = makeController({});
    Object.assign(controller, { contentOs: handoff, renders });

    await expect(
      controller.contentOsHandoff(req as never, {
        lifecycle_id: 7,
        item_id: 42,
        name: 'Reel Peak',
      }),
    ).resolves.toEqual({
      draft_id: '22222222-2222-4222-8222-222222222222',
      href: '/crm/creative-os/video/22222222-2222-4222-8222-222222222222',
    });
    expect(staffAuth.resolveCrmStaffUserId).toHaveBeenCalled();
    expect(handoff.handoff).toHaveBeenCalledWith(
      { lifecycle_id: 7, item_id: 42, name: 'Reel Peak' },
      expect.objectContaining({ staffId: 9 }),
    );
    expect(renders.submit).not.toHaveBeenCalled();
  });
});
