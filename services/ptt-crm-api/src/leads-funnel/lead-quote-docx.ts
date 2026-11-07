import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type ITableCellBorders,
} from 'docx';
import type { QuoteSheetGroup, QuoteSheetView } from './quote-sheet.util';

const FONT = 'Calibri';
const INK = '1A2421';
const MUTED = '5E6B66';
const BAND = '14382F';
const GROUP = 'E7F3EE';
const LINE = 'D5E0DB';
const WHITE = 'FFFFFF';

const PAGE_W = 11906;
const MARGIN = 720;
const TABLE_W = PAGE_W - MARGIN * 2;
const COL_STT = 900;
const COL_TASK = 3000;
const COL_AMOUNT = 2200;
const COL_DESC = TABLE_W - COL_STT - COL_TASK - COL_AMOUNT;
const LABEL_W = TABLE_W - COL_AMOUNT;

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const BORDERS: ITableCellBorders = {
  top: { style: BorderStyle.SINGLE, size: 8, color: LINE },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: LINE },
  left: { style: BorderStyle.SINGLE, size: 8, color: LINE },
  right: { style: BorderStyle.SINGLE, size: 8, color: LINE },
};

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

function paragraph(
  text: string,
  opts: { bold?: boolean; color?: string; size?: number; align?: Align } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color ?? INK,
        size: opts.size ?? 21,
      }),
    ],
  });
}

function cell(
  text: string,
  opts: {
    bold?: boolean;
    color?: string;
    fill?: string;
    align?: Align;
    span?: number;
    width?: number;
  } = {},
): TableCell {
  return new TableCell({
    width: opts.width != null ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.span,
    borders: BORDERS,
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    ...(opts.fill ? { shading: { type: ShadingType.CLEAR, fill: opts.fill } } : {}),
    children: [paragraph(text, opts)],
  });
}

function includedSections(view: QuoteSheetView): Array<{
  label: string;
  lines: Array<{ stt: number; task: string; detail: string; amount: string }>;
}> {
  let stt = 1;
  const sections: Array<{
    label: string;
    lines: Array<{ stt: number; task: string; detail: string; amount: string }>;
  }> = [];
  for (const group of view.groups) {
    const lines: Array<{ stt: number; task: string; detail: string; amount: string }> = [];
    for (const row of group.rows) {
      if (!row.included) continue;
      lines.push({
        stt,
        task: shownTask(row.task),
        detail: shownDetail(row.subtask),
        amount: vnd(row.amount_vnd),
      });
      stt += 1;
    }
    if (lines.length === 0) continue;
    sections.push({ label: groupLabel(group), lines });
  }
  return sections;
}

export async function renderLeadQuoteDocx(view: QuoteSheetView, leadLabel: string): Promise<Buffer> {
  const client = clientLabel(leadLabel);
  const sections = includedSections(view);
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        cell('STT', { bold: true, color: WHITE, fill: BAND, align: AlignmentType.CENTER, width: COL_STT }),
        cell('Phần việc', { bold: true, color: WHITE, fill: BAND, width: COL_TASK }),
        cell('Mô tả', { bold: true, color: WHITE, fill: BAND, width: COL_DESC }),
        cell('Thành tiền', {
          bold: true,
          color: WHITE,
          fill: BAND,
          align: AlignmentType.RIGHT,
          width: COL_AMOUNT,
        }),
      ],
    }),
  ];

  if (sections.length === 0) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell('Chưa có hạng mục', {
            color: MUTED,
            align: AlignmentType.CENTER,
            span: 4,
            width: TABLE_W,
          }),
        ],
      }),
    );
  } else {
    for (const section of sections) {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(section.label, {
              bold: true,
              color: BAND,
              fill: GROUP,
              span: 4,
              width: TABLE_W,
            }),
          ],
        }),
      );
      for (const line of section.lines) {
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              cell(String(line.stt), { align: AlignmentType.CENTER, width: COL_STT }),
              cell(line.task, { width: COL_TASK }),
              cell(line.detail, { width: COL_DESC }),
              cell(line.amount, { align: AlignmentType.RIGHT, width: COL_AMOUNT }),
            ],
          }),
        );
      }
    }
  }

  const totals: Array<{ label: string; amount: string; grand?: boolean }> = [
    { label: 'Tạm tính', amount: vnd(view.total_vnd) },
    { label: `Khuyến mại ${formatPercent(view.promo_percent)}%`, amount: vnd(view.promo_vnd) },
    { label: `VAT ${formatPercent(view.vat_percent)}%`, amount: vnd(view.vat_vnd) },
    { label: 'Tổng thanh toán', amount: vnd(view.grand_total_vnd), grand: true },
  ];
  for (const total of totals) {
    const tone = total.grand ? { color: WHITE, fill: BAND } : {};
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell(total.label, {
            bold: true,
            align: AlignmentType.RIGHT,
            span: 3,
            width: LABEL_W,
            ...tone,
          }),
          cell(total.amount, {
            bold: true,
            align: AlignmentType.RIGHT,
            width: COL_AMOUNT,
            ...tone,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    title: 'Báo giá',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 16838 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children: [
          paragraph('BÁO GIÁ', { bold: true, size: 36, color: BAND }),
          paragraph(client, { size: 24 }),
          paragraph(`Ngày xuất: ${issuedDateIct()}`, { size: 18, color: MUTED, align: AlignmentType.RIGHT }),
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [COL_STT, COL_TASK, COL_DESC, COL_AMOUNT],
            layout: TableLayoutType.FIXED,
            borders: BORDERS,
            rows,
          }),
        ],
      },
    ],
  });

  const packed = await Packer.toBuffer(doc);
  return Buffer.isBuffer(packed) ? packed : Buffer.from(packed);
}
