import { mapTodayPublishRow } from './content-os-portfolio.today-publish.util';

describe('mapTodayPublishRow', () => {
  it('maps a real row and keeps empty list legal', () => {
    expect(mapTodayPublishRow({
      item_id: 21, display_code: 'CNT-1', page_name: 'PTT Ads',
      gate: 'Blocked', blockerCount: 3, health: 'Manual',
    })).toEqual({
      item_id: 21, display_code: 'CNT-1', page_name: 'PTT Ads',
      gate: 'Blocked', blockers: 3, health: 'Manual',
    });
  });
});
