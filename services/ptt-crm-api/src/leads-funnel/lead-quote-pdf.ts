import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { QuoteSheetGroup, QuoteSheetRow, QuoteSheetView } from './quote-sheet.util';

type Doc = InstanceType<typeof PDFDocument>;

const FONT = 'BeVietnamPro';
const FONT_BOLD = 'BeVietnamPro-Bold';

const BAND = '#14382F';
const ACCENT = '#3E7A66';
const INK = '#1A2421';
const MUTED = '#5E6B66';
const LINE = '#D5E0DB';
const RULE = '#E4EBE8';
const HEAD_TEXT = '#FFFFFF';
const GROUP_BG = '#E7F3EE';
const ALT_BG = '#F5F8F7';
const BOX_BG = '#F8FBFA';
const BOX_LINE = '#D0DDD7';

const MARGIN_X = 44;
const MARGIN_BOTTOM = 46;
const PAD_X = 6;
const PAD_Y = 6;
const COL_STT = 36;
const COL_TASK = 148;
const COL_AMOUNT = 116;
const BODY = 9;

type Geom = {
  left: number;
  width: number;
  bottom: number;
  stt: number;
  task: number;
  desc: number;
  amount: number;
};

type Align = 'left' | 'center' | 'right';

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

function vnd(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
}

function formatPercent(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount);
}

function issuedDateIct(now = new Date()): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
}

function clientLabel(leadLabel: string): string {
  const name = leadLabel.trim();
  return name || 'Khách hàng';
}

function shownTask(task: string): string {
  const text = (task ?? '').trim();
  return text || '—';
}

function shownDetail(subtask: string): string {
  const text = (subtask ?? '').trim();
  return text || '—';
}

function groupLabel(group: QuoteSheetGroup): string {
  const label = [group.service_name, group.phase_name].map((part) => part.trim()).filter(Boolean).join(' · ');
  return label || '—';
}

function geometry(doc: Doc): Geom {
  const width = doc.page.width - MARGIN_X * 2;
  return {
    left: MARGIN_X,
    width,
    bottom: doc.page.height - MARGIN_BOTTOM,
    stt: COL_STT,
    task: COL_TASK,
    amount: COL_AMOUNT,
    desc: width - COL_STT - COL_TASK - COL_AMOUNT,
  };
}

function measure(doc: Doc, text: string, width: number, font: string, size: number): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width: Math.max(8, width) });
}

function paintText(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: string,
  size: number,
  align: Align,
  color: string,
): void {
  doc.save();
  doc.rect(x, y, width, height).clip();
  doc.font(font).fontSize(size).fillColor(color);
  doc.text(text, x + PAD_X, y + PAD_Y, {
    width: Math.max(8, width - PAD_X * 2),
    height: Math.max(8, height - PAD_Y - 2),
    align,
  });
  doc.restore();
}

function fillRect(doc: Doc, x: number, y: number, width: number, height: number, color: string): void {
  doc.save();
  doc.fillColor(color).rect(x, y, width, height).fill();
  doc.restore();
}

function hLine(doc: Doc, x: number, y: number, width: number, color: string, weight = 0.6): void {
  doc.save();
  doc.strokeColor(color).lineWidth(weight).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.restore();
}

function vLine(doc: Doc, x: number, y: number, height: number, color: string, weight = 0.4): void {
  doc.save();
  doc.strokeColor(color).lineWidth(weight).moveTo(x, y).lineTo(x, y + height).stroke();
  doc.restore();
}

function paintMasthead(doc: Doc, client: string, geom: Geom): number {
  const bandH = 86;
  doc.save();
  doc.rect(0, 0, doc.page.width, bandH).fill(BAND);
  doc.rect(0, bandH, doc.page.width, 4).fill(ACCENT);
  doc.restore();

  doc.font(FONT_BOLD).fontSize(20).fillColor(HEAD_TEXT);
  doc.text('BÁO GIÁ', geom.left, 24, {
    width: geom.width,
    height: 26,
    characterSpacing: 1.1,
  });
  doc.font(FONT).fontSize(12).fillColor('#E7F5F0');
  doc.text(client, geom.left, 52, {
    width: geom.width,
    height: 28,
    ellipsis: true,
  });

  const metaY = bandH + 16;
  doc.font(FONT).fontSize(9).fillColor(MUTED);
  doc.text(`Ngày xuất: ${issuedDateIct()}`, geom.left, metaY, {
    width: geom.width,
    height: 12,
    align: 'right',
  });
  return metaY + 20;
}

function paintContinuation(doc: Doc, client: string, geom: Geom): number {
  doc.addPage();
  const bandH = 32;
  doc.save();
  doc.rect(0, 0, doc.page.width, bandH).fill(BAND);
  doc.restore();
  doc.font(FONT_BOLD).fontSize(9).fillColor(HEAD_TEXT);
  doc.text('BÁO GIÁ', geom.left, 11, { width: 120, height: 12 });
  doc.font(FONT).fontSize(9).fillColor('#E7F5F0');
  doc.text(client, geom.left + 128, 11, {
    width: geom.width - 128,
    height: 12,
    align: 'right',
    ellipsis: true,
  });
  return bandH + 16;
}

function columnX(geom: Geom): { task: number; desc: number; amount: number } {
  const task = geom.left + geom.stt;
  const desc = task + geom.task;
  const amount = desc + geom.desc;
  return { task, desc, amount };
}

function paintTableHeader(doc: Doc, y: number, geom: Geom): number {
  const height = 26;
  const x = columnX(geom);
  fillRect(doc, geom.left, y, geom.width, height, BAND);
  const headers: Array<[string, number, number, Align]> = [
    ['STT', geom.left, geom.stt, 'center'],
    ['Phần việc', x.task, geom.task, 'left'],
    ['Mô tả', x.desc, geom.desc, 'left'],
    ['Thành tiền', x.amount, geom.amount, 'right'],
  ];
  for (const [label, cellX, cellW, align] of headers) {
    paintText(doc, label, cellX, y, cellW, height, FONT_BOLD, 9, align, HEAD_TEXT);
  }
  doc.save();
  doc.strokeColor('#FFFFFF').strokeOpacity(0.28).lineWidth(0.6);
  doc.moveTo(x.task, y + 6).lineTo(x.task, y + height - 6).stroke();
  doc.moveTo(x.desc, y + 6).lineTo(x.desc, y + height - 6).stroke();
  doc.moveTo(x.amount, y + 6).lineTo(x.amount, y + height - 6).stroke();
  doc.restore();
  vLine(doc, geom.left, y, height, BAND, 0.8);
  vLine(doc, geom.left + geom.width, y, height, BAND, 0.8);
  return y + height;
}

function rowFrame(doc: Doc, y: number, height: number, geom: Geom): void {
  vLine(doc, geom.left, y, height, LINE, 0.6);
  vLine(doc, geom.left + geom.width, y, height, LINE, 0.6);
  hLine(doc, geom.left, y, geom.width, LINE, 0.5);
  hLine(doc, geom.left, y + height, geom.width, LINE, 0.5);
}

function measureGroup(doc: Doc, label: string, geom: Geom): number {
  const textH = measure(doc, label, Math.max(8, geom.width - 4 - PAD_X * 2), FONT_BOLD, 9.5);
  return Math.max(24, textH + PAD_Y + 6);
}

function paintGroup(doc: Doc, y: number, label: string, geom: Geom): number {
  const height = measureGroup(doc, label, geom);
  fillRect(doc, geom.left, y, geom.width, height, GROUP_BG);
  fillRect(doc, geom.left, y, 3, height, BAND);
  paintText(doc, label, geom.left + 4, y, geom.width - 4, height, FONT_BOLD, 9.5, 'left', BAND);
  rowFrame(doc, y, height, geom);
  return y + height;
}

function rowContentHeight(doc: Doc, task: string, detail: string, amount: string, geom: Geom): number {
  const inner = (width: number) => Math.max(8, width - PAD_X * 2);
  const taskH = measure(doc, task, inner(geom.task), FONT, BODY);
  const detailH = measure(doc, detail, inner(geom.desc), FONT, BODY);
  const amountH = measure(doc, amount, inner(geom.amount), FONT, BODY);
  return Math.max(24, taskH, detailH, amountH) + PAD_Y + 6;
}

function paintDataRow(
  doc: Doc,
  y: number,
  stt: number,
  task: string,
  detail: string,
  amount: string,
  shaded: boolean,
  geom: Geom,
): number {
  const height = rowContentHeight(doc, task, detail, amount, geom);
  const x = columnX(geom);
  if (shaded) fillRect(doc, geom.left, y, geom.width, height, ALT_BG);
  vLine(doc, x.task, y, height, RULE);
  vLine(doc, x.desc, y, height, RULE);
  vLine(doc, x.amount, y, height, RULE);
  paintText(doc, String(stt), geom.left, y, geom.stt, height, FONT, BODY, 'center', INK);
  paintText(doc, task, x.task, y, geom.task, height, FONT, BODY, 'left', INK);
  paintText(doc, detail, x.desc, y, geom.desc, height, FONT, BODY, 'left', INK);
  paintText(doc, amount, x.amount, y, geom.amount, height, FONT, BODY, 'right', INK);
  rowFrame(doc, y, height, geom);
  return y + height;
}

function paintEmptyRow(doc: Doc, y: number, geom: Geom): number {
  const height = 32;
  fillRect(doc, geom.left, y, geom.width, height, '#FBFCFB');
  paintText(doc, 'Chưa có hạng mục', geom.left, y, geom.width, height, FONT, 10, 'center', MUTED);
  rowFrame(doc, y, height, geom);
  return y + height;
}

function ensure(doc: Doc, y: number, height: number, client: string, geom: Geom, withTable: boolean): number {
  if (y + height <= geom.bottom) return y;
  const next = paintContinuation(doc, client, geom);
  return withTable ? paintTableHeader(doc, next, geom) : next;
}

function paintTotals(doc: Doc, y: number, view: QuoteSheetView, client: string, geom: Geom): void {
  const boxW = 300;
  const lineH = 20;
  const grandH = 28;
  const pad = 10;
  const boxH = pad + lineH * 3 + 8 + grandH + pad;
  let top = y + 16;
  if (top + boxH > geom.bottom) top = paintContinuation(doc, client, geom);

  const x = geom.left + geom.width - boxW;
  doc.save();
  doc.fillColor(BOX_BG).strokeColor(BOX_LINE).lineWidth(0.8);
  doc.roundedRect(x, top, boxW, boxH, 6).fillAndStroke();
  doc.restore();

  const lines: Array<[string, string]> = [
    ['Tạm tính', vnd(view.total_vnd)],
    [`Khuyến mại ${formatPercent(view.promo_percent)}%`, vnd(view.promo_vnd)],
    [`VAT ${formatPercent(view.vat_percent)}%`, vnd(view.vat_vnd)],
  ];
  const labelW = 156;
  const valueW = boxW - pad * 2 - labelW;
  let lineY = top + pad;
  for (let i = 0; i < lines.length; i += 1) {
    const [label, value] = lines[i];
    doc.font(FONT).fontSize(9.5).fillColor(INK);
    doc.text(label, x + pad, lineY + 4, { width: labelW, height: 14 });
    doc.text(value, x + pad + labelW, lineY + 4, { width: valueW, height: 14, align: 'right' });
    lineY += lineH;
    if (i < lines.length - 1) hLine(doc, x + pad, lineY, boxW - pad * 2, RULE, 0.4);
  }

  const grandY = lineY + 6;
  fillRect(doc, x + 6, grandY, boxW - 12, grandH, BAND);
  doc.font(FONT_BOLD).fontSize(10.5).fillColor(HEAD_TEXT);
  doc.text('Tổng thanh toán', x + pad, grandY + 8, { width: labelW, height: 14 });
  doc.text(vnd(view.grand_total_vnd), x + pad + labelW, grandY + 8, {
    width: valueW,
    height: 14,
    align: 'right',
  });
}

function includedSections(view: QuoteSheetView): Array<{ label: string; rows: QuoteSheetRow[] }> {
  return view.groups
    .map((group) => ({
      label: groupLabel(group),
      rows: group.rows.filter((row) => row.included),
    }))
    .filter((section) => section.rows.length > 0);
}

export function renderLeadQuotePdf(view: QuoteSheetView, leadLabel: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 44, bottom: 44, left: MARGIN_X, right: MARGIN_X },
    info: { Title: 'Báo giá' },
  });
  doc.registerFont(FONT, fontFile('Regular'));
  doc.registerFont(FONT_BOLD, fontFile('Bold'));

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const client = clientLabel(leadLabel);
  const geom = geometry(doc);
  let y = paintMasthead(doc, client, geom);
  const sections = includedSections(view);

  if (sections.length === 0) {
    y = paintTableHeader(doc, y, geom);
    y = paintEmptyRow(doc, y, geom);
  } else {
    y = paintTableHeader(doc, y, geom);
    let stt = 1;
    let shaded = false;
    for (const section of sections) {
      const headerH = measureGroup(doc, section.label, geom);
      const first = section.rows[0];
      const firstH = rowContentHeight(
        doc,
        shownTask(first.task),
        shownDetail(first.subtask),
        vnd(first.amount_vnd),
        geom,
      );
      y = ensure(doc, y, headerH + Math.min(firstH, 40), client, geom, true);
      y = paintGroup(doc, y, section.label, geom);
      for (const row of section.rows) {
        const task = shownTask(row.task);
        const detail = shownDetail(row.subtask);
        const amount = vnd(row.amount_vnd);
        const height = rowContentHeight(doc, task, detail, amount, geom);
        y = ensure(doc, y, height, client, geom, true);
        y = paintDataRow(doc, y, stt, task, detail, amount, shaded, geom);
        shaded = !shaded;
        stt += 1;
      }
    }
  }

  paintTotals(doc, y, view, client, geom);
  doc.end();
  return done;
}
