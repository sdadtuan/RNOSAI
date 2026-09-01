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
  };
  const ctrl = new CeoCommandController(
    {} as never,
    {} as never,
    {} as never,
    staffAuth as never,
    tower as unknown as CeoTowerSensorService,
  );
  return { ctrl, tower };
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
});
