import { buildDraft } from './msos-draft.util';

describe('msos-draft.util', () => {
  it('builds io draft from facts without inventing numbers', () => {
    const out = buildDraft('io', {
      display_code: 'ML-20260912-A1B2',
      io_qty: 300,
      rate_version: 2,
      report_qty: null,
    });
    expect(out.actor).toBe('template_a1');
    expect(out.text).toContain('300');
    expect(out.text).toContain('chưa có report');
    expect(out.facts.io_qty).toBe(300);
  });

  it('builds traffic draft', () => {
    const out = buildDraft('traffic', {
      display_code: 'ML-20260912-A1B2',
      traffic_status: 'draft',
      click_url: 'https://example.com',
    });
    expect(out.text).toContain('Traffic');
    expect(out.facts.click_url).toBe('https://example.com');
  });

  it('builds discrepancy draft with report qty', () => {
    const out = buildDraft('discrepancy', {
      display_code: 'ML-20260912-A1B2',
      io_qty: 300,
      report_qty: 282,
      material: true,
    });
    expect(out.text).toContain('282');
    expect(out.text).toContain('300');
    expect(out.facts.material).toBe(true);
  });
});
