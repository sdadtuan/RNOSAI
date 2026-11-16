import {
  breakdownRow,
  channelLabel,
  formatLeadFunnelRatio,
  isLeadReceivedStatus,
  kpisFromCounts,
  leadFunnelRatio,
  sanitizeFunnelFilter,
} from './portal-lead-funnel.util';

describe('portal lead funnel util', () => {
  it('computes conversion ratio and Vietnamese percent label', () => {
    expect(leadFunnelRatio(20, 80)).toBe(0.25);
    expect(formatLeadFunnelRatio(20, 80)).toBe('25%');
    expect(formatLeadFunnelRatio(1, 3)).toBe('33,3%');
    expect(formatLeadFunnelRatio(0, 0)).toBe('0%');
    expect(kpisFromCounts({ total: 80, waiting: 16, assigned: 80, received: 64, converted: 20, purchased: 8, today: 5 }).ratio).toBe(0.25);
  });

  it('labels known ads channels and treats received/caring/purchased as already received', () => {
    expect(channelLabel('facebook')).toBe('Facebook');
    expect(channelLabel('zalo')).toBe('Zalo');
    expect(channelLabel('')).toBe('Không rõ kênh');
    expect(isLeadReceivedStatus('waiting_receive')).toBe(false);
    expect(isLeadReceivedStatus('received')).toBe(true);
    expect(isLeadReceivedStatus('purchased')).toBe(true);
  });

  it('sanitizes funnel filters and swaps an inverted date range', () => {
    expect(sanitizeFunnelFilter({ from: '2026-11-20', to: '2026-11-01', pageId: ' p1 ', channel: 'zalo' })).toEqual({
      from: '2026-11-01',
      to: '2026-11-20',
      pageId: 'p1',
      channel: 'zalo',
      formId: '',
      assignee: '',
      tag: '',
    });
    expect(sanitizeFunnelFilter({ from: 'nope' }).from).toBe('');
  });

  it('builds a breakdown row with ratio', () => {
    expect(breakdownRow('fb', 'Facebook', { total: 4, received: 3, converted: 1, purchased: 1 })).toEqual({
      id: 'fb',
      label: 'Facebook',
      total: 4,
      received: 3,
      converted: 1,
      purchased: 1,
      ratio: 0.25,
    });
  });
});
