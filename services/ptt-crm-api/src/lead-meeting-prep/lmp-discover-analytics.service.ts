import { Injectable } from '@nestjs/common';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';

export interface LmpDiscoverAnalyticsMetrics {
  window_days: number;
  discover_attempts: number;
  discover_hits: number;
  discover_hit_rate_pct: number | null;
  found_single_count: number;
  found_multiple_count: number;
  not_found_count: number;
  tier1_only_count: number;
  cache_hit_count: number;
  am_override_count: number;
  identity_total_count: number;
  am_override_rate_pct: number | null;
  m1_ready_count: number;
  time_to_ready_p95_sec: number | null;
}

@Injectable()
export class LmpDiscoverAnalyticsService {
  constructor(private readonly repo: LeadMeetingPrepRepository) {}

  async getMetrics(windowDays = 30): Promise<LmpDiscoverAnalyticsMetrics> {
    if (!(await this.repo.tableReady())) {
      return emptyMetrics(windowDays);
    }
    return this.repo.aggregateDiscoverMetrics(windowDays);
  }
}

function emptyMetrics(windowDays: number): LmpDiscoverAnalyticsMetrics {
  return {
    window_days: windowDays,
    discover_attempts: 0,
    discover_hits: 0,
    discover_hit_rate_pct: null,
    found_single_count: 0,
    found_multiple_count: 0,
    not_found_count: 0,
    tier1_only_count: 0,
    cache_hit_count: 0,
    am_override_count: 0,
    identity_total_count: 0,
    am_override_rate_pct: null,
    m1_ready_count: 0,
    time_to_ready_p95_sec: null,
  };
}
