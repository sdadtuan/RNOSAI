import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { parseLegalHoldPatch, assertCanReleaseHold } from './legal-hold-toggle.util';

describe('legal-hold-toggle', () => {
  it('requires reason >= 10 when enabling', () => {
    expect(() => parseLegalHoldPatch({ legal_hold: true, reason: 'short' })).toThrow(BadRequestException);
    expect(parseLegalHoldPatch({ legal_hold: true, reason: 'tranh chấp hợp đồng Q4' }))
      .toEqual({ legal_hold: true, reason: 'tranh chấp hợp đồng Q4' });
  });

  it('blocks writer release and SoD self-release', () => {
    expect(() => assertCanReleaseHold({
      sodEnabled: true, actor: 'a@ptt.vn', setBy: 'a@ptt.vn', canAdmin: false, canQa: true,
    })).toThrow(ForbiddenException);
    expect(() => assertCanReleaseHold({
      sodEnabled: false, actor: 'w@ptt.vn', setBy: 'a@ptt.vn', canAdmin: false, canQa: false,
    })).toThrow(ForbiddenException);
  });
});
