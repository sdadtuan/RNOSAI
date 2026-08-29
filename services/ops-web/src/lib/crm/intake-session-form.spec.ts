import { describe, expect, it } from 'vitest';
import { buildCreateIntakeSessionBody } from './intake-session-form';

describe('buildCreateIntakeSessionBody', () => {
  it('sends resolved service slug', () => {
    const body = buildCreateIntakeSessionBody({
      leadId: 5,
      lifecycleId: 0,
      mode: 'phone',
      lead: { full_name: 'Tuan', source: 'facebook' },
      serviceSlug: 'dich-vu-seo-tong-the',
    });
    expect(body.service_slug).toBe('dich-vu-seo-tong-the');
    expect(body.lead_id).toBe(5);
  });

  it('defaults _common when slug omitted', () => {
    expect(
      buildCreateIntakeSessionBody({ leadId: 1, lifecycleId: 0, mode: 'phone' }).service_slug,
    ).toBe('_common');
  });
});
