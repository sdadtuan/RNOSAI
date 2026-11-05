import { buildPresalesFormPatchFromIntake, syncPresalesServiceSlug } from './intake-presales-sync.util';
import type { IntakeSessionRow } from './intake.types';

describe('buildPresalesFormPatchFromIntake', () => {
  it('maps need rich text to need_summary', () => {
    const session = {
      id: 5,
      bant_total: 21,
      decision: 'go',
      answers_json: {
        crm_fields: { need: '<p>Cần SEO tổng thể</p>' },
      },
    } as unknown as IntakeSessionRow;

    const patch = buildPresalesFormPatchFromIntake(session);
    expect(patch.need_summary).toBe('Cần SEO tổng thể');
    expect(patch.intake_session_id).toBe(5);
    expect(patch.bant_total).toBe(21);
    expect(patch.decision).toBe('go');
  });
});

describe('syncPresalesServiceSlug', () => {
  it('writes the chosen service onto the open presales row', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await syncPresalesServiceSlug({ query } as never, 900000024, 'dich-vu-seo-tong-the');
    expect(String(query.mock.calls[0][0])).toContain('crm_lead_presales');
    expect(query.mock.calls[0][1]).toEqual([900000024, 'dich-vu-seo-tong-the']);
  });

  it('does not overwrite the funnel when no service is chosen', async () => {
    const query = jest.fn();
    await syncPresalesServiceSlug({ query } as never, 900000024, '_common');
    expect(query).not.toHaveBeenCalled();
  });
});
