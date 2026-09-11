import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CmktECalendar } from './CmktECalendar';

describe('CmktECalendar publication health', () => {
  it('shows Facebook health from the API and does not invent Instagram Connected', () => {
    const html = renderToStaticMarkup(
      createElement(CmktECalendar, {
        slots: [
          {
            id: 1,
            lifecycle_id: 4,
            item_id: 21,
            scheduled_at: '2026-09-11T10:00:00.000Z',
            timezone: 'Asia/Ho_Chi_Minh',
            reminder_sent: false,
            item: { id: 21, title: 'Reel', channel: 'facebook' },
            channel_health: { status: 'Connected' },
          },
        ],
        channelHealth: [{ channel: 'facebook', status: 'Connected' }],
      }),
    );
    expect(html).toContain('Connected');
    expect(html).toContain('Facebook');
    expect(html).not.toMatch(/Instagram[\s\S]*Connected|Connected[\s\S]*Instagram/);
    expect(html).not.toContain('Instagram Connected');
  });

  it('does not render a fake Instagram Connected chip when health is empty', () => {
    const html = renderToStaticMarkup(createElement(CmktECalendar, { slots: [] }));
    expect(html).not.toContain('Instagram');
    expect(html).not.toMatch(/Connected/);
  });
});
