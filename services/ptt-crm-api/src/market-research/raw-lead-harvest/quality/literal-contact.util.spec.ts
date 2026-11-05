import {
  companyNameAppearsInText,
  emailAppearsInText,
  phoneAppearsInText,
} from './literal-contact.util';

describe('literal-contact.util', () => {
  it('matches +84 and spaced phones', () => {
    expect(phoneAppearsInText('+84 901 234 567', 'Gọi 0901234567 ngay')).toBe(true);
    expect(phoneAppearsInText('0901234567', 'không có số')).toBe(false);
  });

  it('matches email case-insensitive', () => {
    expect(emailAppearsInText('Info@Spa.vn', 'liên hệ info@spa.vn')).toBe(true);
  });

  it('matches company name loosely', () => {
    expect(companyNameAppearsInText('Spa Ánh Dương', 'Chào mừng đến Spa Anh Duong tại HN')).toBe(
      true,
    );
  });
});
