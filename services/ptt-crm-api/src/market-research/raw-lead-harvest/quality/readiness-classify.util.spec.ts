import { classifyRawLeadReadiness } from './readiness-classify.util';

describe('classifyRawLeadReadiness', () => {
  const base = {
    phone_valid: true,
    email_valid: false,
    company_website_ok: true,
    social_only: false,
    quality_score: 40,
    blacklist_hit: false,
    existing_crm_customer: false,
    duplicate_phone_in_project: false,
    vertical_ok: true,
    territory_ok: true,
  };

  it('marks blacklist / CRM / dup phone as DUPLICATE_OR_BLACKLIST', () => {
    expect(classifyRawLeadReadiness({ ...base, blacklist_hit: true }).readiness_status).toBe(
      'DUPLICATE_OR_BLACKLIST',
    );
    expect(
      classifyRawLeadReadiness({ ...base, existing_crm_customer: true }).readiness_reason_codes,
    ).toContain('EXISTING_CUSTOMER');
    expect(
      classifyRawLeadReadiness({ ...base, duplicate_phone_in_project: true }).classification,
    ).toBe('rejected_dedupe');
  });

  it('marks no contact path as MISSING_CONTACT', () => {
    const out = classifyRawLeadReadiness({
      ...base,
      phone_valid: false,
      email_valid: false,
      company_website_ok: false,
      social_only: false,
      quality_score: 10,
    });
    expect(out.readiness_status).toBe('MISSING_CONTACT');
    expect(out.readiness_reason_codes).toContain('MISSING_PHONE');
  });

  it('marks phone + score ready as READY_TO_PUSH', () => {
    const out = classifyRawLeadReadiness(base);
    expect(out.readiness_status).toBe('READY_TO_PUSH');
    expect(out.classification).toBe('pass');
  });

  it('marks social-only or low score as NEEDS_REVIEW', () => {
    expect(
      classifyRawLeadReadiness({
        ...base,
        company_website_ok: false,
        social_only: true,
        quality_score: 40,
      }).readiness_status,
    ).toBe('NEEDS_REVIEW');
    expect(
      classifyRawLeadReadiness({ ...base, quality_score: 20 }).readiness_reason_codes,
    ).toContain('LOW_SCORE');
  });
});
