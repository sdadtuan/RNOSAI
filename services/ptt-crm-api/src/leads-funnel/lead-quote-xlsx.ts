import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { QuoteSheetView } from './quote-sheet.util';

const TEMPLATE_FILE = 'bao-gia-mau.xlsx';
const SHEET_NAME = 'BÁO GIÁ PTT ADS';
const COLS = 14;
const BODY_START = 13;
const MONEY = '#,##0';
const PERCENT = '0.00%';
const TITLE_TEXT = 'MEDIA PLAN | PTT ADS';

const COLOR = {
  dark: 'FF174F31',
  mid: 'FF35884D',
  lime: 'FF8DC448',
  light: 'FFEAF4E4',
  white: 'FFFFFFFF',
  textDark: 'FF20382B',
  textWhite: 'FFFFFFFF',
  textGreen: 'FF174F31',
} as const;

const FONT_NAME = 'Aptos';
const FONT_TITLE_NAME = 'Aptos Display';

/** Resolve the PTT Ads logo from API assets or the repo brand folder. */
export function resolvePttLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'brand', 'ptt-logo.png'),
    path.join(__dirname, '..', '..', 'src', 'assets', 'brand', 'ptt-logo.png'),
    path.join(process.cwd(), 'src', 'assets', 'brand', 'ptt-logo.png'),
    path.join(process.cwd(), 'assets', 'brand', 'ptt-logo.png'),
    path.join(process.cwd(), 'docs', 'brand', 'ptt-logo.png'),
    path.join(process.cwd(), '..', '..', 'docs', 'brand', 'ptt-logo.png'),
    path.join(process.cwd(), '..', 'docs', 'brand', 'ptt-logo.png'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore unreadable paths */
    }
  }
  return null;
}

/** Official PTT Ads quote workbook used as the export template. */
export function resolveBaoGiaTemplatePath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'quotes', TEMPLATE_FILE),
    path.join(__dirname, '..', '..', 'src', 'assets', 'quotes', TEMPLATE_FILE),
    path.join(process.cwd(), 'src', 'assets', 'quotes', TEMPLATE_FILE),
    path.join(process.cwd(), 'assets', 'quotes', TEMPLATE_FILE),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore unreadable paths */
    }
  }
  return null;
}

function formatPercent(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount);
}

function unitPrice(amount: number, qty: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (!Number.isFinite(qty) || qty <= 0) return Math.round(amount);
  return Math.round(amount / qty);
}

type PaintOpts = {
  font?: Partial<ExcelJS.Font>;
  fill?: string;
  alignment?: Partial<ExcelJS.Alignment>;
  numFmt?: string;
};

type TotalStyle = { font: Partial<ExcelJS.Font>; fill: string; alignment: Partial<ExcelJS.Alignment> };

/** Assign a complete, deep-cloned style so ExcelJS cannot share/mutate xf records. */
function paint(cell: ExcelJS.Cell, opts: PaintOpts) {
  const argb = opts.fill;
  const fontColor = opts.font?.color?.argb ? { argb: opts.font.color.argb } : undefined;
  const style: Partial<ExcelJS.Style> = {
    font: {
      name: opts.font?.name ?? FONT_NAME,
      size: opts.font?.size ?? 10,
      bold: Boolean(opts.font?.bold),
      italic: Boolean(opts.font?.italic),
      color: fontColor,
    },
    fill: argb
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } }
      : { type: 'pattern', pattern: 'none' },
    alignment: { wrapText: true, vertical: 'middle', ...(opts.alignment ?? {}) },
    numFmt: opts.numFmt ?? 'General',
    border: {},
  };
  const cloned = JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
  cell.style = cloned;
}

function paintRange(sheet: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number, opts: PaintOpts) {
  for (let col = fromCol; col <= toCol; col += 1) paint(sheet.getRow(row).getCell(col), opts);
}

function includedGroups(view: QuoteSheetView) {
  return view.groups
    .map((group) => ({
      label: [group.service_name, group.phase_name].map((part) => part.trim()).filter(Boolean).join(' · ') || '—',
      channel: group.service_name.trim() || '—',
      lines: group.rows.filter((row) => row.included),
    }))
    .filter((group) => group.lines.length > 0);
}

function copyTemplateLayout(src: ExcelJS.Worksheet, sheet: ExcelJS.Worksheet) {
  const defaultWidths = [7, 16, 21, 76, 11, 12, 19, 13, 16, 13, 13, 13, 13, 13];
  for (let col = 1; col <= COLS; col += 1) {
    sheet.getColumn(col).width = src.getColumn(col).width ?? defaultWidths[col - 1];
  }
  // CRM column order: Số lượng before Đơn vị (template is the reverse).
  const widthE = sheet.getColumn(5).width;
  const widthF = sheet.getColumn(6).width;
  if (widthE != null || widthF != null) {
    sheet.getColumn(5).width = widthF ?? widthE;
    sheet.getColumn(6).width = widthE ?? widthF;
  }
  const defaultHeights: Record<number, number> = {
    1: 24, 2: 27, 3: 27, 4: 24, 5: 32, 6: 32, 7: 32, 8: 32, 9: 32, 10: 32, 11: 29, 12: 48,
  };
  for (let row = 1; row <= 12; row += 1) {
    sheet.getRow(row).height = src.getRow(row).height || defaultHeights[row] || 24;
  }
}

function placeLogoAndTitle(wb: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  sheet.mergeCells(2, 1, 3, 2);
  sheet.mergeCells(2, 3, 3, 8);
  sheet.mergeCells(2, 9, 3, 14);

  const titleFont = { name: FONT_TITLE_NAME, size: 21, bold: true, color: { argb: COLOR.textGreen } };
  paintRange(sheet, 2, 1, 2, { font: titleFont, fill: COLOR.white, alignment: { horizontal: 'center', vertical: 'middle' } });
  paintRange(sheet, 3, 1, 2, { font: titleFont, fill: COLOR.white, alignment: { horizontal: 'center', vertical: 'middle' } });
  const titleStyle: PaintOpts = {
    font: titleFont,
    fill: COLOR.white,
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 },
  };
  paintRange(sheet, 2, 3, 8, titleStyle);
  paintRange(sheet, 3, 3, 8, titleStyle);
  paintRange(sheet, 2, 9, 14, { fill: COLOR.white, alignment: { horizontal: 'right', vertical: 'middle' } });
  paintRange(sheet, 3, 9, 14, { fill: COLOR.white, alignment: { horizontal: 'right', vertical: 'middle' } });
  sheet.getCell('A2').value = null;
  sheet.getCell('C2').value = TITLE_TEXT;

  const logoPath = resolvePttLogoPath();
  if (!logoPath) return;
  const imageId = wb.addImage({ filename: logoPath, extension: 'png' });
  // Keep the mark inside A2:B3 only — never extend into the title at column C.
  sheet.addImage(imageId, {
    tl: { col: 0.08, row: 1.08 },
    br: { col: 1.92, row: 2.92 },
    editAs: 'twoCell',
  } as unknown as ExcelJS.ImagePosition);
}

const LABEL_STYLE: PaintOpts = {
  font: { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textWhite } },
  fill: COLOR.dark,
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
};
const VALUE_STYLE: PaintOpts = {
  font: { name: FONT_NAME, size: 10, bold: false, color: { argb: COLOR.textDark } },
  fill: COLOR.light,
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
};
const GROUP_STYLE: PaintOpts = {
  font: { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.textWhite } },
  fill: COLOR.mid,
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
};
const ITEM_FONT = { name: FONT_NAME, size: 10, bold: false, color: { argb: COLOR.textDark } };
const ITEM_FONT_BOLD = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textDark } };
const ITEM_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
const ITEM_ALIGN_LEFT: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };
const HEAD_DARK: PaintOpts = {
  font: { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textWhite } },
  fill: COLOR.dark,
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
};
const HEAD_LIME: PaintOpts = {
  font: { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textGreen } },
  fill: COLOR.lime,
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
};
const TOTAL_MID: TotalStyle = {
  font: { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.textWhite } },
  fill: COLOR.mid,
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
};
const TOTAL_DARK: TotalStyle = {
  font: { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.textWhite } },
  fill: COLOR.dark,
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
};
const FOOTER_STYLE: PaintOpts = {
  font: { name: FONT_NAME, size: 10, bold: false, color: { argb: COLOR.textGreen } },
  fill: COLOR.light,
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
};

function writeHeaderBlock(
  sheet: ExcelJS.Worksheet,
  input: { goal: string; project: string; lead: string; ta: string; budget: number; comms: string },
) {
  const labels = [
    [5, 'Mục tiêu:', input.goal],
    [6, 'Tên Dự Án', input.project],
    [7, 'Tên Khách Hàng', input.lead],
    [8, 'TA', input.ta],
    [9, 'Ngân sách', input.budget],
    [10, 'Thời gian truyền thông', input.comms],
  ] as const;

  for (const [rowNumber, label, value] of labels) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 2);
    sheet.mergeCells(rowNumber, 3, rowNumber, 8);
    paintRange(sheet, rowNumber, 1, 2, LABEL_STYLE);
    const isBudget = rowNumber === 9;
    paintRange(sheet, rowNumber, 3, 8, isBudget ? { ...VALUE_STYLE, numFmt: MONEY } : VALUE_STYLE);
    sheet.getCell(rowNumber, 1).value = label;
    sheet.getCell(rowNumber, 3).value = value;
    if (isBudget) {
      sheet.getCell(rowNumber, 3).value = input.budget;
      paint(sheet.getCell(rowNumber, 3), { ...VALUE_STYLE, numFmt: MONEY });
      sheet.getCell(rowNumber, 3).value = input.budget;
    }
  }

  sheet.mergeCells(11, 9, 11, 14);
  paintRange(sheet, 11, 9, 14, {
    font: { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.textWhite } },
    fill: COLOR.mid,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });
  sheet.getCell('I11').value = 'Estimated KPIs';

  const headers: Array<[number, string, PaintOpts]> = [
    [1, 'STT', HEAD_DARK],
    [2, 'Kênh', HEAD_DARK],
    [3, 'Hình thức', HEAD_DARK],
    [4, 'Mô tả', HEAD_DARK],
    [5, 'Số lượng', HEAD_DARK],
    [6, 'Đơn vị', HEAD_DARK],
    [7, 'Đơn giá (VND)', HEAD_DARK],
    [8, 'Thành tiền (VND)', HEAD_DARK],
    [9, 'Like Page', HEAD_LIME],
    [10, 'Impression', HEAD_LIME],
    [11, 'Reach', HEAD_LIME],
    [12, 'Click', HEAD_LIME],
    [13, 'CTR', HEAD_LIME],
    [14, 'Lead', HEAD_LIME],
  ];
  const headerRow = sheet.getRow(12);
  headerRow.height = 48;
  for (const [col, label, style] of headers) {
    const cell = headerRow.getCell(col);
    paint(cell, style);
    cell.value = label;
  }
}

type BodyRow =
  | { kind: 'group'; label: string }
  | {
      kind: 'item';
      stt: number | null;
      channel: string;
      task: string;
      subtask: string;
      unit: string;
      qty: number | null;
      price: number | null;
      amount: number | null;
      zebra: number;
    };

function metricList(m: QuoteCampaignKpiMetricCells | null | undefined): Array<number | null> {
  return [
    m?.like_page ?? null,
    m?.impression ?? null,
    m?.reach ?? null,
    m?.click ?? null,
    normalizeCtr(m?.ctr),
    m?.lead ?? null,
  ];
}

/** AI returns a 0–1 ratio (0.05 = 5%). Values above 1 are treated as percents. */
export function normalizeCtr(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n < 0) return null;
  if (n > 1) return n / 100;
  return n;
}

function matchChannelKpi(
  targets: QuoteCampaignKpiCells | null | undefined,
  channel: string,
  task: string,
): QuoteCampaignKpiMetricCells | null {
  const hay = `${channel} ${task}`.trim().toLowerCase();
  if (!hay || !targets?.channels?.length) return null;
  for (const row of targets.channels) {
    const name = String(row.name ?? '').trim().toLowerCase();
    if (!name) continue;
    if (hay.includes(name) || name.includes(hay) || hay.split(/\s+/).some((part) => part && name.includes(part))) {
      return row;
    }
  }
  return null;
}

function itemCellStyle(col: number, fill: string): PaintOpts {
  const isDesc = col === 4;
  const isText = col === 2 || col === 3 || col === 4 || col === 6;
  const numFmt = col === 13 ? PERCENT : col === 5 || col === 7 || col === 8 || col >= 9 ? MONEY : 'General';
  return {
    font: col <= 3 ? ITEM_FONT_BOLD : ITEM_FONT,
    fill,
    alignment: isDesc || isText && col === 4 ? ITEM_ALIGN_LEFT : ITEM_ALIGN,
    numFmt,
  };
}

function writeKpiCells(row: ExcelJS.Row, metrics: QuoteCampaignKpiMetricCells, fill: string) {
  metricList(metrics).forEach((value, index) => {
    const col = 9 + index;
    const cell = row.getCell(col);
    const fmt = index === 4 ? PERCENT : MONEY;
    paint(cell, { ...itemCellStyle(col, fill), numFmt: fmt });
    cell.value = value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  });
}

function writeTotalsKpis(
  sheet: ExcelJS.Worksheet,
  tongRow: number,
  amountRows: number[],
  targets: QuoteCampaignKpiCells | null | undefined,
  style: TotalStyle,
) {
  const first = amountRows[0];
  const last = amountRows[amountRows.length - 1];
  const hasSpan = first != null && last != null && last >= first;
  const letters = ['I', 'J', 'K', 'L', 'M', 'N'] as const;
  const totals = metricList(targets ?? {});
  totals.forEach((value, index) => {
    const cell = sheet.getRow(tongRow).getCell(9 + index);
    const numFmt = index === 4 ? PERCENT : MONEY;
    paint(cell, { ...style, numFmt });
    if (index === 4) {
      cell.value = value;
      return;
    }
    if (hasSpan) {
      const formula = `SUM(${letters[index]}${first}:${letters[index]}${last})`;
      cell.value =
        value == null || !Number.isFinite(Number(value))
          ? { formula }
          : { formula, result: Number(value) };
    } else {
      cell.value = value == null || !Number.isFinite(Number(value)) ? null : Number(value);
    }
  });
}

function writeTotal(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  amount: number,
  height: number,
  style: TotalStyle,
  formula?: string,
) {
  const row = sheet.getRow(rowNumber);
  row.height = height;
  paintRange(sheet, rowNumber, 1, 5, { fill: COLOR.white, font: ITEM_FONT, alignment: ITEM_ALIGN });
  paintRange(sheet, rowNumber, 6, 7, { ...style, numFmt: 'General' });
  paint(row.getCell(8), { ...style, numFmt: MONEY });
  for (let col = 9; col <= 14; col += 1) {
    paint(row.getCell(col), { ...style, numFmt: col === 13 ? PERCENT : MONEY });
  }
  row.getCell(6).value = label;
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  paint(row.getCell(6), { ...style, numFmt: 'General' });
  row.getCell(6).value = label;
  const valueCell = row.getCell(8);
  paint(valueCell, { ...style, numFmt: MONEY });
  valueCell.value = formula ? { formula, result: amount } : amount;
}

export type QuoteCampaignKpiMetricCells = {
  like_page?: number | null;
  impression?: number | null;
  reach?: number | null;
  click?: number | null;
  ctr?: number | null;
  lead?: number | null;
};

export type QuoteCampaignKpiCells = QuoteCampaignKpiMetricCells & {
  goal?: string | null;
  ta?: string | null;
  comms_period?: string | null;
  channels?: Array<QuoteCampaignKpiMetricCells & { name: string }>;
};

export async function renderLeadQuoteXlsx(
  view: QuoteSheetView,
  leadLabel: string,
  campaignTargets?: QuoteCampaignKpiCells | null,
): Promise<Buffer> {
  const templatePath = resolveBaoGiaTemplatePath();
  if (!templatePath) {
    throw new Error('Thiếu mẫu báo giá Excel (bao-gia-mau.xlsx).');
  }

  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile(templatePath);
  const src = template.getWorksheet(SHEET_NAME) ?? template.worksheets[0];
  if (!src) throw new Error('Mẫu báo giá không có sheet.');

  const groupHeight = src.getRow(13).height || 30;
  const totalHeight = src.getRow(23).height || 36;
  const grandHeight = src.getRow(25).height || 36;
  const footerHeight = src.getRow(28).height || 35;

  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const sheet = wb.addWorksheet(SHEET_NAME, {
    views: [{ showGridLines: true, zoomScale: 60, zoomScaleNormal: 60 }],
    pageSetup: { orientation: 'portrait', fitToPage: false, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true },
  });
  copyTemplateLayout(src, sheet);

  const included = includedGroups(view);
  const project = [...new Set(included.map((group) => group.channel).filter((name) => name && name !== '—'))].join(' · ');

  const body: BodyRow[] = [];
  if (included.length === 0) {
    body.push({ kind: 'group', label: 'Chưa có hạng mục' });
    body.push({
      kind: 'item',
      stt: null,
      channel: '',
      task: '',
      subtask: 'Chưa có phạm vi công việc',
      unit: '',
      qty: null,
      price: null,
      amount: null,
      zebra: 0,
    });
  } else {
    let zebra = 0;
    for (const group of included) {
      body.push({ kind: 'group', label: group.label });
      let stt = 1;
      for (const row of group.lines) {
        const qty = Number.isFinite(row.qty) && row.qty > 0 ? row.qty : 1;
        body.push({
          kind: 'item',
          stt,
          channel: group.channel,
          task: row.task.trim() || '—',
          subtask: row.subtask.trim() || '—',
          unit: row.unit.trim() || 'gói',
          qty,
          price: unitPrice(row.amount_vnd, qty),
          amount: row.amount_vnd,
          zebra,
        });
        zebra += 1;
        stt += 1;
      }
    }
  }

  placeLogoAndTitle(wb, sheet);

  const goal = String(campaignTargets?.goal ?? '').trim();
  const ta = String(campaignTargets?.ta ?? '').trim();
  const comms = String(campaignTargets?.comms_period ?? '').trim();
  writeHeaderBlock(sheet, {
    goal,
    project,
    lead: leadLabel.trim() || 'Khách hàng',
    ta,
    budget: view.grand_total_vnd,
    comms,
  });
  sheet.getRow(8).height = ta.length > 80 ? 48 : 32;

  let cursor = BODY_START;
  const amountRows: number[] = [];
  const itemFills = new Map<number, string>();
  for (const entry of body) {
    const row = sheet.getRow(cursor);
    if (entry.kind === 'group') {
      row.height = groupHeight;
      sheet.mergeCells(cursor, 1, cursor, COLS);
      paintRange(sheet, cursor, 1, COLS, GROUP_STYLE);
      row.getCell(1).value = entry.label;
      paint(row.getCell(1), GROUP_STYLE);
      row.getCell(1).value = entry.label;
    } else {
      const fill = entry.zebra % 2 === 0 ? COLOR.light : COLOR.white;
      itemFills.set(cursor, fill);
      row.height = (entry.subtask || '').length > 80 ? 72 : 48;
      for (let col = 1; col <= COLS; col += 1) paint(row.getCell(col), itemCellStyle(col, fill));
      row.getCell(1).value = entry.stt;
      row.getCell(2).value = entry.channel || null;
      row.getCell(3).value = entry.task || null;
      row.getCell(4).value = entry.subtask || null;
      row.getCell(5).value = entry.qty;
      row.getCell(6).value = entry.unit || null;
      row.getCell(7).value = entry.price;
      row.getCell(8).value =
        entry.amount != null ? { formula: `E${cursor}*G${cursor}`, result: entry.amount } : null;
      const rowKpi = matchChannelKpi(campaignTargets, entry.channel, entry.task);
      if (rowKpi) writeKpiCells(row, rowKpi, fill);
      else {
        for (let col = 9; col <= 14; col += 1) {
          paint(row.getCell(col), itemCellStyle(col, fill));
          row.getCell(col).value = null;
        }
      }
      // Re-apply item styles after values so number formats stay on the numeric cells.
      for (let col = 1; col <= COLS; col += 1) paint(row.getCell(col), itemCellStyle(col, fill));
      if (entry.amount != null) amountRows.push(cursor);
    }
    cursor += 1;
  }

  const tongRow = cursor;
  const promoRow = cursor + 1;
  const vatRow = cursor + 2;
  const grandRow = cursor + 3;
  const tongFormula = amountRows.length > 0 ? `SUM(H${amountRows[0]}:H${amountRows[amountRows.length - 1]})` : undefined;

  writeTotal(sheet, tongRow, 'TỔNG CỘNG', view.total_vnd, totalHeight, TOTAL_MID, tongFormula);
  writeTotal(
    sheet,
    promoRow,
    `Khuyến mại ${formatPercent(view.promo_percent)}%`,
    view.promo_vnd,
    totalHeight,
    TOTAL_MID,
    `H${tongRow}*${view.promo_percent}%`,
  );
  writeTotal(
    sheet,
    vatRow,
    `VAT ${formatPercent(view.vat_percent)}%`,
    view.vat_vnd,
    totalHeight,
    TOTAL_MID,
    `(H${tongRow}-H${promoRow})*${view.vat_percent}%`,
  );
  writeTotal(
    sheet,
    grandRow,
    'THÀNH TIỀN',
    view.grand_total_vnd,
    grandHeight,
    TOTAL_DARK,
    `H${tongRow}-H${promoRow}+H${vatRow}`,
  );
  writeTotalsKpis(sheet, tongRow, amountRows, campaignTargets, TOTAL_MID);

  // Final style pass — re-apply after merges/values so shared xf mutations cannot stick.
  paintRange(sheet, 5, 1, 2, LABEL_STYLE);
  paintRange(sheet, 6, 1, 2, LABEL_STYLE);
  paintRange(sheet, 7, 1, 2, LABEL_STYLE);
  paintRange(sheet, 8, 1, 2, LABEL_STYLE);
  paintRange(sheet, 9, 1, 2, LABEL_STYLE);
  paintRange(sheet, 10, 1, 2, LABEL_STYLE);
  paintRange(sheet, 5, 3, 8, VALUE_STYLE);
  paintRange(sheet, 6, 3, 8, VALUE_STYLE);
  paintRange(sheet, 7, 3, 8, VALUE_STYLE);
  paintRange(sheet, 8, 3, 8, VALUE_STYLE);
  paintRange(sheet, 9, 3, 8, { ...VALUE_STYLE, numFmt: MONEY });
  paintRange(sheet, 10, 3, 8, VALUE_STYLE);
  sheet.getCell('C9').value = view.grand_total_vnd;
  for (const [rowNumber, fill] of itemFills) {
    const row = sheet.getRow(rowNumber);
    for (let col = 1; col <= COLS; col += 1) paint(row.getCell(col), itemCellStyle(col, fill));
  }

  sheet.getRow(grandRow + 1).height = 24;
  sheet.getRow(grandRow + 2).height = 24;
  const footerRow = grandRow + 3;
  const foot = sheet.getRow(footerRow);
  foot.height = footerHeight;
  sheet.mergeCells(footerRow, 1, footerRow, COLS);
  paintRange(sheet, footerRow, 1, COLS, FOOTER_STYLE);
  foot.getCell(1).value = 'BÁO GIÁ ĐƯỢC TRÌNH BÀY THEO MẪU PTT ADS – ĐƠN VỊ CUNG CẤP: PTT ADS';
  paint(foot.getCell(1), FOOTER_STYLE);
  foot.getCell(1).value = 'BÁO GIÁ ĐƯỢC TRÌNH BÀY THEO MẪU PTT ADS – ĐƠN VỊ CUNG CẤP: PTT ADS';
  for (let extra = 1; extra <= 4; extra += 1) {
    sheet.getRow(footerRow + extra).height = 24;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
