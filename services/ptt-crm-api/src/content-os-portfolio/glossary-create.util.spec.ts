import { parseGlossaryCreate } from './glossary-create.util';

describe('parseGlossaryCreate', () => {
  it('requires term locale brand_id lifecycle', () => {
    expect(() => parseGlossaryCreate({ term: 'sống xanh' })).toThrow('locale_required');
    expect(parseGlossaryCreate({
      term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4,
    })).toEqual({
      term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4,
    });
  });

  it('rejects missing term and brand_id', () => {
    expect(() => parseGlossaryCreate({ locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4 })).toThrow(
      'term_required',
    );
    expect(() =>
      parseGlossaryCreate({ term: 'sống xanh', locale: 'vi-VN', lifecycle_id: 4 }),
    ).toThrow('brand_id_required');
  });
});
