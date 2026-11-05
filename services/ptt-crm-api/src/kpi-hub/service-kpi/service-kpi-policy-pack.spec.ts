import { evaluatePolicyPack, REAL_ESTATE_PACK } from './service-kpi-policy-pack';

describe('evaluatePolicyPack BĐS', () => {
  it('blocks booking as COMMITTED_DELIVERABLE', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'COMMITTED_DELIVERABLE',
      kpiKind: 'booking_or_gmv',
    });
    expect(v.some((x) => x.code === 'PACK_FORBIDDEN_CLASSIFICATION')).toBe(true);
  });

  it('blocks banned phrase on projected result (AC-SKPI-08)', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'PROJECTED_RESULT',
      proposalText: 'Chúng tôi cam kết doanh số 200 căn',
      hasDisclaimer: true,
    });
    expect(v.some((x) => x.code === 'PACK_BANNED_PHRASE')).toBe(true);
  });

  it('requires attribution + sales SLA + disclaimer for BUSINESS_OUTCOME', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'BUSINESS_OUTCOME',
      kpiKind: 'booking_or_gmv',
    });
    expect(v.map((x) => x.code)).toEqual(
      expect.arrayContaining([
        'PACK_REQUIRE_ATTRIBUTION',
        'PACK_REQUIRE_CLIENT_SALES_SLA',
        'PACK_REQUIRE_DISCLAIMER',
      ]),
    );
  });
});
