import { buildReadinessInputFromRawLead } from './readiness-from-row.util';
import { classifyRawLeadReadiness } from './readiness-classify.util';

const ctxOk = {
  blacklist_hit: false,
  existing_crm_customer: false,
  duplicate_phone_in_project: false,
  vertical_ok: true,
  territory_ok: true,
};

describe('buildReadinessInputFromRawLead', () => {
  it('maps valid phone + score to READY via classifier', () => {
    const input = buildReadinessInputFromRawLead(
      {
        phone: '0909479018',
        phone_norm: '0909479018',
        website: 'https://spa.example',
        quality_score: 55,
        verify_json: { phone_ok: true },
      },
      ctxOk,
    );
    expect(input.phone_valid).toBe(true);
    expect(classifyRawLeadReadiness(input).readiness_status).toBe('READY_TO_PUSH');
  });

  it('treats missing phone as MISSING_CONTACT', () => {
    const input = buildReadinessInputFromRawLead(
      { phone: null, phone_norm: null, quality_score: 40 },
      ctxOk,
    );
    expect(input.phone_valid).toBe(false);
    expect(classifyRawLeadReadiness(input).readiness_status).toBe('MISSING_CONTACT');
  });

  it('flags social-only fanpage without company site', () => {
    const input = buildReadinessInputFromRawLead(
      {
        phone: '0909479018',
        phone_norm: '0909479018',
        website: null,
        fanpage_url: 'https://facebook.com/spa',
        quality_score: 50,
        verify_json: { phone_ok: true },
      },
      ctxOk,
    );
    expect(input.social_only).toBe(true);
    expect(classifyRawLeadReadiness(input).readiness_status).toBe('NEEDS_REVIEW');
  });

  it('honors verify_json.phone_ok false', () => {
    const input = buildReadinessInputFromRawLead(
      {
        phone: '0909479018',
        phone_norm: '0909479018',
        quality_score: 60,
        verify_json: { phone_ok: false },
      },
      ctxOk,
    );
    expect(input.phone_valid).toBe(false);
  });
});
