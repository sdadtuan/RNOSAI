import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildSolutionAiPptxNodeBuffer, solutionAiPptxFileName } from './solution-ai-pptx';

const FIXTURE = {
  customer: 'Công ty Seed 685',
  contactName: 'Nguyễn Văn A',
  leadCode: '920685',
  createdAt: '20/11/2026 10:00',
  subtitle: 'KH MKT sơ bộ — spa',
  sections: [
    { key: 'executive_summary', label: 'Tóm tắt điều hành', body: 'Tăng nhận diện thương hiệu tại Hà Nội.' },
    { key: 'objectives', label: 'Mục tiêu và KPI', body: '40 lịch hẹn / tháng.' },
  ],
};

describe('buildSolutionAiPptxNodeBuffer', () => {
  it('builds a zip/pptx with Vietnamese labels and section content', async () => {
    const buf = await buildSolutionAiPptxNodeBuffer(FIXTURE, null);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(buf);
    const slideKeys = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
    expect(slideKeys.length).toBeGreaterThanOrEqual(2);

    const xmlParts = await Promise.all(slideKeys.map((key) => zip.file(key)!.async('string')));
    const combined = xmlParts.join('\n');
    expect(combined).toMatch(/Tóm tắt điều hành/);
    expect(combined).toMatch(/Tăng nhận diện thương hiệu/);
    expect(combined).toMatch(/Mục tiêu và KPI/);
  });
});

describe('solutionAiPptxFileName', () => {
  it('sanitizes customer name and uses .pptx extension', () => {
    expect(solutionAiPptxFileName({ customer: 'Acme/Corp', sections: FIXTURE.sections })).toBe(
      'Solution - Acme Corp (AI).pptx',
    );
  });
});