import type { LeadRow } from '@/lib/api';
import {
  isLeadP1SavedView,
  leadFirstResponseSlaLabel,
  leadIcpScoreTag,
  leadP1Filters,
  shouldShowFirstResponseSlaColumn,
} from './leads-inbox-revops.util';

describe('leads-inbox-revops.util', () => {
  const base: LeadRow = {
    id: 1,
    full_name: 'A',
    phone: '09',
    email: '',
    status: 'moi',
    source: 'web',
    channel: '',
    client_id: null,
    owner_id: null,
    created_at: '2026-09-06',
    received_at: '2026-09-06',
    is_duplicate: false,
  };

  it('maps icp score tags from ai_band and score', () => {
    expect(leadIcpScoreTag({ ...base, ai_band: 'hot' })).toBe('Hot');
    expect(leadIcpScoreTag({ ...base, ai_band: 'warm' })).toBe('Warm');
    expect(leadIcpScoreTag({ ...base, ai_band: 'cold' })).toBe('Fit');
    expect(leadIcpScoreTag(base, { score_value: 72, score_band: 'warm', confidence: 0.8 })).toBe('Warm');
    expect(leadIcpScoreTag(base)).toBeNull();
  });

  it('shows first response SLA only when field exists', () => {
    expect(shouldShowFirstResponseSlaColumn([base])).toBe(false);
    expect(
      shouldShowFirstResponseSlaColumn([{ ...base, sla_state: 'warning' }]),
    ).toBe(true);
    expect(leadFirstResponseSlaLabel({ ...base, sla_state: 'breach' })).toBe('Breached');
    expect(
      leadFirstResponseSlaLabel({
        ...base,
        review_queue: { active: true, hours_waiting: 5 },
      }),
    ).toBe('T+5h');
  });

  it('detects Lead P1 saved view and filters', () => {
    expect(isLeadP1SavedView('p1')).toBe(true);
    expect(isLeadP1SavedView('all')).toBe(false);
    expect(leadP1Filters()).toEqual({ status: 'moi', unassigned_only: true });
  });
});
