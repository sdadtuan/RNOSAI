import ExcelJS from 'exceljs';
import {
  RAW_LEAD_EXPORT_HEADERS,
  buildRawLeadsCsv,
  buildRawLeadsXlsx,
} from './export-csv.util';

const sampleRow = {
  company_name: 'Spa A, HN',
  address: '12 Phố Huế, Hà Nội',
  phone: '0903111222',
  email: 'a@spa.vn',
  website: 'https://spa.vn',
  fanpage_url: 'https://facebook.com/spa',
  zalo_url: 'https://zalo.me/0903111222',
  contact_title: 'Owner',
  evidence_url: 'https://spa.vn',
  quality_score: 70,
  icp_fit_score: 60,
  source_provider: 'openai',
  source_model: 'gpt',
  search_source_keys: ['google_maps', 'company_website'],
  status: 'accepted',
};

describe('export-csv.util', () => {
  it('exports header + rows with contact channel columns', () => {
    const csv = buildRawLeadsCsv([sampleRow]);
    const header = csv.split('\n')[0];
    expect(header).toContain('website');
    expect(header).toContain('fanpage_url');
    expect(header).toContain('zalo_url');
    expect(csv).toContain('"Spa A, HN"');
    expect(csv).toContain('https://zalo.me/0903111222');
    expect(csv).toContain('google_maps|company_website');
  });

  it('buildRawLeadsXlsx produces a workbook with headers and Vietnamese row values', async () => {
    const buf = await buildRawLeadsXlsx([sampleRow]);
    expect(buf.subarray(0, 2).toString()).toBe('PK');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws).toBeDefined();

    const headerRow = ws.getRow(1).values as (string | number | undefined)[];
    for (const h of RAW_LEAD_EXPORT_HEADERS) {
      expect(headerRow).toContain(h);
    }

    const companyCol = RAW_LEAD_EXPORT_HEADERS.indexOf('company_name') + 1;
    expect(ws.getRow(2).getCell(companyCol).value).toBe('Spa A, HN');

    const addressCol = RAW_LEAD_EXPORT_HEADERS.indexOf('address') + 1;
    expect(ws.getRow(2).getCell(addressCol).value).toBe('12 Phố Huế, Hà Nội');

    const sourcesCol = RAW_LEAD_EXPORT_HEADERS.indexOf('sources') + 1;
    expect(ws.getRow(2).getCell(sourcesCol).value).toBe('google_maps|company_website');
  });
});