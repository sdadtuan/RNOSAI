import PDFDocument from 'pdfkit';
import type { IwrReportStatus } from './iwr.types';

const SECTION_LABELS: Record<string, string> = {
  general: 'Thông tin chung',
  done: 'Việc xong',
  wip: 'Đang làm',
  next: 'Kế hoạch tiếp',
  blocked: 'Blocker',
  approvals: 'Yêu cầu phê duyệt',
  notes: 'Ghi chú',
  rag: 'RAG',
  priorities: 'Ưu tiên',
  highlights: 'Highlights',
  kpi: 'KPI',
  deliverables: 'Deliverable',
  plan_vs_actual: 'Plan vs actual',
  next_week: 'Tuần sau',
  decisions: 'Cần quyết định',
  month_highlights: 'Highlights tháng',
  people: 'People',
};

export function labelForIwrSection(key: string): string {
  return SECTION_LABELS[key] ?? key;
}

function sectionBody(section: unknown): string {
  if (!section || typeof section !== 'object') return '';
  const body = (section as { body?: string }).body;
  return String(body ?? '').trim();
}

export function renderIwrReportPdf(detail: {
  title: string;
  author_name: string;
  period_start: string;
  period_end: string;
  status: string;
  sections: { key: string; label: string; body: string }[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  doc.fontSize(18).text(detail.title || 'Báo cáo nội bộ', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Tác giả: ${detail.author_name || '—'}`);
  doc.text(`Kỳ: ${detail.period_start} — ${detail.period_end}`);
  doc.text(`Trạng thái: ${detail.status}`);
  doc.moveDown();

  for (const sec of detail.sections) {
    if (!sec.body) continue;
    doc.fontSize(14).text(sec.label, { underline: true });
    doc.fontSize(11).text(sec.body);
    doc.moveDown();
  }

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export function buildPdfSections(
  sectionsJson: Record<string, unknown>,
  keys: string[],
): { key: string; label: string; body: string }[] {
  return keys
    .map((key) => ({
      key,
      label: labelForIwrSection(key),
      body: sectionBody(sectionsJson[key]),
    }))
    .filter((s) => s.body.length > 0);
}

export const IWR_STATUS_LABELS: Record<IwrReportStatus, string> = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  changes_requested: 'Cần bổ sung',
  supplemented: 'Đã bổ sung',
  acknowledged: 'Đã xác nhận',
  waived: 'Không cần nộp',
  archived: 'Lưu trữ',
};
