import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { QuoteSheetView } from './quote-sheet.util';

const TEMPLATE_FILE = 'bao-gia-mau.xlsx';
const SHEET_NAME = 'BÁO GIÁ PTT ADS';
const COLS = 14;
const BODY_START = 13;
const TEMPLATE_BODY_END = 25;
const TEMPLATE_FOOTER_ROW = 28;
const MONEY = '#,##0';

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

type StyleSnapshot = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
  numFmt?: string;
};

function snapshotCell(cell: ExcelJS.Cell): StyleSnapshot {
  return {
    font: cell.font ? { ...cell.font, color: cell.font.color ? { ...cell.font.color } : undefined } : undefined,
    fill: cell.fill ? (JSON.parse(JSON.stringify(cell.fill)) as ExcelJS.Fill) : undefined,
    alignment: cell.alignment ? { ...cell.alignment } : undefined,
    border: cell.border ? (JSON.parse(JSON.stringify(cell.border)) as ExcelJS.Borders) : undefined,
    numFmt: cell.numFmt,
  };
}

function applyStyle(cell: ExcelJS.Cell, style: StyleSnapshot | undefined) {
  if (!style) return;
  if (style.font) cell.font = style.font;
  if (style.fill) cell.fill = style.fill;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
  if (style.numFmt) cell.numFmt = style.numFmt;
}

function resetCell(cell: ExcelJS.Cell) {
  cell.value = null;
  cell.numFmt = '';
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

function unmergeFromRow(sheet: ExcelJS.Worksheet, fromRow: number) {
  const merges = [...(((sheet.model as { merges?: string[] }).merges ?? []) as string[])];
  for (const ref of merges) {
    const match = /^[A-Z]+(\d+):[A-Z]+(\d+)$/i.exec(ref);
    if (!match) continue;
    if (Number(match[1]) >= fromRow) {
      try {
        sheet.unMergeCells(ref);
      } catch {
        /* already cleared */
      }
    }
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
  return [m?.like_page ?? null, m?.impression ?? null, m?.reach ?? null, m?.click ?? null, m?.ctr ?? null, m?.lead ?? null];
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

function writeKpiCells(row: ExcelJS.Row, metrics: QuoteCampaignKpiMetricCells) {
  metricList(metrics).forEach((value, index) => {
    const cell = row.getCell(9 + index);
    if (value == null || !Number.isFinite(Number(value))) {
      cell.value = null;
      return;
    }
    cell.value = Number(value);
    cell.numFmt = index === 4 ? '0.00%' : '#,##0.####';
  });
}

function writeTotalsKpis(
  sheet: ExcelJS.Worksheet,
  tongRow: number,
  amountRows: number[],
  targets: QuoteCampaignKpiCells | null | undefined,
) {
  const first = amountRows[0];
  const last = amountRows[amountRows.length - 1];
  const hasSpan = first != null && last != null && last >= first;
  const hasRowOrTotal = Boolean(targets?.channels?.length) || metricList(targets ?? {}).some((v) => v != null);
  if (!hasRowOrTotal && !hasSpan) return;
  const totals: Array<number | { formula: string; result?: number } | null> = [
    hasSpan ? { formula: `SUM(I${first}:I${last})`, result: targets?.like_page ?? undefined } : (targets?.like_page ?? null),
    hasSpan ? { formula: `SUM(J${first}:J${last})`, result: targets?.impression ?? undefined } : (targets?.impression ?? null),
    hasSpan ? { formula: `SUM(K${first}:K${last})`, result: targets?.reach ?? undefined } : (targets?.reach ?? null),
    hasSpan ? { formula: `SUM(L${first}:L${last})`, result: targets?.click ?? undefined } : (targets?.click ?? null),
    targets?.ctr ?? null,
    hasSpan ? { formula: `SUM(N${first}:N${last})`, result: targets?.lead ?? undefined } : (targets?.lead ?? null),
  ];
  totals.forEach((value, index) => {
    const cell = sheet.getRow(tongRow).getCell(9 + index);
    if (value == null) {
      cell.value = null;
      return;
    }
    if (typeof value === 'object' && 'formula' in value) {
      const result = value.result;
      cell.value =
        result == null || !Number.isFinite(Number(result))
          ? { formula: value.formula }
          : { formula: value.formula, result: Number(result) };
    } else if (!Number.isFinite(Number(value))) {
      cell.value = null;
      return;
    } else {
      cell.value = Number(value);
    }
    cell.numFmt = index === 4 ? '0.00%' : '#,##0.####';
  });
}

function writeTotal(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  amount: number,
  height: number,
  labelStyle: StyleSnapshot,
  valueStyle: StyleSnapshot,
  formula?: string,
) {
  const row = sheet.getRow(rowNumber);
  row.height = height;
  for (let col = 1; col <= COLS; col += 1) resetCell(row.getCell(col));
  applyStyle(row.getCell(6), labelStyle);
  applyStyle(row.getCell(7), labelStyle);
  row.getCell(6).value = label;
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  const valueCell = row.getCell(8);
  applyStyle(valueCell, valueStyle);
  valueCell.value = formula ? { formula, result: amount } : amount;
  valueCell.numFmt = MONEY;
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

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const sheet = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!sheet) throw new Error('Mẫu báo giá không có sheet.');

  const groupStyle = snapshotCell(sheet.getCell(13, 1));
  const groupHeight = sheet.getRow(13).height || 30;
  const itemStyleA = Array.from({ length: COLS }, (_, index) => snapshotCell(sheet.getCell(14, index + 1)));
  const itemStyleB = Array.from({ length: COLS }, (_, index) => snapshotCell(sheet.getCell(15, index + 1)));
  const totalLabelStyle = snapshotCell(sheet.getCell(23, 6));
  const totalValueStyle = snapshotCell(sheet.getCell(23, 8));
  const grandLabelStyle = snapshotCell(sheet.getCell(25, 6));
  const grandValueStyle = snapshotCell(sheet.getCell(25, 8));
  const totalHeight = sheet.getRow(23).height || 36;
  const grandHeight = sheet.getRow(25).height || 36;
  const footerStyle = snapshotCell(sheet.getCell(28, 1));
  const footerHeight = sheet.getRow(28).height || 35;

  const included = includedGroups(view);
  const project = [...new Set(included.map((group) => group.channel).filter((name) => name && name !== '—'))].join(' · ');

  const headerRowNumber = BODY_START - 1;
  const headerRow = sheet.getRow(headerRowNumber);
  const unitHeaderStyle = snapshotCell(headerRow.getCell(5));
  const qtyHeaderStyle = snapshotCell(headerRow.getCell(6));
  const unitHeader = headerRow.getCell(5).value;
  const qtyHeader = headerRow.getCell(6).value;
  headerRow.getCell(5).value = qtyHeader;
  applyStyle(headerRow.getCell(5), qtyHeaderStyle);
  headerRow.getCell(6).value = unitHeader;
  applyStyle(headerRow.getCell(6), unitHeaderStyle);
  const widthE = sheet.getColumn(5).width;
  const widthF = sheet.getColumn(6).width;
  if (widthE != null || widthF != null) {
    sheet.getColumn(5).width = widthF ?? widthE;
    sheet.getColumn(6).width = widthE ?? widthF;
  }

  const goal = String(campaignTargets?.goal ?? '').trim();
  const ta = String(campaignTargets?.ta ?? '').trim();
  const comms = String(campaignTargets?.comms_period ?? '').trim();
  sheet.getCell('C5').value = goal || '';
  sheet.getCell('C6').value = project;
  sheet.getCell('C7').value = leadLabel.trim() || 'Khách hàng';
  sheet.getCell('C8').value = ta || '';
  sheet.getRow(8).height = ta.length > 80 ? 48 : 32;
  sheet.getCell('C9').value = view.grand_total_vnd;
  sheet.getCell('C9').numFmt = MONEY;
  sheet.getCell('C10').value = comms || '';

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

  const newBodyCount = body.length + 4;
  const oldBodyCount = TEMPLATE_BODY_END - BODY_START + 1;
  const delta = newBodyCount - oldBodyCount;

  unmergeFromRow(sheet, BODY_START);
  if (delta > 0) {
    sheet.spliceRows(TEMPLATE_BODY_END + 1, 0, ...Array.from({ length: delta }, () => [] as ExcelJS.CellValue[]));
  } else if (delta < 0) {
    sheet.spliceRows(BODY_START + newBodyCount, -delta);
  }

  const footerRow = TEMPLATE_FOOTER_ROW + delta;
  const lastClear = Math.max(sheet.rowCount, footerRow + 4);
  for (let rowNumber = BODY_START; rowNumber <= lastClear; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let col = 1; col <= COLS; col += 1) resetCell(row.getCell(col));
  }

  let cursor = BODY_START;
  const amountRows: number[] = [];
  for (const entry of body) {
    const row = sheet.getRow(cursor);
    if (entry.kind === 'group') {
      row.height = groupHeight;
      for (let col = 1; col <= COLS; col += 1) {
        applyStyle(row.getCell(col), groupStyle);
        row.getCell(col).value = col === 1 ? entry.label : null;
      }
      sheet.mergeCells(cursor, 1, cursor, COLS);
    } else {
      const styles = entry.zebra % 2 === 0 ? itemStyleA : itemStyleB;
      row.height = (entry.subtask || '').length > 80 ? 72 : 48;
      const values: Array<ExcelJS.CellValue> = [
        entry.stt,
        entry.channel || null,
        entry.task || null,
        entry.subtask || null,
        entry.qty,
        entry.unit || null,
        entry.price,
        entry.amount != null ? { formula: `E${cursor}*G${cursor}`, result: entry.amount } : null,
        null,
        null,
        null,
        null,
        null,
        null,
      ];
      for (let col = 1; col <= COLS; col += 1) {
        applyStyle(row.getCell(col), styles[col - 1]);
        row.getCell(col).value = values[col - 1] ?? null;
      }
      const rowKpi = matchChannelKpi(campaignTargets, entry.channel, entry.task);
      if (rowKpi) writeKpiCells(row, rowKpi);
      if (entry.amount != null) amountRows.push(cursor);
    }
    cursor += 1;
  }

  const tongRow = cursor;
  const promoRow = cursor + 1;
  const vatRow = cursor + 2;
  const grandRow = cursor + 3;
  const tongFormula = amountRows.length > 0 ? `SUM(H${amountRows[0]}:H${amountRows[amountRows.length - 1]})` : undefined;

  writeTotal(sheet, tongRow, 'TỔNG CỘNG', view.total_vnd, totalHeight, totalLabelStyle, totalValueStyle, tongFormula);
  writeTotal(
    sheet,
    promoRow,
    `Khuyến mại ${formatPercent(view.promo_percent)}%`,
    view.promo_vnd,
    totalHeight,
    totalLabelStyle,
    totalValueStyle,
    `H${tongRow}*${view.promo_percent}%`,
  );
  writeTotal(
    sheet,
    vatRow,
    `VAT ${formatPercent(view.vat_percent)}%`,
    view.vat_vnd,
    totalHeight,
    totalLabelStyle,
    totalValueStyle,
    `(H${tongRow}-H${promoRow})*${view.vat_percent}%`,
  );
  writeTotal(
    sheet,
    grandRow,
    'THÀNH TIỀN',
    view.grand_total_vnd,
    grandHeight,
    grandLabelStyle,
    grandValueStyle,
    `H${tongRow}-H${promoRow}+H${vatRow}`,
  );

  writeTotalsKpis(sheet, tongRow, amountRows, campaignTargets);

  sheet.getRow(grandRow + 1).height = 24;
  sheet.getRow(grandRow + 2).height = 24;
  const foot = sheet.getRow(footerRow);
  foot.height = footerHeight;
  for (let col = 1; col <= COLS; col += 1) {
    applyStyle(foot.getCell(col), footerStyle);
    foot.getCell(col).value =
      col === 1 ? 'BÁO GIÁ ĐƯỢC TRÌNH BÀY THEO MẪU PTT ADS – ĐƠN VỊ CUNG CẤP: PTT ADS' : null;
  }
  sheet.mergeCells(footerRow, 1, footerRow, COLS);
  for (let extra = 1; extra <= 4; extra += 1) {
    sheet.getRow(footerRow + extra).height = 24;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
