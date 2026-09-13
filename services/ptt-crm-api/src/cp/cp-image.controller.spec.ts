import { HttpException } from '@nestjs/common';
import { CpImageController } from './cp-image.controller';
import { CpImageSopService } from './cp-image-sop.service';

function makeController(opts: { enabled?: boolean; service?: Partial<CpImageSopService> }) {
  const service = {
    flags: jest.fn().mockReturnValue({ enabled: opts.enabled ?? false, router: 'manual' }),
    assertEnabled: jest.fn(() => {
      if (opts.enabled === false) {
        throw Object.assign(new HttpException({ error: 'image_sop_disabled' }, 404), {
          error: 'image_sop_disabled',
        });
      }
    }),
    draftJob: jest.fn().mockResolvedValue({
      job_id: 'job-1',
      recipe: [],
      estimate_credits: null,
      blocked_reason: null,
    }),
    submitJob: jest.fn(),
    dashboardKpis: jest.fn().mockResolvedValue({}),
    ...opts.service,
  } as unknown as CpImageSopService;
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(9),
  };
  const controller = new CpImageController(service, staffAuth as never);
  const req = { staffUser: { sub: 'staff-1' }, staffAuthVia: 'jwt' as const };
  return { controller, service, req };
}

describe('CpImageController', () => {
  it('flags returns enabled false when flag off', () => {
    const { controller } = makeController({ enabled: false });
    expect(controller.flags()).toEqual({ enabled: false, router: 'manual' });
  });

  it('dashboard throws 404 when flag off', () => {
    const { controller } = makeController({ enabled: false });
    expect(() => controller.dashboardKpis()).toThrow(
      expect.objectContaining({ error: 'image_sop_disabled' }),
    );
  });

  it('draft returns 201 payload when enabled', async () => {
    const { controller, req, service } = makeController({ enabled: true });
    const out = await controller.draftJob(req as never, {
      agency_client_id: 1,
      sop_version_id: 'v1',
      intent: 'hero_lifestyle',
      variants: 2,
      creative_direction: 'Nova KV',
      idempotency_key: 'k1',
    });
    expect(out.job_id).toBe('job-1');
    expect(service.draftJob).toHaveBeenCalled();
  });

  it('submit no confirm propagates human_confirm_required', async () => {
    const { controller, req, service } = makeController({
      enabled: true,
      service: {
        submitJob: jest.fn().mockRejectedValue(
          Object.assign(new HttpException({ error: 'human_confirm_required' }, 400), {
            error: 'human_confirm_required',
          }),
        ),
      },
    });
    await expect(controller.submitJob(req as never, 'job-1', { confirm: false })).rejects.toMatchObject({
      error: 'human_confirm_required',
    });
    expect(service.submitJob).toHaveBeenCalledWith('job-1', false, 9);
  });
});
