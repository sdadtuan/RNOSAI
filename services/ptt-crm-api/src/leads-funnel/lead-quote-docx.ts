import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
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

const NO_BORDERS: ITableCellBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left: { style: BorderStyle.NONE, size: 0, color: WHITE },
  right: { style: BorderStyle.NONE, size: 0, color: WHITE },
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
  opts: {
    bold?: boolean;
    color?: string;
    size?: number;
    align?: Align;
    before?: number;
    after?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing:
      opts.before != null || opts.after != null
        ? { before: opts.before ?? 0, after: opts.after ?? 0, line: 276, lineRule: LineRuleType.AUTO }
        : undefined,
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

function commercialTable(view: QuoteSheetView): Table {
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

  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [COL_STT, COL_TASK, COL_DESC, COL_AMOUNT],
    layout: TableLayoutType.FIXED,
    borders: BORDERS,
    rows,
  });
}

export async function renderLeadQuoteDocx(view: QuoteSheetView, leadLabel: string): Promise<Buffer> {
  const client = clientLabel(leadLabel);
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
          commercialTable(view),
        ],
      },
    ],
  });

  const packed = await Packer.toBuffer(doc);
  return Buffer.isBuffer(packed) ? packed : Buffer.from(packed);
}

export async function renderLeadContractDocx(
  view: QuoteSheetView,
  input: {
    client: string;
    statusLabel: string;
    createdLabel: string;
    signedLabel: string;
    amountVnd: number;
    contractNo?: string;
    contactName?: string;
    address?: string;
    phone?: string;
    email?: string;
  },
): Promise<Buffer> {
  const client = clientLabel(input.client);
  const partyLines = [
    input.contactName?.trim() ? `Người liên hệ: ${input.contactName.trim()}` : '',
    input.address?.trim() ? `Địa chỉ: ${input.address.trim()}` : '',
    input.phone?.trim() ? `Điện thoại: ${input.phone.trim()}` : '',
    input.email?.trim() ? `Email: ${input.email.trim()}` : '',
  ].filter(Boolean);
  const article = (text: string) =>
    paragraph(text, { bold: true, size: 24, color: BAND, before: 280, after: 80 });
  const body = (text: string, opts: { bold?: boolean; size?: number; color?: string; align?: Align; before?: number } = {}) =>
    paragraph(text, { size: 21, after: 120, ...opts });
  const half = Math.floor(TABLE_W / 2);
  const signCell = (title: string, name: string) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      borders: NO_BORDERS,
      margins: { top: 200, bottom: 120, left: 120, right: 120 },
      children: [
        paragraph(title, { bold: true, size: 22, align: AlignmentType.CENTER, before: 80, after: 60 }),
        paragraph(name, { bold: true, size: 21, align: AlignmentType.CENTER, after: 80 }),
        paragraph('Ký, ghi rõ họ tên', { size: 20, color: MUTED, align: AlignmentType.CENTER, after: 1400 }),
      ],
    });
  const children: Array<Paragraph | Table> = [
    body('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
      bold: true,
      size: 22,
      align: AlignmentType.CENTER,
      before: 80,
    }),
    body('Độc lập - Tự do - Hạnh phúc', {
      size: 20,
      align: AlignmentType.CENTER,
    }),
    body('HỢP ĐỒNG CUNG CẤP DỊCH VỤ', {
      bold: true,
      size: 36,
      color: BAND,
      align: AlignmentType.CENTER,
      before: 200,
    }),
    body(input.contractNo?.trim() ? `Số: ${input.contractNo.trim()}` : 'Số: —', {
      align: AlignmentType.CENTER,
    }),
    body(`Tình trạng: ${input.statusLabel}`, { align: AlignmentType.CENTER }),
    input.createdLabel ? body(`Ngày lập: ${input.createdLabel}`, { size: 20, color: MUTED }) : body(''),
    input.signedLabel ? body(`Ngày duyệt: ${input.signedLabel}`, { size: 20, color: MUTED }) : body(''),
    body(
      'Căn cứ nhu cầu của khách hàng và báo giá đã chốt, hai bên thống nhất ký hợp đồng với các điều khoản sau.',
      { before: 160 },
    ),
    article('Điều 1. Các bên'),
    body(`Bên A (Khách hàng): ${client}`, { bold: true }),
    ...partyLines.map((line) => body(line)),
    body('Bên B (Nhà cung cấp): PTT', { bold: true, before: 80 }),
    article('Điều 2. Phạm vi công việc'),
    body(
      'Bên B thực hiện các hạng mục dưới đây. Phạm vi lấy từ báo giá đã chốt, không gồm tên nhân sự hay đơn giá giờ.',
    ),
    commercialTable(view),
    article('Điều 3. Giá trị hợp đồng'),
    body(`Giá trị hợp đồng: ${vnd(input.amountVnd)}`, { bold: true, size: 22 }),
    body(
      'Số tiền là tổng thanh toán trên bảng phạm vi, đã trừ khuyến mại và cộng VAT. Bên A thanh toán theo hóa đơn Bên B xuất sau khi hợp đồng có hiệu lực.',
    ),
    article('Điều 4. Thời hạn và triển khai'),
    body(
      'Thời hạn theo từng hạng mục trong phạm vi. Lịch triển khai được chốt sau khi hợp đồng có hiệu lực. Lead chỉ sang Triển Khai khi GĐKD Bên B đã duyệt hợp đồng này.',
    ),
    article('Điều 5. Hiệu lực'),
    body(
      'Hợp đồng có hiệu lực khi GĐKD Bên B duyệt. Mỗi bên giữ một bản. Nội dung ngoài bảng phạm vi phải được hai bên thống nhất bằng văn bản.',
    ),
    new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [signCell('ĐẠI DIỆN BÊN A', client), signCell('ĐẠI DIỆN BÊN B', 'PTT')],
        }),
      ],
    }),
  ];
  const doc = new Document({
    title: 'Hợp đồng cung cấp dịch vụ',
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
        children,
      },
    ],
  });
  const packed = await Packer.toBuffer(doc);
  return Buffer.isBuffer(packed) ? packed : Buffer.from(packed);
}
