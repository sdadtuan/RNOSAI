import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';

export type IngestChunk = {
  chunk_key: string;
  title: string;
  body: string;
  kind: 'qa' | 'pricing' | 'battle_card' | 'case' | 'other';
};

export const SALES_KIT_XLSX_ROW_CAP = 200;
export const SALES_KIT_PDF_CHUNK_SIZE = 800;
export const SALES_KIT_PDF_CHUNK_OVERLAP = 80;

const QA_QUESTION_ALIASES = new Set(['question', 'cau_hoi', 'q']);
const QA_ANSWER_ALIASES = new Set(['answer', 'cau_tra_loi', 'a']);
const PRICING_ITEM_ALIASES = new Set(['item', 'goi']);

type ParsedKind = 'qa' | 'pricing';

type ColumnMap = {
  question?: number;
  answer?: number;
  item?: number;
  minVnd?: number;
  maxVnd?: number;
  note?: number;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return '';
  const cell = row.getCell(col);
  const raw = cell.text ?? cell.value;
  if (raw == null) return '';
  return String(raw).trim();
}

function titleFromQuestion(question: string): string {
  return [...question].slice(0, 80).join('');
}

function mapColumns(headerRow: ExcelJS.Row): ColumnMap {
  const map: ColumnMap = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = normalizeHeader(cell.value);
    if (!key) return;
    if (QA_QUESTION_ALIASES.has(key)) map.question = colNumber;
    else if (QA_ANSWER_ALIASES.has(key)) map.answer = colNumber;
    else if (PRICING_ITEM_ALIASES.has(key)) map.item = colNumber;
    else if (key === 'min_vnd') map.minVnd = colNumber;
    else if (key === 'max_vnd') map.maxVnd = colNumber;
    else if (key === 'note') map.note = colNumber;
  });
  return map;
}

function hasQaColumns(map: ColumnMap): boolean {
  return map.question != null && map.answer != null;
}

function hasPricingColumns(map: ColumnMap): boolean {
  return map.item != null && map.minVnd != null && map.maxVnd != null;
}

function resolveKind(
  requested: 'qa' | 'pricing' | 'auto',
  map: ColumnMap,
): ParsedKind | 'xlsx_qa_columns' {
  if (requested === 'qa') {
    return hasQaColumns(map) ? 'qa' : 'xlsx_qa_columns';
  }
  if (requested === 'pricing') {
    return hasPricingColumns(map) ? 'pricing' : 'xlsx_qa_columns';
  }
  if (hasQaColumns(map)) return 'qa';
  if (map.minVnd != null) return 'pricing';
  return 'xlsx_qa_columns';
}

function parseQaRows(ws: ExcelJS.Worksheet, map: ColumnMap): IngestChunk[] {
  const chunks: IngestChunk[] = [];
  for (let rowNumber = 2; rowNumber <= ws.rowCount && chunks.length < SALES_KIT_XLSX_ROW_CAP; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const question = cellText(row, map.question);
    const answer = cellText(row, map.answer);
    if (!question && !answer) continue;
    chunks.push({
      chunk_key: `r${rowNumber}`,
      title: titleFromQuestion(question),
      body: `Q: ${question}\nA: ${answer}`,
      kind: 'qa',
    });
  }
  return chunks;
}

function parsePricingRows(ws: ExcelJS.Worksheet, map: ColumnMap): IngestChunk[] {
  const chunks: IngestChunk[] = [];
  for (let rowNumber = 2; rowNumber <= ws.rowCount && chunks.length < SALES_KIT_XLSX_ROW_CAP; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const item = cellText(row, map.item);
    const min = cellText(row, map.minVnd);
    const max = cellText(row, map.maxVnd);
    const note = cellText(row, map.note);
    if (!item && !min && !max && !note) continue;
    chunks.push({
      chunk_key: `r${rowNumber}`,
      title: titleFromQuestion(item),
      body: `Gói ${item}: ${min}–${max} VND. ${note}`.trim(),
      kind: 'pricing',
    });
  }
  return chunks;
}

export async function parseSalesKitXlsx(
  buf: Buffer,
  kind: 'qa' | 'pricing' | 'auto',
): Promise<{ chunks: IngestChunk[]; error?: 'xlsx_qa_columns' | 'xlsx_empty' }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf) as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { chunks: [], error: 'xlsx_empty' };
  }

  const map = mapColumns(ws.getRow(1));
  const resolved = resolveKind(kind, map);
  if (resolved === 'xlsx_qa_columns') {
    return { chunks: [], error: 'xlsx_qa_columns' };
  }

  const chunks = resolved === 'qa' ? parseQaRows(ws, map) : parsePricingRows(ws, map);
  if (chunks.length === 0) {
    return { chunks: [], error: 'xlsx_empty' };
  }
  return { chunks };
}

export function imageParseStatus(llmOn: boolean): 'pending_vision' | 'needs_ocr' {
  return llmOn ? 'pending_vision' : 'needs_ocr';
}

function chunkPageText(text: string, page: number): IngestChunk[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const chunks: IngestChunk[] = [];
  const step = SALES_KIT_PDF_CHUNK_SIZE - SALES_KIT_PDF_CHUNK_OVERLAP;
  let start = 0;
  let i = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + SALES_KIT_PDF_CHUNK_SIZE, cleaned.length);
    const body = cleaned.slice(start, end);
    chunks.push({
      chunk_key: `p${page}:${i}`,
      title: [...body].slice(0, 80).join(''),
      body,
      kind: 'other',
    });
    i += 1;
    if (end >= cleaned.length) break;
    start += step;
  }
  return chunks;
}

export async function parseSalesKitPdf(
  buf: Buffer,
): Promise<{ chunks: IngestChunk[]; error?: 'pdf_needs_ocr' }> {
  let pages: Array<{ num: number; text: string }> = [];
  try {
    const parser = new PDFParse({ data: Buffer.from(buf) });
    try {
      const result = await parser.getText();
      pages = result.pages ?? [];
    } finally {
      await parser.destroy();
    }
  } catch {
    return { chunks: [], error: 'pdf_needs_ocr' };
  }

  const chunks: IngestChunk[] = [];
  for (const page of pages) {
    chunks.push(...chunkPageText(page.text ?? '', page.num));
  }
  if (chunks.length === 0) {
    return { chunks: [], error: 'pdf_needs_ocr' };
  }
  return { chunks };
}
