import { vndInWords } from './vnd-in-words';

describe('vndInWords', () => {
  it('reads the sample Giai đoạn 1 amount', () => {
    expect(vndInWords(29_548_800)).toBe(
      'Hai mươi chín triệu năm trăm bốn mươi tám nghìn tám trăm đồng chẵn',
    );
  });

  it('reads the sample max contract amount', () => {
    expect(vndInWords(75_686_400)).toBe(
      'Bảy mươi lăm triệu sáu trăm tám mươi sáu nghìn bốn trăm đồng chẵn',
    );
  });

  it('handles zero and linh', () => {
    expect(vndInWords(0)).toBe('Không đồng');
    expect(vndInWords(1_001)).toBe('Một nghìn không trăm linh một đồng chẵn');
    expect(vndInWords(15)).toBe('Mười lăm đồng chẵn');
    expect(vndInWords(21)).toBe('Hai mươi mốt đồng chẵn');
  });
});
