import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { amountInWordsVi } from './amount-in-words-vi';
import type { PricedLine, QuoteDisplayMode, QuoteTotals } from './quote-calc';
import { formatViDate } from './quote-validity';

export const PDF_RENDERER_VERSION = 'p13-pdfkit-1';

export type QuotePdfInput = {
  mode: 'draft' | 'final';
  display_mode: QuoteDisplayMode;
  quote_code: string;
  version_n: number;
  issued_on: string;
  issued_provisional: boolean;
  validity_days: number;
  valid_until: string;
  client_name: string;
  am_name: string;
  company: { legal_name: string; tax_code: string; contact: string };
  lines: PricedLine[];
  totals: NonNullable<QuoteTotals['totals']>;
  extra_discount_pct: string | null;
  payment_terms: string;
  notes: string[];
};

const MARGIN = 42.52;

function money(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const negative = value.startsWith('-');
  const digits = (negative ? value.slice(1) : value).split('.')[0] ?? '0';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negative ? `-${grouped}` : grouped;
}

function fontFile(weight: 'Regular' | 'SemiBold' | 'Bold'): string {
  const name = `BeVietnamPro-${weight}.ttf`;
  const candidates = [
    join(process.cwd(), 'assets/fonts', name),
    join(process.cwd(), '../../assets/fonts', name),
    join(__dirname, '../../../../../assets/fonts', name),
    join(__dirname, '../../../../../../assets/fonts', name),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`missing font ${name}`);
  return found;
}

function logoFile(): string | null {
  const candidates = [
    join(process.cwd(), 'docs/brand/ptt-logo.png'),
    join(process.cwd(), '../../docs/brand/ptt-logo.png'),
    join(__dirname, '../../../../../docs/brand/ptt-logo.png'),
    join(__dirname, '../../../../../../docs/brand/ptt-logo.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN + 16, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });
  doc.registerFont('BeVietnamPro', fontFile('Regular'));
  doc.registerFont('BeVietnamPro-SemiBold', fontFile('SemiBold'));
  doc.registerFont('BeVietnamPro-Bold', fontFile('Bold'));
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const showDiscount = input.lines.some((line) => line.discount_pct && Number(line.discount_pct) > 0);
  const widths = showDiscount ? [28, 190, 42, 36, 70, 52, 72] : [28, 220, 48, 40, 78, 76];
  const headers = showDiscount
    ? ['STT', 'Nội dung', 'ĐVT', 'SL', 'Đơn giá', 'CK', 'Thành tiền']
    : ['STT', 'Nội dung', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'];

  const drawHeader = () => {
    const logo = logoFile();
    if (logo) {
      try {
        doc.image(logo, MARGIN, MARGIN, { height: 28 });
      } catch {
        /* logo is optional */
      }
    }
    doc.font('BeVietnamPro-Bold').fontSize(11).fillColor('#17692f').text(input.company.legal_name || '—', MARGIN + 70, MARGIN, { width: 400 });
    doc.font('BeVietnamPro').fontSize(8).fillColor('#333').text(`MST: ${input.company.tax_code || '—'}`, MARGIN + 70, MARGIN + 16);
    doc.text(input.company.contact || '—', MARGIN + 70, MARGIN + 28);
    doc.moveDown(2);
    doc.font('BeVietnamPro-Bold').fontSize(16).fillColor('#17692f').text('BÁO GIÁ DỊCH VỤ', { align: 'center' });
    doc.font('BeVietnamPro').fontSize(10).fillColor('#222');
    doc.text(`${input.quote_code} (v${input.version_n})`, { align: 'center' });
    const issued = formatViDate(input.issued_on);
    doc.text(input.issued_provisional ? `Ngày ${issued} (dự kiến)` : `Ngày ${issued}`, { align: 'center' });
    doc.text(`Hiệu lực: ${input.validity_days} ngày, đến ${formatViDate(input.valid_until)}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(9).text(`Khách hàng: ${input.client_name || '—'}`);
    doc.text(`AM: ${input.am_name || '—'}`);
    doc.moveDown(0.4);
    drawTableHeader(headers, widths);
  };

  const drawTableHeader = (labels: string[], cols: number[]) => {
    const y = doc.y;
    doc.font('BeVietnamPro-SemiBold').fontSize(8).fillColor('#17692f');
    let x = MARGIN;
    labels.forEach((label, index) => {
      doc.text(label, x, y, { width: cols[index], align: index >= 3 ? 'right' : 'left' });
      x += cols[index] ?? 0;
    });
    doc.moveTo(MARGIN, y + 12).lineTo(doc.page.width - MARGIN, y + 12).strokeColor('#17692f').stroke();
    doc.y = y + 16;
    doc.font('BeVietnamPro').fillColor('#222');
  };

  const ensureRoom = (height: number) => {
    if (doc.y + height < doc.page.height - MARGIN - 24) return;
    doc.addPage();
    drawTableHeader(headers, widths);
  };

  drawHeader();
  doc.font('BeVietnamPro-SemiBold').fontSize(10).text('Phí dịch vụ');
  doc.moveDown(0.2);
  let stt = 0;
  for (const line of input.lines) {
    if (line.line_type === 'ad_budget' || line.line_type === 'third_party') continue;
    stt += 1;
    ensureRoom(36);
    const values = showDiscount
      ? [String(stt), line.description, line.unit, line.qty, money(line.unit_price), line.discount_pct ?? '', money(line.amount)]
      : [String(stt), line.description, line.unit, line.qty, money(line.unit_price), money(line.amount)];
    const y = doc.y;
    let x = MARGIN;
    doc.font('BeVietnamPro').fontSize(8);
    values.forEach((value, index) => {
      doc.text(value, x, y, { width: widths[index], align: index >= 3 ? 'right' : 'left' });
      x += widths[index] ?? 0;
    });
    doc.y = y + 16;
    if (line.line_type === 'package' && input.display_mode !== 'package_only') {
      doc.font('BeVietnamPro-SemiBold').fontSize(8).text('Phạm vi bao gồm', MARGIN + 16, doc.y, { width: 460 });
      doc.font('BeVietnamPro').fontSize(7.5);
      for (const row of line.scope) {
        ensureRoom(14);
        doc.text(row, MARGIN + 24, doc.y, { width: 450 });
      }
      if (input.display_mode === 'item_detail') {
        for (const name of line.included_items) {
          ensureRoom(14);
          doc.font('BeVietnamPro').fontSize(7.5).text(name, MARGIN + 24, doc.y, { width: 450 });
        }
      }
      if (line.exclusions.length) {
        ensureRoom(14);
        doc.font('BeVietnamPro').fontSize(7.5).text(`Không bao gồm: ${line.exclusions.join('; ')}`, MARGIN + 24, doc.y, { width: 450 });
      }
    }
  }

  const totals = input.totals;
  doc.moveDown(0.4);
  doc.font('BeVietnamPro').fontSize(9);
  doc.text(`Cộng phí: ${money(totals.fee_subtotal)}`);
  doc.text(`Chiết khấu: ${money(totals.extra_discount_amount)}`);
  doc.text(`VAT: ${money(totals.fee_vat)}`);
  doc.font('BeVietnamPro-Bold').text(`TỔNG: ${money(totals.grand_total)}`);
  doc.font('BeVietnamPro').fontSize(9).text(amountInWordsVi(totals.grand_total ?? '0'), MARGIN, doc.y, { width: 510 });
  const passLines = input.lines.filter((line) => line.line_type === 'ad_budget' || line.line_type === 'third_party');
  if (passLines.length || (totals.passthrough_total && totals.passthrough_total !== '0')) {
    doc.moveDown(0.4);
    doc.font('BeVietnamPro-SemiBold').text('Chi phí chuyển tiếp (thu hộ)');
    doc.font('BeVietnamPro');
    for (const line of passLines) doc.text(`${line.description}: ${money(line.amount)}`);
    doc.text(`Tổng thu hộ: ${money(totals.passthrough_total)}`);
  }
  doc.moveDown(0.4);
  doc.font('BeVietnamPro-SemiBold').text('Điều khoản thanh toán');
  doc.font('BeVietnamPro').text(input.payment_terms.trim() || '—');
  doc.moveDown(0.8);
  const signY = doc.y;
  doc.text('ĐẠI DIỆN PTT', MARGIN, signY, { width: 220, align: 'center' });
  doc.text('ĐẠI DIỆN KHÁCH HÀNG', MARGIN + 260, signY, { width: 220, align: 'center' });

  if (input.mode === 'draft') {
    doc.addPage();
    doc.font('BeVietnamPro-Bold').fontSize(12).fillColor('#17692f').text('Ghi chú nội bộ');
    doc.font('BeVietnamPro').fontSize(9).fillColor('#222');
    doc.moveDown(0.4);
    if (!input.notes.length) doc.text('Không có cảnh báo.');
    for (const note of input.notes) doc.text(note);
  }

  const range = doc.bufferedPageRange();
  for (let page = 0; page < range.count; page += 1) {
    doc.switchToPage(page);
    if (input.mode === 'draft') {
      doc.save();
      doc.rotate(-32, { origin: [300, 420] });
      doc.font('BeVietnamPro-Bold').fontSize(22).fillColor('#c0392b').opacity(0.18);
      doc.text('BẢN NHÁP — CHƯA DUYỆT', 70, 430, { lineBreak: false });
      doc.opacity(1).restore();
    }
    doc.font('BeVietnamPro').fontSize(8).fillColor('#666');
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.text(`Trang ${page + 1}/${range.count}`, MARGIN, doc.page.height - 28, {
      width: doc.page.width - MARGIN * 2,
      align: 'center',
      lineBreak: false,
    });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
