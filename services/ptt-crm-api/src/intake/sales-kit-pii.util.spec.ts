import { maskSalesKitPii } from './sales-kit-pii.util';

describe('maskSalesKitPii', () => {
  it('masks VN mobile and email', () => {
    expect(maskSalesKitPii('Gọi 0912345678 hoặc a@b.com')).toBe(
      'Gọi ***5678 hoặc ***@b.com',
    );
  });

  it('leaves gap-to-go score alone', () => {
    expect(maskSalesKitPii('Còn 24 điểm để Go')).toBe('Còn 24 điểm để Go');
  });
});
