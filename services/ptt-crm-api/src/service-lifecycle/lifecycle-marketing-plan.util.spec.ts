import {
  buildOfficialPlanPayload,
  mergeStrategyFramework,
  mergeTargetMarketProf,
  validateOfficialTmmt,
} from './lifecycle-marketing-plan.util';

describe('lifecycle-marketing-plan.util', () => {
  it('buildOfficialPlanPayload includes filled_count', () => {
    const payload = buildOfficialPlanPayload(null);
    expect(payload.filled_count).toBe(0);
    expect(payload.tmmt_core_keys.length).toBe(4);
  });

  it('rejects missing plan', () => {
    const gate = validateOfficialTmmt(null);
    expect(gate.ok).toBe(false);
  });

  it('accepts filled official TMMT', () => {
    const prof = Object.fromEntries(
      [
        'market_context',
        'tam_sam_som',
        'geo_behavior',
        'segmentation_icp',
        'personas_roles',
        'jobs_to_be_done',
        'pains_desired_outcomes',
        'buy_triggers_obstacles',
        'criteria_vs_alternatives',
        'insights_evidence',
        'segment_priorities',
        'success_hypotheses_next',
      ].map((k) => [k, 'filled']),
    );
    const gate = validateOfficialTmmt({
      strategy_framework_json: JSON.stringify({ target_market: 'B2B SaaS' }),
      target_market_prof_json: JSON.stringify(prof),
    });
    expect(gate.ok).toBe(true);
  });

  it('reads jsonb objects from PostgreSQL rows', () => {
    const gate = validateOfficialTmmt({
      strategy_framework_json: { target_market: 'B2B SaaS' },
      target_market_prof_json: {
        market_context: 'ctx',
        segmentation_icp: 'icp',
        personas_roles: 'persona',
        pains_desired_outcomes: 'pain',
        tam_sam_som: 'tam',
        geo_behavior: 'geo',
      },
    });
    expect(gate.ok).toBe(true);
  });

  it('P8.4 merge keeps ai_tmmt_field_meta and non-empty Pain across status activate', () => {
    const existingMeta = JSON.stringify({
      pains_desired_outcomes: {
        status: 'assumed_confirmed',
        text: 'Lead ổn định',
        confirmed_by: 'ceo',
      },
    });
    const mergedSf = mergeStrategyFramework(
      JSON.stringify({
        target_market: 'Việt Nam',
        ai_tmmt_field_meta: existingMeta,
      }),
      {
        target_market: 'Việt Nam',
        ai_tmmt_field_meta: '',
      },
    );
    const parsedSf = JSON.parse(mergedSf);
    expect(parsedSf.ai_tmmt_field_meta).toContain('assumed_confirmed');
    expect(parsedSf.target_market).toBe('Việt Nam');

    const mergedProf = mergeTargetMarketProf(
      JSON.stringify({ pains_desired_outcomes: 'Lead ổn định', market_context: 'Detailing' }),
      { pains_desired_outcomes: '', market_context: 'Detailing' },
    );
    const parsedProf = JSON.parse(mergedProf);
    expect(parsedProf.pains_desired_outcomes).toBe('Lead ổn định');
  });
});
