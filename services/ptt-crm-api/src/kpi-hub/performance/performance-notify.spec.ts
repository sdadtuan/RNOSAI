import { buildNotifyEvent } from './performance-notify';

describe('performance-notify', () => {
  it('red health notifies owner + lead + account when client-scoped', () => {
    const ev = buildNotifyEvent({
      type: 'health_red',
      owner: 'Trần Văn Nam',
      lead: 'Team Lead Tech',
      account: 'AM An Phát',
      client_scoped: true,
      href: '/crm/kpi-hub/performance/check-ins?assignment=asg-p1',
      title: 'P1 resolution Red',
    });
    expect(ev.audience).toEqual(['Trần Văn Nam', 'Team Lead Tech', 'AM An Phát']);
    expect(ev.severity).toBe('critical');
  });

  it('stale notifies data owner + owner + pm', () => {
    const ev = buildNotifyEvent({
      type: 'quality_stale',
      owner: 'Lê Hoàng',
      lead: 'PM Ads',
      data_owner: 'Data CRM',
      href: '/crm/kpi-hub/performance/crm-source',
      title: 'Valid Lead stale 29h',
    });
    expect(ev.audience).toEqual(['Data CRM', 'Lê Hoàng', 'PM Ads']);
    expect(ev.severity).toBe('high');
  });
});
