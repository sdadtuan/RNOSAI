import { signStaffJwt, verifyStaffJwt } from './staff-jwt.util';

const secret = 'test-staff-secret-phase0-min-len-32';

describe('staff jwt sid', () => {
  it('round-trips sid on access token', () => {
    const token = signStaffJwt(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'a@pttads.vn',
        display_name: 'A',
        position_id: 1,
        token_type: 'access',
        sid: '22222222-2222-4222-8222-222222222222',
        tv: 0,
      },
      secret,
      3600,
    );
    const payload = verifyStaffJwt(token, secret);
    expect(payload?.sid).toBe('22222222-2222-4222-8222-222222222222');
    expect(payload?.token_type).toBe('access');
  });

  it('tokens without sid still verify', () => {
    const token = signStaffJwt(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'a@pttads.vn',
        display_name: 'A',
        position_id: 1,
        token_type: 'refresh',
        tv: 0,
      },
      secret,
      3600,
    );
    expect(verifyStaffJwt(token, secret)?.sid).toBeUndefined();
  });
});
