import ExcelJS from 'exceljs';
import type { QuoteSheetView } from './quote-sheet.util';

const GREEN = 'FF174F31';
const MID = 'FF35884D';
const PALE = 'FFEAF4E4';
const INK = 'FF20382B';
const WHITE = 'FFFFFFFF';
const MONEY = '#,##0';
const COLS = 14;

function formatPercent(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount);
}

function unitLabel(unit: string): string {
  const key = unit.trim().toLowerCase();
  if (key === 'times' || key === 'time' || key === 'lan' || key === 'lần') return 'lần';
  if (key === 'month' || key === 'months' || key === 'thang' || key === 'tháng') return 'tháng';
  if (key === 'package' || key === 'goi' || key === 'gói') return 'gói';
  if (key === 'sample' || key === 'mau' || key === 'mẫu') return 'mẫu';
  if (key === 'shoot_day' || key === 'day' || key === 'ngày') return 'ngày';
  return unit.trim() || 'gói';
}

function unitPrice(amount: number, qty: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (!Number.isFinite(qty) || qty <= 0) return Math.round(amount);
  return Math.round(amount / qty);
}

function fill(cell: ExcelJS.Cell, argb: string, color: string, bold = false) {
  cell.font = { name: 'Calibri', size: 10, bold, color: { argb: color } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function paintSpan(row: ExcelJS.Row, from: number, to: number, bg: string, color: string, bold = true) {
  for (let col = from; col <= to; col += 1) fill(row.getCell(col), bg, color, bold);
}

function infoRow(sheet: ExcelJS.Worksheet, label: string, value: string) {
  const row = sheet.addRow([label, '', value]);
  sheet.mergeCells(row.number, 1, row.number, 2);
  sheet.mergeCells(row.number, 3, row.number, 8);
  paintSpan(row, 1, 2, GREEN, WHITE, true);
  paintSpan(row, 3, 8, PALE, INK, true);
  row.height = 28;
  return row;
}

export async function renderLeadQuoteXlsx(view: QuoteSheetView, leadLabel: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('BÁO GIÁ PTT ADS');
  sheet.columns = [
    { width: 7 },
    { width: 16 },
    { width: 22 },
    { width: 56 },
    { width: 12 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  const title = sheet.addRow(['MEDIA PLAN | PTT ADS']);
  sheet.mergeCells(title.number, 1, title.number, 8);
  title.height = 28;
  title.getCell(1).font = { name: 'Calibri', size: 20, bold: true, color: { argb: GREEN } };
  title.getCell(1).alignment = { vertical: 'middle' };
  sheet.addRow([]);

  const included = view.groups
    .map((group) => ({
      label: [group.service_name, group.phase_name].map((part) => part.trim()).filter(Boolean).join(' · ') || '—',
      channel: group.service_name.trim() || '—',
      lines: group.rows.filter((row) => row.included),
    }))
    .filter((group) => group.lines.length > 0);
  const project = [...new Set(included.map((group) => group.channel).filter((name) => name && name !== '—'))].join(' · ');

  infoRow(sheet, 'Mục tiêu', '');
  infoRow(sheet, 'Tên Dự Án', project);
  infoRow(sheet, 'Tên Khách Hàng', leadLabel.trim() || 'Khách hàng');
  infoRow(sheet, 'TA', '');
  const budget = infoRow(sheet, 'Ngân sách', '');
  budget.getCell(3).value = view.grand_total_vnd;
  budget.getCell(3).numFmt = MONEY;
  infoRow(sheet, 'Thời gian truyền thông', '');

  const kpi = sheet.addRow(['', '', '', '', '', '', '', '', 'Estimated KPIs']);
  sheet.mergeCells(kpi.number, 9, kpi.number, COLS);
  paintSpan(kpi, 9, COLS, GREEN, WHITE, true);
  kpi.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

  const header = sheet.addRow([
    'STT',
    'Kênh',
    'Hình thức',
    'Mô tả',
    'Đơn vị',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Like Page',
    'Impression',
    'Reach',
    'Click',
    'CTR',
    'Lead',
  ]);
  header.height = 32;
  paintSpan(header, 1, COLS, GREEN, WHITE, true);
  for (let col = 1; col <= COLS; col += 1) {
    header.getCell(col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  if (included.length === 0) {
    const empty = sheet.addRow(['Chưa có hạng mục']);
    sheet.mergeCells(empty.number, 1, empty.number, COLS);
    paintSpan(empty, 1, COLS, MID, WHITE, true);
    const blank = sheet.addRow(['', '', '', 'Chưa có phạm vi công việc']);
    paintSpan(blank, 1, COLS, PALE, INK, false);
  }

  for (const group of included) {
    const band = sheet.addRow([group.label]);
    sheet.mergeCells(band.number, 1, band.number, COLS);
    paintSpan(band, 1, COLS, MID, WHITE, true);
    band.height = 24;
    let stt = 1;
    for (const row of group.lines) {
      const qty = Number.isFinite(row.qty) && row.qty > 0 ? row.qty : 1;
      const line = sheet.addRow([
        stt,
        group.channel,
        row.task.trim() || '—',
        row.subtask.trim() || '—',
        unitLabel(row.unit),
        qty,
        unitPrice(row.amount_vnd, qty),
        row.amount_vnd,
      ]);
      paintSpan(line, 1, COLS, PALE, INK, false);
      line.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      line.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      line.getCell(7).numFmt = MONEY;
      line.getCell(8).numFmt = MONEY;
      line.getCell(4).alignment = { wrapText: true, vertical: 'middle' };
      stt += 1;
    }
  }

  const totals: Array<[string, number, boolean]> = [
    ['TỔNG CỘNG', view.total_vnd, false],
    [`Khuyến mại ${formatPercent(view.promo_percent)}%`, view.promo_vnd, false],
    [`VAT ${formatPercent(view.vat_percent)}%`, view.vat_vnd, false],
    ['THÀNH TIỀN', view.grand_total_vnd, true],
  ];
  for (const [label, amount, grand] of totals) {
    const row = sheet.addRow(['', '', '', '', '', label, '', amount]);
    sheet.mergeCells(row.number, 6, row.number, 7);
    row.height = 24;
    row.getCell(6).font = { name: 'Calibri', size: 11, bold: true, color: { argb: grand ? WHITE : GREEN } };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).font = { name: 'Calibri', size: 11, bold: true, color: { argb: grand ? WHITE : GREEN } };
    row.getCell(8).numFmt = MONEY;
    row.getCell(8).alignment = { vertical: 'middle' };
    if (grand) {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    }
  }

  sheet.addRow([]);
  const foot = sheet.addRow(['BÁO GIÁ ĐƯỢC TRÌNH BÀY THEO MẪU PTT ADS – ĐƠN VỊ CUNG CẤP: PTT ADS']);
  sheet.mergeCells(foot.number, 1, foot.number, COLS);
  paintSpan(foot, 1, COLS, PALE, GREEN, false);
  foot.height = 24;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
