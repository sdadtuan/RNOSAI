import { funnelStage, roasDisplay } from './performance-marketing';

describe('performance-marketing', () => {
  it('hides ROAS without attribution (AC-PM-09)', () => {
    expect(roasDisplay({ attribution_ready: false, value: 4.52 })).toEqual({
      value: null,
      display: 'N/A',
      reason: 'Thiếu attribution model',
    });
    expect(roasDisplay({ attribution_ready: true, value: 4.52 })).toEqual({
      value: 4.52,
      display: '4.52',
      reason: null,
    });
  });

  it('unmapped funnel stage is empty not invented', () => {
    expect(funnelStage({ label: 'BOOKING', mapped: false, value: 12 })).toEqual({
      label: 'BOOKING',
      value: null,
      display: '—',
      hint: 'Chưa map Sales CRM',
    });
    expect(funnelStage({ label: 'VALID LEAD', mapped: true, value: 250, hint: 'Pending CRM' })).toEqual({
      label: 'VALID LEAD',
      value: 250,
      display: '250',
      hint: 'Pending CRM',
    });
  });
});
