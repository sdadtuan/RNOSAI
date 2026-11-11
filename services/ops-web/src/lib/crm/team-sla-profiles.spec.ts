import { describe, expect, it } from 'vitest';
import { defaultTeamSlaDocument, normalizeTeamSlaDocument, teamSlaProfile } from './team-sla-profiles';

describe('team-sla-profiles', () => {
  it('seeds sale and marketing clocks and leaves real-estate hours blank', () => {
    const doc = defaultTeamSlaDocument();
    const sale = teamSlaProfile(doc, 'sale_service');
    const marketing = teamSlaProfile(doc, 'marketing');
    const estate = teamSlaProfile(doc, 'sale_real_estate');

    expect(sale.calendar).toMatchObject({ start: '08:30', end: '18:30' });
    expect(sale.sale.claim_in_hours_minutes).toBe(15);
    expect(sale.sale.claim_after_hours_time).toBe('09:00');
    expect(sale.sale.update_after_claim_hours).toBe(1);
    expect(sale.sale.max_open_leads).toBe(6);

    expect(marketing.marketing.claim_in_hours_minutes).toBe(15);
    expect(marketing.marketing.claim_after_hours_time).toBe('09:00');
    expect(marketing.marketing.solution_cutoff_time).toBe('15:30');
    expect(marketing.marketing.solution_after_cutoff_time).toBe('11:00');
    expect(marketing.marketing).not.toHaveProperty('solution_friday_time');
    expect(marketing.marketing.revision_hours).toBe(2);

    expect(estate.calendar.start).toBe('');
    expect(estate.calendar.end).toBe('');
    expect(estate.sale.claim_in_hours_minutes).toBeNull();
    expect(estate.sale.claim_after_hours_time).toBe('');
  });

  it('keeps a cleared sale clock instead of restoring the default', () => {
    const doc = defaultTeamSlaDocument();
    doc.profiles[0].sale.claim_in_hours_minutes = null;
    doc.profiles[0].calendar.start = '09:15';
    const next = normalizeTeamSlaDocument(doc);
    expect(teamSlaProfile(next, 'sale_service').sale.claim_in_hours_minutes).toBeNull();
    expect(teamSlaProfile(next, 'sale_service').calendar.start).toBe('09:15');
    expect(teamSlaProfile(next, 'marketing').marketing.solution_cutoff_time).toBe('15:30');
  });

  it('keeps the 11:00 after-cutoff value and drops the Friday field', () => {
    const next = normalizeTeamSlaDocument({
      version: 1,
      profiles: [
        {
          code: 'marketing',
          marketing: {
            solution_after_cutoff_time: '11:00',
            solution_friday_time: '10:00',
          },
        },
      ],
    });
    const clocks = teamSlaProfile(next, 'marketing').marketing;
    expect(clocks.solution_after_cutoff_time).toBe('11:00');
    expect(clocks).not.toHaveProperty('solution_friday_time');
  });
});
