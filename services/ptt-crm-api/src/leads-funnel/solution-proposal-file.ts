import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { SOLUTION_AI_SECTIONS, type SolutionAiSections } from './solution-ai-draft.util';

const GREEN = '14382F';
const INK = '1A2421';
const MUTED = '5E6B66';

export type ProposalSection = { key: string; label: string; body: string };

export type ProposalDocumentInput = {
  title: string;
  clientName: string;
  amName: string;
  dateLabel: string;
  sections: ProposalSection[];
};

type Block =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'callout'; tone: 'proposal' | 'gap'; text: string }
  | { type: 'table'; rows: string[][] };

export function proposalSections(sections: SolutionAiSections): ProposalSection[] {
  return SOLUTION_AI_SECTIONS.map((row) => ({ key: row.key, label: row.label, body: sections[row.key] }));
}

export function parseProposalBlocks(body: string): Block[] {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^\s*\|/.test(line) && index + 1 < lines.length && /^\s*\|?\s*:?-+:?/.test(lines[index + 1] ?? '')) {
      const rows: string[][] = [];
      while (index < lines.length && /^\s*\|/.test(lines[index] ?? '')) {
        const current = lines[index] ?? '';
        if (!/^\s*\|?\s*:?-+:?(\s*\|\s*:?-+:?)+\s*\|?\s*$/.test(current)) {
          rows.push(splitRow(current));
        }
        index += 1;
      }
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (index < lines.length && /^\s*\|/.test(lines[index] ?? '')) {
        rows.push(splitRow(lines[index] ?? ''));
        index += 1;
      }
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'h', text: heading[1].trim() });
      index += 1;
      continue;
    }
    const tone = /\[Cần bổ sung/.test(line) ? 'gap' : /^Đề xuất của PTT/.test(line.trim()) ? 'proposal' : null;
    if (tone) {
      blocks.push({ type: 'callout', tone, text: line.replace(/^\s*[-*]\s+/, '').trim() });
      index += 1;
      continue;
    }
    blocks.push({ type: 'p', text: line.replace(/^\s*[-*]\s+/, '• ').trim() });
    index += 1;
  }
  return blocks;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function fontFile(weight: 'Regular' | 'Bold'): string | null {
  const name = `BeVietnamPro-${weight}.ttf`;
  const candidates = [
    join(process.cwd(), 'assets/fonts', name),
    join(process.cwd(), '../../assets/fonts', name),
    join(__dirname, '../../../../../assets/fonts', name),
    join(__dirname, '../../../../../../assets/fonts', name),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function renderSolutionProposalPdf(input: ProposalDocumentInput): Promise<Buffer> {
  const regular = fontFile('Regular');
  const bold = fontFile('Bold');
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: 64, bottom: 56, left: 48, right: 48 },
    info: { Title: input.title || 'Solution PTT Ads', Author: 'PTT Ads' },
  });
  if (regular) doc.registerFont('Body', regular);
  if (bold) doc.registerFont('Bold', bold);
  const font = regular ? 'Body' : 'Helvetica';
  const fontBold = bold ? 'Bold' : 'Helvetica-Bold';
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - 96;
  doc.rect(0, 0, doc.page.width, 150).fill(`#${GREEN}`);
  doc.fillColor('#FFFFFF').font(fontBold).fontSize(12).text('PTT ADS', 48, 42);
  doc.font(fontBold).fontSize(22).text(input.clientName || 'Khách hàng', 48, 64, { width });
  doc.font(font).fontSize(11).text(input.title || 'Đề xuất Solution Marketing', 48, 100, { width });
  doc.fillColor(`#${INK}`).font(font).fontSize(10);
  doc.text(`Ngày ${input.dateLabel}`, 48, 170);
  doc.text(`AM phụ trách: ${input.amName || '[Cần bổ sung: AM]'}`, 48, 186);
  doc.moveDown();
  doc.font(fontBold).fontSize(14).fillColor(`#${GREEN}`).text('Mục lục', 48, 214);
  doc.font(font).fontSize(10).fillColor(`#${INK}`);
  input.sections.forEach((section, index) => {
    doc.text(`${index + 1}. ${section.label}`, 48, 236 + index * 16);
  });
  input.sections.forEach((section, index) => {
    doc.addPage();
    doc.font(fontBold).fontSize(16).fillColor(`#${GREEN}`).text(`${index + 1}. ${section.label}`, 48, 56, { width });
    doc.moveDown(0.6);
    paintBlocks(doc, parseProposalBlocks(section.body), font, fontBold, width);
  });
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.font(font).fontSize(8).fillColor(`#${MUTED}`);
    doc.text(
      `PTT Ads  ·  Đề xuất Solution  ·  ${page - range.start + 1}/${range.count}`,
      48,
      doc.page.height - 36,
      { width, align: 'right', lineBreak: false },
    );
  }
  doc.end();
  return done;
}

function paintBlocks(
  doc: InstanceType<typeof PDFDocument>,
  blocks: Block[],
  font: string,
  fontBold: string,
  width: number,
): void {
  for (const block of blocks) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    if (block.type === 'h') {
      doc.moveDown(0.4);
      doc.font(fontBold).fontSize(12).fillColor(`#${GREEN}`).text(block.text, 48, doc.y, { width });
      doc.moveDown(0.2);
    } else if (block.type === 'callout') {
      const y = doc.y;
      doc.font(font).fontSize(9);
      const height = doc.heightOfString(block.text, { width: width - 16 }) + 12;
      doc.rect(48, y, width, height).fill(block.tone === 'gap' ? '#FFF4D6' : '#E7F3EE');
      doc.fillColor(`#${INK}`).text(block.text, 56, y + 6, { width: width - 16 });
      doc.y = y + height + 6;
    } else if (block.type === 'table') {
      paintTable(doc, block.rows, font, fontBold, width);
    } else {
      doc.font(font).fontSize(10).fillColor(`#${INK}`).text(block.text, 48, doc.y, { width });
      doc.moveDown(0.15);
    }
  }
}

function paintTable(
  doc: InstanceType<typeof PDFDocument>,
  rows: string[][],
  font: string,
  fontBold: string,
  width: number,
): void {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const colW = width / cols;
  for (const row of rows) {
    const heights = row.map((cell) => doc.font(font).fontSize(8).heightOfString(cell || '—', { width: colW - 8 }));
    const rowH = Math.max(16, ...heights) + 8;
    if (doc.y + rowH > doc.page.height - 64) doc.addPage();
    const y = doc.y;
    const header = row === rows[0];
    for (let cell = 0; cell < cols; cell += 1) {
      const x = 48 + cell * colW;
      doc.rect(x, y, colW, rowH).fill(header ? `#${GREEN}` : '#F7FBFA');
      doc.fillColor(header ? '#FFFFFF' : `#${INK}`).font(header ? fontBold : font).fontSize(8);
      doc.text(row[cell] || '—', x + 4, y + 4, { width: colW - 8, height: rowH - 6 });
    }
    doc.y = y + rowH;
  }
  doc.moveDown(0.4);
}
