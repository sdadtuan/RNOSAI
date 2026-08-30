import { BANT_KEY_BY_QUESTION_KEY, getUiDefinition } from './intake-definitions.util';

describe('getUiDefinition pilots', () => {
  it('returns common for unknown and aeo', () => {
    const common = getUiDefinition('_common') as { is_pilot_form?: boolean; slug: string };
    expect(common.slug).toBe('_common');
    expect(common.is_pilot_form).toBe(false);
    expect((getUiDefinition('dich-vu-aeo') as { is_pilot_form?: boolean }).is_pilot_form).toBe(false);
  });

  it('seo pilot has seo_domain and qualify_items', () => {
    const seo = getUiDefinition('dich-vu-seo-tong-the') as {
      is_pilot_form: boolean;
      schema_version: number;
      phone_question_items: Array<{ key: string; critical?: boolean }>;
      qualify_items: Array<{ key: string }>;
    };
    expect(seo.is_pilot_form).toBe(true);
    expect(seo.schema_version).toBe(4);
    expect(seo.phone_question_items.some((q) => q.key === 'seo_domain' && q.critical)).toBe(true);
    expect(seo.qualify_items.map((q) => q.key)).toEqual(
      expect.arrayContaining(['nganh', 'ngan_sach', 'domain', 'nhu_cau']),
    );
  });

  it('google ads and website are pilots', () => {
    expect((getUiDefinition('quang-cao-google') as { is_pilot_form: boolean }).is_pilot_form).toBe(true);
    expect((getUiDefinition('thiet-ke-website') as { is_pilot_form: boolean }).is_pilot_form).toBe(true);
  });
});

describe('getUiDefinition bant_key', () => {
  it('maps common phone BANT keys and skips domain', () => {
    const common = getUiDefinition('_common') as {
      phone_question_items: Array<{ key: string; bant_key?: string }>;
      inperson_question_items: Array<{ key: string; bant_key?: string }>;
      schema_version: number;
    };
    expect(common.schema_version).toBe(4);
    const byKey = Object.fromEntries(common.phone_question_items.map((q) => [q.key, q.bant_key]));
    expect(byKey.phone_budget).toBe('budget');
    expect(byKey.phone_decision_maker).toBe('authority');
    expect(byKey.phone_domain).toBeUndefined();
    const ip = Object.fromEntries(common.inperson_question_items.map((q) => [q.key, q.bant_key]));
    expect(ip.ip_marketing_team).toBeUndefined();
    expect(ip.ip_budget_approved).toBe('budget');
  });

  it('maps seo_history on SEO pilot', () => {
    const seo = getUiDefinition('dich-vu-seo-tong-the') as {
      phone_question_items: Array<{ key: string; bant_key?: string }>;
    };
    expect(seo.phone_question_items.find((q) => q.key === 'seo_history')?.bant_key).toBe('history');
    expect(seo.phone_question_items.find((q) => q.key === 'seo_domain')?.bant_key).toBeUndefined();
  });

  it('exports full spec map', () => {
    expect(BANT_KEY_BY_QUESTION_KEY.phone_kpi).toBe('need');
    expect(BANT_KEY_BY_QUESTION_KEY.web_deadline).toBe('timeline');
  });
});
