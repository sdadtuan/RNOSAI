import { defaultTeamSlaDocument, normalizeTeamSlaDocument } from './team-sla-profiles';
import {
  DEFAULT_CLAIM_MINUTES,
  formatHoursVi,
  formatMinutesVi,
  marketingClaimMinutes,
  saleClaimMinutes,
  saleMissingInfoHours,
} from './team-sla-clocks.util';

describe('team-sla-clocks', () => {
  it('defaults sale and marketing claim to 15 minutes', () => {
    const doc = defaultTeamSlaDocument();
    expect(saleClaimMinutes(doc)).toBe(15);
    expect(marketingClaimMinutes(doc)).toBe(15);
    expect(saleMissingInfoHours(doc)).toBe(1);
    expect(DEFAULT_CLAIM_MINUTES).toBe(15);
  });

  it('honors a configured 1-minute claim without hard-coding it as the default', () => {
    const base = defaultTeamSlaDocument();
    base.profiles[0].sale.claim_in_hours_minutes = 1;
    base.profiles[1].marketing.claim_in_hours_minutes = 1;
    const doc = normalizeTeamSlaDocument(base);
    expect(saleClaimMinutes(doc)).toBe(1);
    expect(marketingClaimMinutes(doc)).toBe(1);
    expect(formatMinutesVi(1)).toBe('1 phút');
    expect(formatMinutesVi(15)).toBe('15 phút');
    expect(formatHoursVi(1)).toBe('1 giờ');
  });

  it('falls back when the value is missing or invalid', () => {
    const base = defaultTeamSlaDocument();
    base.profiles[0].sale.claim_in_hours_minutes = null;
    const doc = normalizeTeamSlaDocument(base);
    expect(saleClaimMinutes(doc)).toBe(15);
  });
});
