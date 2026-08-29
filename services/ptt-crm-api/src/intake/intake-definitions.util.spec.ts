import { getUiDefinition } from './intake-definitions.util';

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
    expect(seo.schema_version).toBe(3);
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
