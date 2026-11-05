import { overlayLifecycleTmmt } from './ops-tmmt-persist.util';

describe('overlayLifecycleTmmt', () => {
  const confirmed = (text: string) => ({
    status: 'assumed_confirmed' as const,
    text,
    source: 'am_confirm',
    confirmed_by: 'ceo',
    confirmed_at: '2026-09-21T00:00:00.000Z',
  });

  it('keeps lifecycle Pain when the active plan snapshot is empty', () => {
    const out = overlayLifecycleTmmt({
      lifecycleId: 5,
      target_market_prof: {
        market_context: 'Detailing VN',
        segmentation_icp: 'SME auto',
        personas_roles: 'Owner',
        pains_desired_outcomes: 'Lead ổn định',
        geo_behavior: 'Việt Nam HCM',
        tam_sam_som: 'TAM',
        jobs_to_be_done: 'JTBD',
        insights_evidence: 'Insight',
      },
      strategy_framework: {
        target_market: 'Việt Nam',
        ai_tmmt_field_meta: JSON.stringify({
          pains_desired_outcomes: confirmed('Lead ổn định'),
          segmentation_icp: confirmed('SME auto'),
        }),
      },
      snapshot: {
        target_market_prof: { market_context: 'only snapshot' },
        strategy_framework: {},
      },
    });
    expect(out.changed).toBe(false);
    expect(out.target_market_prof.pains_desired_outcomes).toBe('Lead ổn định');
    expect(out.target_market_prof.market_context).toBe('Detailing VN');
  });

  it('remaps Pain from Consult when the lifecycle core is empty', () => {
    const out = overlayLifecycleTmmt({
      lifecycleId: 5,
      target_market_prof: {
        market_context: 'Detailing VN',
        segmentation_icp: 'SME auto',
        personas_roles: 'Owner',
        geo_behavior: 'Việt Nam',
        tam_sam_som: 'TAM',
        jobs_to_be_done: 'JTBD',
      },
      strategy_framework: {
        target_market: 'Việt Nam',
        ai_tmmt_field_meta: JSON.stringify({
          market_context: confirmed('Detailing VN'),
          segmentation_icp: confirmed('SME auto'),
          personas_roles: confirmed('Owner'),
        }),
      },
      consultPain: confirmed('Lead ổn định từ Consult'),
    });
    expect(out.changed).toBe(true);
    expect(out.target_market_prof.pains_desired_outcomes).toBe('Lead ổn định từ Consult');
    const meta = JSON.parse(out.strategy_framework.ai_tmmt_field_meta);
    expect(meta.pains_desired_outcomes.status).toBe('assumed_confirmed');
    expect(meta.pains_desired_outcomes.lifecycle_id).toBe(5);
    expect(meta.segmentation_icp.status).toBe('assumed_confirmed');
  });
});
