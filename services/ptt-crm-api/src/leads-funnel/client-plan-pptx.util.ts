import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import PptxGenJS from 'pptxgenjs';
import type { ClientPlanSlide } from './client-plan-deck.util';

const execFileAsync = promisify(execFile);

export const LIBREOFFICE_MISSING_NOTE = 'Máy chủ chưa có LibreOffice, tải PPTX.';

export async function renderClientPlanPptx(deck: { slides: ClientPlanSlide[] }): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CLIENT_16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'CLIENT_16x9';
  pptx.author = 'PTT Advertising';
  pptx.title = deck.slides[0]?.title || 'Kế hoạch tiếp thị tích hợp';

  for (const item of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F6F3EC' };
    if (item.cover) {
      slide.addText(item.title, {
        x: 0.6,
        y: 1.05,
        w: 7.2,
        h: 1.5,
        fontFace: 'Georgia',
        fontSize: 34,
        bold: true,
        color: '1E4A32',
      });
      slide.addText(item.body[0] ?? '', {
        x: 0.6,
        y: 2.8,
        w: 6.6,
        h: 0.5,
        fontSize: 18,
        align: 'center',
        color: 'F6F3EC',
        fill: { color: '1E4A32' },
      });
      slide.addText(item.body.slice(1).join('\n'), {
        x: 0.6,
        y: 3.55,
        w: 6.6,
        h: 2.2,
        fontSize: 14,
        color: '1E4A32',
      });
      if (item.imageUrl) {
        slide.addImage({ path: item.imageUrl, x: 8.15, y: 1.15, w: 4.5, h: 5.1 });
      }
    } else {
      slide.addText(item.kicker, { x: 0.55, y: 0.28, w: 12, h: 0.28, fontSize: 12, bold: true, color: 'B08958' });
      slide.addText(item.title, {
        x: 0.55,
        y: 0.58,
        w: 12.2,
        h: 0.5,
        fontFace: 'Georgia',
        fontSize: 26,
        bold: true,
        color: '1E4A32',
      });
      slide.addText(item.body.join('\n'), {
        x: 0.55,
        y: 1.3,
        w: 12.2,
        h: 5.4,
        fontSize: 16,
        color: '1E4A32',
        valign: 'top',
      });
    }
    slide.addText(item.footer, { x: 0.5, y: 7.08, w: 12.3, h: 0.26, fontSize: 11, color: '1E4A32' });
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as Uint8Array);
}

export async function findSoffice(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', ['soffice'], { timeout: 2000 });
    const found = String(stdout ?? '').trim();
    return found || null;
  } catch {
    return null;
  }
}

export async function convertClientPlanPdf(
  pptx: Buffer,
  pptxFilename: string,
  sofficePath: string | null,
): Promise<{ pdf: Buffer | null; filename: string | null; note: string | null }> {
  const pdfName = pptxFilename.replace(/\.pptx$/i, '.pdf');
  if (!sofficePath) return { pdf: null, filename: null, note: LIBREOFFICE_MISSING_NOTE };
  const dir = await mkdtemp(join(tmpdir(), 'client-plan-'));
  try {
    const pptxPath = join(dir, pptxFilename);
    await writeFile(pptxPath, pptx);
    await execFileAsync(
      sofficePath,
      ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, pptxPath],
      { timeout: 60_000 },
    );
    const pdf = await readFile(join(dir, pdfName));
    return { pdf, filename: pdfName, note: null };
  } catch {
    return { pdf: null, filename: null, note: LIBREOFFICE_MISSING_NOTE };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
