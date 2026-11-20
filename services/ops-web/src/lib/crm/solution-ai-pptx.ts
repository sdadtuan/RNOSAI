import { formatSolutionAiSectionText } from '@/lib/crm/solution-ai-draft-display';

const GREEN_DARK = '173526';
const GREEN = '17692F';
const GREEN_SOFT = 'E4F4EA';
const GREEN_BAND = 'F3FBF6';
const TEXT = '243027';
const MUTED = '5B6570';
const WHITE = 'FFFFFF';
const GREEN_MIST = 'A8D5B5';

const PAGE_W = 13.333;
const PAGE_H = 7.5;

export type SolutionPptxSection = { key: string; label: string; body: string };

export type SolutionPptxInput = {
  customer: string;
  contactName?: string;
  leadCode?: string;
  createdAt?: string;
  subtitle?: string;
  sections: SolutionPptxSection[];
  fileBase?: string;
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'Solution (AI)';
}

function deckTitle(input: SolutionPptxInput): string {
  const title = String(input.subtitle ?? '').trim();
  if (title && !/^bản nháp solution$/i.test(title) && !['solution', 'file solution'].includes(title.toLowerCase())) {
    return title;
  }
  return `Solution - ${input.customer}`;
}

function linesFromBody(key: string, body: string): string[] {
  const text = formatSolutionAiSectionText(body, key).replace(/\r\n/g, '\n');
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .trim();
    if (line) lines.push(line);
  }
  return lines.length ? lines : ['Chưa có nội dung.'];
}

function chunkLines(lines: string[], maxLines = 9, maxChars = 900): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const line of lines) {
    const nextChars = chars + line.length;
    if (current.length >= maxLines || (current.length > 0 && nextChars > maxChars)) {
      pages.push(current);
      current = [];
      chars = 0;
    }
    current.push(line);
    chars += line.length;
  }
  if (current.length) pages.push(current);
  return pages;
}

async function loadLogoData(): Promise<string | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const base = typeof document !== 'undefined' ? document.baseURI : '';
    const url = base ? new URL('/brand/ptt-logo.png', base).toString() : '/brand/ptt-logo.png';
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return `image/png;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function addLogo(
  slide: { addImage: (opts: { data?: string; x: number; y: number; w: number; h: number }) => unknown },
  logoData: string | null,
  x: number,
  y: number,
  size: number,
): void {
  if (!logoData) return;
  slide.addImage({ data: logoData, x, y, w: size, h: size });
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export async function buildSolutionAiPptx(input: SolutionPptxInput, logoData?: string | null) {
  const PptxCtor = (await import('pptxgenjs')).default;
  const pres = new PptxCtor();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'PTT';
  pres.company = 'PTT';
  pres.subject = 'Tài liệu đề xuất Solution';
  pres.title = deckTitle(input);
  const logo = logoData === undefined ? await loadLogoData() : logoData;
  const customer = (input.customer || '').trim() || 'Khách hàng';
  const title = deckTitle(input);

  const cover = pres.addSlide();
  cover.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: PAGE_H, fill: { color: GREEN_DARK } });
  cover.addShape(pres.ShapeType.rect, { x: 0, y: 6.55, w: PAGE_W, h: 0.95, fill: { color: GREEN } });
  addLogo(cover, logo, 0.55, 0.38, 0.62);
  cover.addText('PTT', {
    x: 1.3,
    y: 0.48,
    w: 4,
    h: 0.42,
    fontFace: 'Calibri',
    fontSize: 18,
    bold: true,
    color: WHITE,
    margin: 0,
  });
  cover.addText('TÀI LIỆU ĐỀ XUẤT', {
    x: 0.55,
    y: 1.85,
    w: 12.2,
    h: 0.32,
    fontFace: 'Calibri',
    fontSize: 13,
    bold: true,
    color: GREEN_MIST,
    charSpacing: 3,
    margin: 0,
  });
  cover.addText('SOLUTION', {
    x: 0.55,
    y: 2.2,
    w: 12.2,
    h: 0.7,
    fontFace: 'Calibri',
    fontSize: 40,
    bold: true,
    color: WHITE,
    margin: 0,
  });
  cover.addText(title, {
    x: 0.55,
    y: 3.0,
    w: 12.2,
    h: 0.7,
    fontFace: 'Calibri',
    fontSize: 20,
    color: GREEN_SOFT,
    margin: 0,
  });
  cover.addText(customer, {
    x: 0.55,
    y: 3.75,
    w: 12.2,
    h: 0.4,
    fontFace: 'Calibri',
    fontSize: 18,
    bold: true,
    color: WHITE,
    margin: 0,
  });
  const meta = [input.contactName && input.contactName !== customer ? input.contactName : '', input.leadCode ? `#${input.leadCode}` : '', input.createdAt]
    .filter((part) => String(part ?? '').trim())
    .join('  ·  ');
  if (meta) {
    cover.addText(meta, {
      x: 0.55,
      y: 6.75,
      w: 12.2,
      h: 0.35,
      fontFace: 'Calibri',
      fontSize: 13,
      color: WHITE,
      margin: 0,
    });
  }

  input.sections.forEach((section, index) => {
    const pages = chunkLines(linesFromBody(section.key, section.body));
    pages.forEach((pageLines, pageIndex) => {
      const slide = pres.addSlide();
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: 0.12, fill: { color: GREEN } });
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.12, w: PAGE_W, h: 0.98, fill: { color: GREEN_BAND } });
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 7.22, w: PAGE_W, h: 0.28, fill: { color: GREEN_BAND } });
      addLogo(slide, logo, 12.45, 0.28, 0.42);
      const heading = pages.length > 1 ? `${section.label} (${pageIndex + 1}/${pages.length})` : section.label;
      slide.addText(`${String(index + 1).padStart(2, '0')}  ${heading}`, {
        x: 0.5,
        y: 0.28,
        w: 11.7,
        h: 0.62,
        fontFace: 'Calibri',
        fontSize: 22,
        bold: true,
        color: GREEN_DARK,
        margin: 0,
      });
      slide.addText(
        pageLines.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
        {
          x: 0.55,
          y: 1.3,
          w: 12.2,
          h: 5.7,
          fontFace: 'Calibri',
          fontSize: 16,
          color: TEXT,
          valign: 'top',
          paraSpaceAfter: 8,
        },
      );
      slide.addText('PTT  ·  Tài liệu đề xuất Solution', {
        x: 0.5,
        y: 7.24,
        w: 9.5,
        h: 0.22,
        fontFace: 'Calibri',
        fontSize: 10,
        color: MUTED,
        margin: 0,
      });
    });
  });

  return pres;
}

export async function buildSolutionAiPptxNodeBuffer(
  input: SolutionPptxInput,
  logoData?: string | null,
): Promise<Buffer> {
  const pres = await buildSolutionAiPptx(input, logoData ?? null);
  const output = await pres.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

export function solutionAiPptxFileName(input: SolutionPptxInput): string {
  const base = sanitizeFileName(input.fileBase || `Solution - ${input.customer} (AI)`).replace(/\.(html|doc|docx|pptx)$/i, '');
  return `${base}.pptx`;
}

export async function downloadSolutionAiPptxDocument(input: SolutionPptxInput): Promise<void> {
  const pres = await buildSolutionAiPptx(input);
  const fileName = solutionAiPptxFileName(input);
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const raw = (await pres.write({ outputType: 'blob' })) as Blob;
    const blob = raw.type === PPTX_MIME ? raw : new Blob([raw], { type: PPTX_MIME });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
    return;
  }
  await pres.writeFile({ fileName });
}
