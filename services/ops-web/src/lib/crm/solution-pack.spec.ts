import { describe, expect, it } from 'vitest';
import { buildSolutionDocumentHtml, mergeSolutionLines, solutionPackReady, solutionSubmitGaps } from './solution-pack';

describe('solution pack', () => {
  const lines = mergeSolutionLines(
    [{ code: 'WEB-01-01', label: 'Tiếp nhận bàn giao website' }],
    [{ code: 'WEB-01-01', label: '', work: 'Nhận tài khoản', outOfScope: 'Không viết lại web', timing: '3 ngày', result: 'Biên bản bàn giao' }],
  );

  it('uses a short customer title and drops the internal instruction', () => {
    const titled = mergeSolutionLines(
      [{ code: 'WEB-02-01', label: 'Audit website hiện tại — Đọc SOW nội bộ' }],
      [],
    );
    expect(titled[0]?.customerTitle).toBe('Audit website hiện tại');
  });

  it('keeps saved text on the locked hạng mục', () => {
    expect(lines[0]?.work).toBe('Nhận tài khoản');
    expect(solutionPackReady(lines)).toBe(true);
    expect(solutionPackReady([{ ...lines[0], result: ' ' }])).toBe(false);
  });

  it('does not block nộp on hạng mục text or Solution.html once a file is uploaded', () => {
    expect(solutionSubmitGaps({ lines, fileNames: ['Solution.html'] })).toEqual([]);
    expect(solutionSubmitGaps({ lines, fileNames: ['Quy-trinh.pdf'] })).toEqual([]);
    expect(
      solutionSubmitGaps({
        lines: [{ ...lines[0], work: '', result: '' }],
        fileNames: ['Quy-trinh.pdf'],
      }),
    ).toEqual([]);
    const blocked = solutionSubmitGaps({ lines: [], fileNames: [] }).join('\n');
    expect(blocked).not.toContain('Điền việc sẽ làm');
    expect(blocked).not.toContain('Đóng gói Solution trước khi nộp');
  });

  it('builds a customer file without internal scores or item codes', () => {
    const html = buildSolutionDocumentHtml({
      company: 'Spa Đà Nẵng',
      service: 'Lead generation',
      owner: 'Nguyễn Minh Khoa',
      dateLabel: '4/11/2026',
      problem: 'Quảng cáo chưa ra khách',
      approach: 'Làm lại website và form',
      lines,
    });
    expect(html).toContain('Spa Đà Nẵng');
    expect(html).toContain('Tiếp nhận bàn giao website');
    expect(html).toContain('Nhận tài khoản');
    expect(html).toContain('Biên bản bàn giao');
    expect(html).toContain('3 ngày');
    expect(html).toContain('Không viết lại web');
    expect(html.match(/Không viết lại web/g)).toHaveLength(1);
    expect(html).toContain('Báo giá chi tiết');
    expect(html).not.toContain('Sale');
    expect(html).not.toContain('WEB-01-01');
    expect(html).not.toContain('BANT');
  });
});
