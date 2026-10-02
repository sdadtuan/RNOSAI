import { stripPricingView } from './pricing-serialize';

describe('pricing serializer', () => {
  it('drops salary and rate keys when the caller cannot view cost', () => {
    const body = stripPricingView(
      {
        code: 'PV-2026-01',
        roles: [{ role_code: 'dev', name: 'Dev', monthly_salary: '1', insurance_pct: '0.2', monthly_benefits: '1', hourly_rate: '1', productive_hours: '132' }],
        rates: { dev: { rate: '1', rate_display: '1' } },
        settings: { margin_pct: '0.25' },
      },
      false,
    );
    expect(body.roles?.[0]).toEqual({ role_code: 'dev', name: 'Dev', productive_hours: '132' });
    expect(body).not.toHaveProperty('rates');
    expect(JSON.stringify(body)).not.toContain('monthly_salary');
    expect(JSON.stringify(body)).not.toContain('hourly_rate');
  });
});
