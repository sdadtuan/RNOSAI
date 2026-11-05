import { describe, expect, it } from 'vitest';
import { formatChannelsBrief, parseChannelsBrief } from '@/lib/crm/consult-facts-suggest.ui';

describe('consult facts channel brief', () => {
  it('round-trips checked channels and the close line', () => {
    const text = formatChannelsBrief(['Facebook Ads', 'SEO'], 'AE gọi xác nhận lịch trong ngày');
    expect(parseChannelsBrief(text)).toEqual({
      selected: ['Facebook Ads', 'SEO'],
      close: 'AE gọi xác nhận lịch trong ngày',
    });
  });

  it('keeps a freeform note as the close line', () => {
    expect(parseChannelsBrief('Facebook rồi gọi điện')).toEqual({
      selected: [],
      close: 'Facebook rồi gọi điện',
    });
  });
});
