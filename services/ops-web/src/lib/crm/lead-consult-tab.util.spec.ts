import { describe, expect, it } from 'vitest';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { presalesStageLabel, showLeadConsultTab } from './lead-consult-tab.util';

describe('showLeadConsultTab', () => {
  it('shows for consult and proposal only', () => {
    const base = {
      presales: { id: 1, stage: 'consult', service_slug: 'lead-gen', status: 'active' },
    } as LeadFunnelSnapshot['presales'];

    expect(showLeadConsultTab({ presales: base } as LeadFunnelSnapshot)).toBe(true);
    expect(
      showLeadConsultTab({
        presales: { ...base, presales: { ...base!.presales, stage: 'proposal' } },
      } as LeadFunnelSnapshot),
    ).toBe(true);
    expect(
      showLeadConsultTab({
        presales: { ...base, presales: { ...base!.presales, stage: 'lead' } },
      } as LeadFunnelSnapshot),
    ).toBe(false);
    expect(showLeadConsultTab(null)).toBe(false);
  });
});

describe('presalesStageLabel', () => {
  it('returns Vietnamese labels and never raw English stage codes', () => {
    expect(presalesStageLabel('consult')).toBe('Tư vấn');
    expect(presalesStageLabel('proposal')).toBe('Báo giá');
    expect(presalesStageLabel('lead')).toBe('Pre Sale');
    expect(presalesStageLabel('PROPOSAL')).toBe('Báo giá');
    expect(presalesStageLabel(undefined)).toBe('—');
    expect(presalesStageLabel('proposal')).not.toBe('proposal');
    expect(presalesStageLabel('some_unknown_enum')).toBe('—');
    expect(presalesStageLabel('some_unknown_enum')).not.toMatch(/_/);
  });
});
