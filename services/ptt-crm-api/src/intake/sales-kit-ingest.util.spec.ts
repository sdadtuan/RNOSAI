import ExcelJS from 'exceljs';
import { parseSalesKitXlsx } from './sales-kit-ingest.util';

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('qa');
  rows.forEach((r) => sh.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('sales-kit-ingest.util', () => {
  it('parses Q/A aliases', async () => {
    const buf = await xlsx([
      ['cau_hoi', 'cau_tra_loi'],
      ['KH nói đắt', 'Neo gói TC 3 tháng, không giảm dưới band'],
    ]);
    const out = await parseSalesKitXlsx(buf, 'qa');
    expect(out.chunks).toHaveLength(1);
    expect(out.chunks[0].body).toContain('KH nói đắt');
    expect(out.chunks[0].body).toContain('Neo gói TC');
    expect(out.chunks[0].kind).toBe('qa');
  });

  it('fails without Q/A columns', async () => {
    const buf = await xlsx([['foo', 'bar'], ['a', 'b']]);
    expect((await parseSalesKitXlsx(buf, 'qa')).error).toBe('xlsx_qa_columns');
  });

  it('parses pricing sheet', async () => {
    const buf = await xlsx([
      ['goi', 'min_vnd', 'max_vnd', 'note'],
      ['SEO TC', '15000000', '25000000', '3 tháng'],
    ]);
    const out = await parseSalesKitXlsx(buf, 'pricing');
    expect(out.chunks[0].body).toMatch(/15/);
    expect(out.chunks[0].kind).toBe('pricing');
  });
});
