import { LmpDiscoverAnalyticsService } from './lmp-discover-analytics.service';
import type { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';

describe('LmpDiscoverAnalyticsService', () => {
  it('returns empty metrics when table missing', async () => {
    const repo = {
      tableReady: jest.fn().mockResolvedValue(false),
      aggregateDiscoverMetrics: jest.fn(),
    } as unknown as LeadMeetingPrepRepository;
    const svc = new LmpDiscoverAnalyticsService(repo);
    const out = await svc.getMetrics(14);
    expect(out.discover_attempts).toBe(0);
    expect(out.window_days).toBe(14);
    expect(repo.aggregateDiscoverMetrics).not.toHaveBeenCalled();
  });

  it('delegates to repository when table ready', async () => {
    const metrics = {
      window_days: 7,
      discover_attempts: 10,
      discover_hits: 6,
      discover_hit_rate_pct: 60,
      found_single_count: 5,
      found_multiple_count: 1,
      not_found_count: 3,
      tier1_only_count: 1,
      cache_hit_count: 2,
      am_override_count: 2,
      identity_total_count: 8,
      am_override_rate_pct: 25,
      m1_ready_count: 4,
      time_to_ready_p95_sec: 240,
    };
    const repo = {
      tableReady: jest.fn().mockResolvedValue(true),
      aggregateDiscoverMetrics: jest.fn().mockResolvedValue(metrics),
    } as unknown as LeadMeetingPrepRepository;
    const svc = new LmpDiscoverAnalyticsService(repo);
    const out = await svc.getMetrics(7);
    expect(out.discover_hit_rate_pct).toBe(60);
    expect(repo.aggregateDiscoverMetrics).toHaveBeenCalledWith(7);
  });
});
