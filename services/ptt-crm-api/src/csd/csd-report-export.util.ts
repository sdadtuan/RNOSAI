import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { normalizeSection, type CsdReportSection } from './csd-report-blocks';

export type CsdReportExportDetail = {
  title: string;
  version: string;
  period_start: string;
  period_end: string;
  client_label: string;
  sections: { key: string; label: string; section: CsdReportSection }[];
};

const SECTION_LABELS: Record<string, string> = {
  cover: 'Bìa',
  executive_summary: 'Tóm tắt điều hành',
  ticket_sla: 'Ticket & SLA',
  work_completed: 'Công việc hoàn thành',
  risks: 'Rủi ro & chặn',
  next_week: 'Kế hoạch tuần tới',
  next_period: 'Kế hoạch kỳ tới',
  next_month: 'Kế hoạch tháng tới',
  kpi: 'KPI',
  channels: 'Kênh',
  appendix: 'Phụ lục',
  sla_kpis: 'KPI SLA',
  breaches: 'Vi phạm SLA',
  reopens: 'Mở lại',
  recommendations: 'Khuyến nghị',
  asks: 'Đề xuất / Asks',
};

function sectionText(section: CsdReportSection): string {
  return section.blocks
    .filter((b): b is Extract<typeof b, { type: 'rich_text' }> => b.type === 'rich_text')
    .map((b) => b.body)
    .filter(Boolean)
    .join('\n');
}

export function labelForSection(key: string): string {
  return SECTION_LABELS[key] ?? key;
}

export function renderCsdReportPdf(detail: {
  title: string;
  version: string;
  period_start: string;
  period_end: string;
  client_label: string;
  sections: { key: string; label: string; section: CsdReportSection }[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  doc.fontSize(18).text(detail.title || 'Báo cáo CSD', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Khách hàng: ${detail.client_label || '—'}`);
  doc.text(`Kỳ: ${detail.period_start} — ${detail.period_end}`);
  doc.text(`Phiên bản: ${detail.version}`);
  doc.moveDown();

  for (const item of detail.sections) {
    const section = normalizeSection(item.section);
    doc.fontSize(14).text(item.label || labelForSection(item.key), { underline: true });
    doc.moveDown(0.3);
    for (const block of section.blocks) {
      if (block.type === 'rich_text') {
        doc.fontSize(11).text(block.body || '');
        doc.moveDown(0.4);
      } else if (block.type === 'kpi_table') {
        doc.fontSize(11).text('KPI');
        for (const row of block.rows ?? []) {
          const line = [row.metric, row.value, row.target, row.note].filter((v) => v != null && String(v) !== '').join(' | ');
          if (line) doc.fontSize(10).text(line);
        }
        doc.moveDown(0.4);
      }
    }
    doc.moveDown();
  }

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function renderCsdReportXlsx(detail: {
  title: string;
  version: string;
  period_start: string;
  period_end: string;
  client_label: string;
  sections: { key: string; label: string; section: CsdReportSection }[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const kpi = wb.addWorksheet('KPI');
  kpi.addRow(['metric', 'value', 'target', 'note']);
  const sections = wb.addWorksheet('Sections');
  sections.addRow(['key', 'text']);

  for (const item of detail.sections) {
    const section = normalizeSection(item.section);
    for (const block of section.blocks) {
      if (block.type === 'kpi_table') {
        for (const row of block.rows ?? []) {
          kpi.addRow([row.metric ?? '', row.value ?? '', row.target ?? '', row.note ?? '']);
        }
      }
    }
    sections.addRow([item.key, sectionText(section)]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
