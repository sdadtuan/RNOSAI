import { parseSalesKitXlsx } from './sales-kit-ingest.util';
import { buildSalesKitSampleXlsx } from './sales-kit-sample.util';

describe('buildSalesKitSampleXlsx', () => {
  it('builds 5 SEO Q&A rows including KH nói đắt', async () => {
    const buf = await buildSalesKitSampleXlsx();
    const out = await parseSalesKitXlsx(buf, 'qa');
    expect(out.chunks).toHaveLength(5);
    const bodies = out.chunks.map((c) => c.body).join('\n');
    expect(bodies).toContain('KH nói đắt');
    expect(bodies).toContain('Neo gói TC 3 tháng, không giảm dưới band');
  });
});
