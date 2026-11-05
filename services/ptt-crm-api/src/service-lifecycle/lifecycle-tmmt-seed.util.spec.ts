import { buildOfficialTmmtSeedFromConsult } from './lifecycle-tmmt-seed.util';
import { validateOfficialTmmt } from './lifecycle-marketing-plan.util';

describe('lifecycle-tmmt-seed.util', () => {
  it('seeds core TMMT fields from consult highlights after Intake Go', () => {
    const seed = buildOfficialTmmtSeedFromConsult({
      consultBrief: {
        service_label: 'Quảng cáo Facebook',
        service_slug: 'quang-cao-facebook',
        readiness: { decision: 'go', bant_total: 30 },
        highlights: {
          pain: 'CPL cao, lead ảo',
          niche: 'Nha khoa thẩm mỹ',
          domain: 'nhakhoa.vn',
          goal: 'Giảm CPL 30%',
          budget_vnd: 50_000_000,
        },
        stakeholders: [{ role_label: 'Owner', name: 'Anh A' }],
        latest_intake_summary: 'BANT 0/30 · DV quang-cao-facebook · Pain CPL',
      },
      existingProf: {},
      existingSf: {},
    });

    expect(seed.filled_keys.length).toBeGreaterThanOrEqual(6);
    expect(seed.target_market_prof.market_context).toContain('Nha khoa');
    expect(seed.target_market_prof.pains_desired_outcomes).toContain('CPL cao');
    expect(seed.target_market_prof.segmentation_icp).toContain('Nha khoa');
    expect(seed.strategy_framework.target_market).toContain('Nha khoa');
    expect(seed.target_market_prof.insights_evidence).not.toMatch(/BANT:?\s*0\/30/i);

    const plan = {
      strategy_framework_json: JSON.stringify(seed.strategy_framework),
      target_market_prof_json: JSON.stringify(seed.target_market_prof),
    };
    const gate = validateOfficialTmmt(plan);
    expect(gate.ok).toBe(true);
  });

  it('maps Consult Đối tượng mục tiêu → segmentation_icp (P8)', () => {
    const seed = buildOfficialTmmtSeedFromConsult({
      consultBrief: {
        readiness: { decision: 'go', bant_total: 24 },
        highlights: {
          pain: 'Cần lead ổn định',
          target_audience: 'SME auto detailing HCM — Owner quyết định mua',
        },
      },
      existingProf: {},
    });
    expect(seed.target_market_prof.segmentation_icp).toContain('SME auto detailing');
    expect(seed.target_market_prof.pains_desired_outcomes).toContain('lead ổn định');
  });

  it('does not overwrite existing fields unless overwrite=true', () => {
    const seed = buildOfficialTmmtSeedFromConsult({
      consultBrief: {
        readiness: { decision: 'go', bant_total: 30 },
        highlights: { pain: 'New pain', niche: 'Spa' },
      },
      existingProf: { market_context: 'Keep me' },
      overwrite: false,
    });
    expect(seed.target_market_prof.market_context).toBe('Keep me');
    expect(seed.filled_keys).not.toContain('market_context');
  });
});
