import {
  blacklistEntriesFromFeedback,
  candidateHitsBlacklist,
  normalizeBlacklistValue,
} from './blacklist.util';

describe('blacklist.util', () => {
  it('bad_phone inserts phone entry', () => {
    const entries = blacklistEntriesFromFeedback({
      feedback_code: 'bad_phone',
      phone: '+84 903 111 222',
      email: 'a@b.com',
      company_name: 'Spa X',
    });
    expect(entries).toEqual([
      { kind: 'phone', value_norm: '0903111222', reason: 'feedback:bad_phone' },
    ]);
  });

  it('wrong_number / email_bounced / out_of_business blacklist', () => {
    expect(
      blacklistEntriesFromFeedback({
        dial_outcome: 'wrong_number',
        phone: '0903111222',
      }).map((e) => e.kind),
    ).toEqual(['phone']);
    expect(
      blacklistEntriesFromFeedback({
        dial_outcome: 'email_bounced',
        email: 'Hi@Spa.VN',
      }),
    ).toEqual([{ kind: 'email', value_norm: 'hi@spa.vn', reason: 'dial:email_bounced' }]);
    const ooo = blacklistEntriesFromFeedback({
      dial_outcome: 'out_of_business',
      phone: '0903111222',
      company_name: 'Spa Đóng',
      website: 'https://www.closed.vn',
    });
    expect(ooo.some((e) => e.kind === 'company_norm')).toBe(true);
    expect(ooo.some((e) => e.kind === 'domain' && e.value_norm === 'closed.vn')).toBe(true);
  });

  it('candidateHitsBlacklist skips matching phone', () => {
    const blocked = [
      { kind: 'phone' as const, value_norm: normalizeBlacklistValue('phone', '0903111222') },
    ];
    expect(
      candidateHitsBlacklist({ phone_norm: '0903111222', company_name: 'Other' }, blocked),
    ).toBe(true);
    expect(
      candidateHitsBlacklist({ phone_norm: '0912555666', company_name: 'Other' }, blocked),
    ).toBe(false);
  });
});
