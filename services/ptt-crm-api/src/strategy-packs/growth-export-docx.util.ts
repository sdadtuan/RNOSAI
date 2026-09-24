import archiver from 'archiver';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { GrowthTemplateFill, sanitizeExportText } from './growth-export.util';

export const GROWTH_TEMPLATE_KEY = 'strategy_growth_template_v1';

function templatePath(): string {
  return join(__dirname, 'assets', `${GROWTH_TEMPLATE_KEY}.docx`);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cellText(cell: string): string {
  return [...cell.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function setCellText(cell: string, value: string): string {
  const clean = sanitizeExportText(value);
  if (!clean) return cell;
  const escaped = encodeXml(clean);
  if (/<w:t(?:\s[^>]*)?>/.test(cell)) {
    let first = true;
    return cell.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_all, attrs: string | undefined) => {
      if (!first) return `<w:t${attrs ?? ''}></w:t>`;
      first = false;
      const attr = attrs?.includes('xml:space') ? attrs : `${attrs ?? ''} xml:space="preserve"`;
      return `<w:t${attr}>${escaped}</w:t>`;
    });
  }
  return cell.replace(/<\/w:tc>$/, `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p></w:tc>`);
}

function mapRowCells(row: string, index: number, nextCell: string): string {
  let cursor = 0;
  return row.replace(/<w:tc[\s>][\s\S]*?<\/w:tc>/g, (cell) => (cursor++ === index ? nextCell : cell));
}

function setRowCell(row: string, index: number, value: string): string {
  if (!sanitizeExportText(value)) return row;
  const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
  const cell = cells[index];
  if (!cell) return row;
  return mapRowCells(row, index, setCellText(cell, value));
}

function clearRowCell(row: string, index: number): string {
  const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
  const cell = cells[index];
  if (!cell) return row;
  const cleared = cell.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, '<w:t$1></w:t>');
  return mapRowCells(row, index, cleared);
}

function fillLabeledRow(table: string, label: string, col: number, value: string | null): string {
  if (!value || !sanitizeExportText(value)) return table;
  return table.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
    if (cellText(cells[0] ?? '') !== label) return row;
    return setRowCell(row, col, value);
  });
}

function fillSequential(table: string, header: string, values: string[], col: number): string {
  let index = 0;
  return table.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
    if (cellText(cells[0] ?? '') === header) return row;
    const value = values[index];
    index += 1;
    if (!value) return row;
    return setRowCell(row, col, value);
  });
}

function firstHeaders(table: string): string[] {
  const row = table.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/);
  if (!row) return [];
  return (row[0].match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? []).map(cellText);
}

function fillCover(table: string, fill: GrowthTemplateFill): string {
  const pairs: Array<[string, string | null]> = [
    ['Khách hàng', fill.brand],
    ['Thương hiệu', fill.brand],
    ['Ngành hàng', fill.industry],
    ['Thị trường/khu vực', fill.geo],
    ['Thời gian triển khai', fill.period],
    ['Phiên bản', fill.versionLabel],
    ['Ngày lập', fill.issuedOn],
    ['Người phụ trách tài liệu', fill.owner],
    ['Trạng thái', fill.statusLabel],
  ];
  return pairs.reduce((next, [label, value]) => fillLabeledRow(next, label, 1, value), table);
}

function fillIndustry(table: string, pack: GrowthTemplateFill['pack']): string {
  if (!pack) return table;
  let dataRow = 0;
  return table.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
    if (cellText(cells[0] ?? '') === 'Ngành') return row;
    dataRow += 1;
    if (dataRow === 1) {
      let next = setRowCell(row, 0, pack.industry);
      next = setRowCell(next, 1, pack.journey);
      return setRowCell(next, 2, pack.priorities);
    }
    let next = row;
    for (let col = 0; col < 3; col += 1) next = clearRowCell(next, col);
    return next;
  });
}

function fillTable(table: string, fill: GrowthTemplateFill): string {
  const headers = firstHeaders(table);
  const key = headers.slice(0, 2).join('|');
  if (key === 'Nội dung|Thông tin' && table.includes('Khách hàng')) return fillCover(table, fill);
  if (key === 'Mục tiêu|Hiện tại') {
    return fill.goals.reduce((next, goal) => {
      let row = fillLabeledRow(next, goal.row, 1, goal.baseline);
      return fillLabeledRow(row, goal.row, 2, goal.target);
    }, table);
  }
  if (key === 'Nhóm khách|Mô tả') {
    return ['Nhóm A', 'Nhóm B', 'Nhóm C'].reduce(
      (next, label, index) => fillLabeledRow(next, label, 1, fill.icp[index] ?? null),
      table,
    );
  }
  if (key.startsWith('Giai đoạn|')) {
    const stages = ['Biết đến', 'Quan tâm', 'Ra quyết định', 'Trải nghiệm', 'Quay lại', 'Giới thiệu'];
    return stages.reduce((next, stage, index) => fillLabeledRow(next, stage, 1, fill.journeyNotes[index] ?? null), table);
  }
  if (key.startsWith('Tầng ưu đãi|')) {
    return fill.offers.reduce((next, offer) => fillLabeledRow(next, offer.row, 2, offer.example), table);
  }
  if (key === 'Nội dung|Mô tả') {
    let next = fillLabeledRow(table, 'Khách nhận được lợi ích gì?', 1, fill.positioning.benefit);
    next = fillLabeledRow(next, 'Điểm khác biệt chính', 1, fill.positioning.difference);
    next = fillLabeledRow(next, 'Bằng chứng tạo niềm tin', 1, fill.positioning.proof);
    return fillLabeledRow(next, 'Lời hứa thương hiệu', 1, fill.positioning.promise);
  }
  if (key.startsWith('Tên chiến dịch|')) return fillSequential(table, 'Tên chiến dịch', fill.campaigns, 0);
  if (key === 'Tuần|Chủ đề chính') {
    return Object.entries(fill.calendar).reduce(
      (next, [week, focus]) => fillLabeledRow(next, week, 1, focus),
      table,
    );
  }
  if (key === 'Nhóm chi phí|Tháng 1') {
    return fill.budget.reduce((next, line) => {
      let row = fillLabeledRow(next, line.row, 1, line.m1);
      row = fillLabeledRow(row, line.row, 2, line.m2);
      return fillLabeledRow(row, line.row, 3, line.m3);
    }, table);
  }
  if (key === 'Rủi ro|Dấu hiệu sớm') return fillSequential(table, 'Rủi ro', fill.risks, 0);
  if (key === 'Sự kiện|Nhóm khách') return fillSequential(table, 'Sự kiện', fill.retain, 1);
  if (key === 'Ngành|Hành trình trọng tâm') return fillIndustry(table, fill.pack);
  return table;
}

function plainParagraph(paragraph: string): string {
  return [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
}

function fillParagraphTokens(paragraph: string, tokens: Record<string, string>): string {
  const nodes = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
  if (!nodes.length) return paragraph;
  const global = nodes.map((node) => decodeXml(node[1] ?? '')).join('');
  if (!global.includes('[[')) return paragraph;
  const matches = [...global.matchAll(/\[\[[^\]]*\]\]/g)];
  if (!matches.length) return paragraph;
  let rebuilt = '';
  let cursor = 0;
  let changed = false;
  for (const match of matches) {
    const raw = match[0];
    const start = match.index ?? 0;
    const inner = raw.slice(2, -2);
    const key = inner.split(':')[0]?.trim() ?? '';
    rebuilt += global.slice(cursor, start);
    if (!key || key === '...') {
      rebuilt += raw;
    } else {
      changed = true;
      rebuilt += tokens[key] ?? `[[${key}]]`;
    }
    cursor = start + raw.length;
  }
  rebuilt += global.slice(cursor);
  if (!changed) return paragraph;
  let first = true;
  return paragraph.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_all, attrs: string | undefined) => {
    if (!first) return `<w:t${attrs ?? ''}></w:t>`;
    first = false;
    const attr = attrs?.includes('xml:space') ? attrs : `${attrs ?? ''} xml:space="preserve"`;
    return `<w:t${attr}>${encodeXml(rebuilt)}</w:t>`;
  });
}

export function fillGrowthTemplateXml(xml: string, fill: GrowthTemplateFill): string {
  let next = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (table) => fillTable(table, fill));
  next = next.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (paragraph) => fillParagraphTokens(paragraph, fill.tokens));
  let check = 0;
  next = next.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (paragraph) => {
    const plain = plainParagraph(paragraph).replace(/\s+/g, ' ').trim();
    if (!plain.startsWith('[ ]')) return paragraph;
    const on = fill.checklist[check] === true;
    check += 1;
    if (!on) return paragraph;
    return paragraph.replace('[ ]', '[x]');
  });
  return next;
}

function zipDirectory(dir: string): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(stream);
  archive.glob('**/*', { cwd: dir, ignore: ['src.docx', '__MACOSX/**', '**/.DS_Store'], dot: true });
  return archive.finalize().then(() => done);
}

export async function buildGrowthDocx(fill: GrowthTemplateFill): Promise<{
  buffer: Buffer;
  template: { key: typeof GROWTH_TEMPLATE_KEY; sha256: string };
  structure_ok: boolean;
  table_count: number;
}> {
  const templateBytes = readFileSync(templatePath());
  const sha256 = createHash('sha256').update(templateBytes).digest('hex');
  const dir = mkdtempSync(join(tmpdir(), 'growth-tpl-'));
  try {
    const src = join(dir, 'src.docx');
    writeFileSync(src, templateBytes);
    execFileSync('unzip', ['-qq', '-o', src, '-d', dir]);
    const xmlPath = join(dir, 'word', 'document.xml');
    const xml = fillGrowthTemplateXml(readFileSync(xmlPath, 'utf8'), fill);
    const tableCount = (xml.match(/<w:tbl>/g) ?? []).length;
    const structureOk = tableCount >= 20 && xml.includes('KẾ HOẠCH VÀ CHIẾN LƯỢC MARKETING TĂNG TRƯỞNG');
    writeFileSync(xmlPath, xml);
    const buffer = await zipDirectory(dir);
    if (!buffer.length || buffer.subarray(0, 2).toString() !== 'PK') throw new Error('export_engine_failed');
    return {
      buffer,
      template: { key: GROWTH_TEMPLATE_KEY, sha256 },
      structure_ok: structureOk,
      table_count: tableCount,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
