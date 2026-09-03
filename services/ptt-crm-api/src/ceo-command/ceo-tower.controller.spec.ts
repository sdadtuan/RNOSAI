import { ForbiddenException } from '@nestjs/common';
import { CeoCommandController } from './ceo-command.controller';
import type { CeoTowerSensorService } from './ceo-tower-sensor.service';

function makeController(opts: {
  caps: Array<{ section: string; action: string }>;
  tower?: { buildPayload: jest.Mock };
}) {
  const tower = opts.tower ?? { buildPayload: jest.fn().mockResolvedValue({ ok: true }) };
  const staffAuth = {
    me: jest.fn().mockResolvedValue({
      display_name: 'CEO',
      email: 'ceo@ptt.vn',
      caps: opts.caps,
    }),
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(42),
  };
  const ctrl = new CeoCommandController(
    {} as never,
    {} as never,
    {} as never,
    staffAuth as never,
    tower as unknown as CeoTowerSensorService,
  );
  return { ctrl, tower, staffAuth };
}

const viewOnly = [{ section: 'ceo_command', action: 'view' }];
const viewAndConfigure = [
  { section: 'ceo_command', action: 'view' },
  { section: 'ceo_command', action: 'configure' },
];

describe('CeoCommandController GET tower', () => {
  it('severity=ok without ceo_command.configure → 403', async () => {
    const { ctrl, tower } = makeController({ caps: viewOnly });

    await expect(
      ctrl.tower({ staffUser: { sub: '42' } } as never, { severity: 'ok' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tower.buildPayload).not.toHaveBeenCalled();
  });

  it('severity=ok with ceo_command.configure calls buildPayload', async () => {
    const { ctrl, tower } = makeController({ caps: viewAndConfigure });

    await ctrl.tower({ staffUser: { sub: '42' } } as never, { severity: 'ok' });

    expect(tower.buildPayload).toHaveBeenCalledTimes(1);
    expect(tower.buildPayload.mock.calls[0][0]).toMatchObject({
      staffId: 42,
      caps: viewAndConfigure,
    });
  });

  it('default severity without configure still assembles', async () => {
    const { ctrl, tower } = makeController({ caps: viewOnly });

    await ctrl.tower({ staffUser: { sub: '42' } } as never, { factory: 'both' });

    expect(tower.buildPayload).toHaveBeenCalledTimes(1);
  });

  it('resolves UUID JWT sub via resolveCrmStaffUserId', async () => {
    const { ctrl, tower, staffAuth } = makeController({ caps: viewOnly });
    const uuidSub = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    await ctrl.tower(
      { staffUser: { sub: uuidSub, email: 'ceo@ptt.vn' } } as never,
      { factory: 'both' },
    );

    expect(staffAuth.resolveCrmStaffUserId).toHaveBeenCalled();
    expect(tower.buildPayload.mock.calls[0][0]).toMatchObject({ staffId: 42 });
  });
});

describe('CeoCommandController GET tower/board-pack', () => {
  it('calls buildPayload with tower view query and returns facts_json', async () => {
    const generatedAt = '2026-09-01T07:00:00.000Z';
    const tower = {
      buildPayload: jest.fn().mockResolvedValue({
        ok: true,
        generated_at: generatedAt,
        window_exception_days: 7,
        k_strip: [{ key: 'k1', value: 1, status: 'green', href: '/crm/internal-reports/dashboards?role=bod' }],
        columns: [],
        exceptions: [],
        org_rollup: [],
        next_cursor: null,
        degraded: [],
        sensors_ok: {
          S1: 'ok',
          S2: 'ok',
          S3: 'ok',
          S4: 'ok',
          S5: 'ok',
          S6: 'ok',
          S7: 'ok',
          S8: 'ok',
          S9: 'ok',
          S10: 'ok',
          S11: 'ok',
          S12: 'ok',
        },
      }),
    };
    const { ctrl } = makeController({ caps: viewOnly, tower });

    const out = await ctrl.boardPack({ staffUser: { sub: '42' } } as never, '2026-W36');

    expect(tower.buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 42 }),
      { factory: 'both', severity: 'red,amber', limit: '10' },
    );
    expect(out.ok).toBe(true);
    expect(out.week).toBe('2026-W36');
    expect(out.generated_at).toBe(generatedAt);
    expect(out.facts_json).toMatchObject({
      week: '2026-W36',
      decisions_blank: ['', '', ''],
    });
  });
});
