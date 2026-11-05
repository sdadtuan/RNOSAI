import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PortfolioCommandCenter } from '@/lib/crm/cmkte-api';
import { CmktECommandCenter } from './CmktECommandCenter';

const emptyCenter: PortfolioCommandCenter = {
  throughput_week: 0,
  completed_week: 0,
  wip: 0,
  sla_at_risk: 0,
  sla_breached: 0,
  first_pass_pct: null,
  capacity_pct: null,
  blocked: 0,
  risk_queue: [],
  today_publish: [],
};

describe('CmktECommandCenter today_publish', () => {
  it('does not render a Sunlight/Nova/Tâm An row when today_publish is empty', () => {
    const html = renderToStaticMarkup(createElement(CmktECommandCenter, { data: emptyCenter }));
    expect(html).toContain('Cần đăng hôm nay');
    expect(html).not.toContain('Sunlight');
    expect(html).not.toContain('Nova');
    expect(html).not.toContain('Tâm An');
    expect(html).not.toContain('CNT-260910-021');
  });

  it('links Mở Publish Control to the item publish tab', () => {
    const html = renderToStaticMarkup(
      createElement(CmktECommandCenter, {
        data: {
          ...emptyCenter,
          today_publish: [
            {
              item_id: 21,
              display_code: 'CNT-1',
              page_name: 'PTT Ads',
              gate: 'Blocked',
              blockers: 3,
              health: 'Manual',
            },
          ],
        },
      }),
    );
    expect(html).toContain('CNT-1');
    expect(html).toContain('PTT Ads');
    expect(html).toContain('Blocked');
    expect(html).toContain('Mở Publish Control');
    expect(html).toContain('/crm/content-os/w/21?tab=publish');
    expect(html).not.toContain('Sunlight');
  });
});
