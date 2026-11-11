import { looksLikePhoneValue, normalizeLeadFieldName, parseLeadFieldData } from './portal-lead-fields.util';

describe('parseLeadFieldData', () => {
  it('reads standard Graph phone_number and keeps every answer', () => {
    const parsed = parseLeadFieldData([
      { name: 'full_name', values: ['Nguyen Van A'] },
      { name: 'phone_number', values: ['0901234567'] },
      { name: 'email', values: ['a@x.com'] },
      { name: 'Bạn quan tâm dịch vụ nào?', values: ['Landing page'] },
    ]);
    expect(parsed.full_name).toBe('Nguyen Van A');
    expect(parsed.phone).toBe('0901234567');
    expect(parsed.email).toBe('a@x.com');
    expect(parsed.answers).toHaveLength(4);
    expect(parsed.answers[3]).toEqual({ name: 'Bạn quan tâm dịch vụ nào?', value: 'Landing page' });
  });

  it('reads Vietnamese phone labels and digit-only fallback', () => {
    expect(normalizeLeadFieldName('Số điện thoại')).toBe('so_dien_thoai');
    const labeled = parseLeadFieldData([{ name: 'Số điện thoại', values: ['+84901234567'] }]);
    expect(labeled.phone).toBe('+84901234567');
    const guessed = parseLeadFieldData([
      { name: 'full_name', values: ['B'] },
      { name: 'Liên hệ', values: ['0912345678'] },
    ]);
    expect(guessed.phone).toBe('0912345678');
    expect(looksLikePhoneValue('abc')).toBe(false);
  });
});
