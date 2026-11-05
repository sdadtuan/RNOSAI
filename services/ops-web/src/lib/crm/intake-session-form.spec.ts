import { describe, expect, it } from 'vitest';
import type { IntakeSessionRow } from '@/lib/api';
import { buildCreateIntakeSessionBody, intakeFormFromSession } from './intake-session-form';

function sessionFixture(overrides: Partial<IntakeSessionRow> = {}): IntakeSessionRow {
  return {
    id: 1,
    lead_id: 1,
    lifecycle_id: null,
    service_slug: '_common',
    mode: 'phone',
    status: 'draft',
    contact_name: '',
    company_name: '',
    bant_total: 0,
    decision: '',
    decision_reason: '',
    bant_json: {},
    answers_json: {},
    updated_at: '',
    ...overrides,
  };
}

describe('intakeFormFromSession', () => {
  it('parses win_checklist from answers_json', () => {
    const form = intakeFormFromSession(
      sessionFixture({ answers_json: { win_checklist: { incumbent: 4 } } }),
    );
    expect(form.winChecklist).toEqual({ incumbent: 4 });
  });
});

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
