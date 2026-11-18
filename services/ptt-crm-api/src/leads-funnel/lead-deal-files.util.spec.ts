import { contentDispositionAttachment, decodeMultipartFileName, quoteVersionFileName } from './lead-deal-files.util';

describe('quote deal file names', () => {
  it('names each generated quote with its version', () => {
    expect(quoteVersionFileName(42, 1)).toBe('bao-gia-42-v1.xlsx');
    expect(quoteVersionFileName(42, 3)).toBe('bao-gia-42-v3.xlsx');
  });

  it('puts the stored file name in the download header', () => {
    const header = contentDispositionAttachment('bao-gia-42-v2.xlsx');
    expect(header).toContain('attachment;');
    expect(header).toContain('filename="bao-gia-42-v2.xlsx"');
    expect(header).toContain("filename*=UTF-8''bao-gia-42-v2.xlsx");
  });

  it('repairs a UTF-8 upload name that arrived as Latin-1', () => {
    const original = 'Báo giá đã sửa.xlsx';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');
    expect(decodeMultipartFileName(mojibake)).toBe(original);
    expect(decodeMultipartFileName(original)).toBe(original);
    expect(decodeMultipartFileName('bao-gia-42-v1.xlsx')).toBe('bao-gia-42-v1.xlsx');
  });

  it('keeps a unicode upload name in filename*', () => {
    const header = contentDispositionAttachment('Báo giá đã sửa.xlsx');
    const plain = /filename="([^"]+)"/.exec(header)?.[1] ?? '';
    expect(/^[\x20-\x7E]+$/.test(plain)).toBe(true);
    expect(plain).not.toContain('á');
    const star = /filename\*=UTF-8''([^;]+)/.exec(header)?.[1] ?? '';
    expect(decodeURIComponent(star)).toBe('Báo giá đã sửa.xlsx');
  });
});
