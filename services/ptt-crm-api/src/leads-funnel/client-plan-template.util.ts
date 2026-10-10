import { readFile } from 'fs/promises';
import { join } from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const LOCK = '[cần chốt]';

const SAMPLE_FACT =
  /149k|669k|489k|829k|750k|1,4K|999\+|20\+|12h|0927|Hương Mộc|Nguyệt|Miyako|gội|xông|Indochine|24 tr|30 tr|75\.000|800\.000|Hòa Hưng|Tĩnh Viên|TĨNH VIÊN|massagetinhvien|cổ vai|thảo dược|Ohbeauti|Fresha|13\/3\/2026|Chạm tĩnh|Q10|50–100K|Khai Lạc|An Nhiên|Thiền Hương|Ngự Dưỡng|9:30/i;

export interface ClientPlanTemplateInput {
  client: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  fanpage?: string | null;
  niche?: string | null;
  need?: string | null;
  service?: string | null;
  usp?: string | null;
  goal?: string | null;
  channels?: string | null;
  audience?: string | null;
  competitors?: string | null;
  metrics?: string | null;
  retain?: string | null;
  budget?: string | null;
  northStar?: string | null;
  message?: string | null;
  media?: string | null;
  conversion?: string | null;
  now?: Date;
}

export function isSampleClient(input: Pick<ClientPlanTemplateInput, 'client' | 'website' | 'fanpage'>): boolean {
  const blob = `${input.client} ${input.website ?? ''} ${input.fanpage ?? ''}`.toLowerCase();
  return blob.includes('tĩnh viên') || blob.includes('tinh vien') || blob.includes('massagetinhvien');
}

export async function renderClientPlanFromTemplate(input: ClientPlanTemplateInput): Promise<Buffer> {
  const raw = await readFile(join(__dirname, '../assets/client-plan/PTT_Mau_KeHoach.pptx'));
  const zip = await JSZip.loadAsync(raw);
  const sample = isSampleClient(input);
  const order = await slidePaths(zip);
  for (let index = 0; index < order.length; index += 1) {
    const file = zip.file(order[index]);
    if (!file) continue;
    const xml = await file.async('string');
    zip.file(order[index], rewriteXml(xml, input, sample, index + 1, false));
  }
  const notes = Object.keys(zip.files).filter((name) => /ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  for (const name of notes) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    zip.file(name, rewriteXml(xml, input, sample, 0, true));
  }
  await scrubCharts(zip, sample);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function rewriteXml(
  xml: string,
  input: ClientPlanTemplateInput,
  sample: boolean,
  slideNo: number,
  notes: boolean,
): string {
  let seeded = false;
  const rewritten = xml.replace(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g, (paragraph) => {
    const text = paragraphText(paragraph);
    if (!text) return paragraph;
    const leadLine = !sample && !notes && !seeded && text.trim().length > 24 && !keepParagraph(text);
    if (leadLine) seeded = true;
    const next = leadLine ? fit(lineForSlide(slideNo, input), text) : nextParagraph(text, input, sample, slideNo, notes);
    if (next === text) return paragraph;
    return writeParagraph(paragraph, next);
  });
  return rewritten.replace(/descr="([^"]*)"/g, (_full, descr: string) => {
    return `descr="${encodeXml(applyIdentity(decodeXml(descr), input))}"`;
  });
}

function paragraphText(paragraph: string): string {
  return [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((match) => decodeXml(match[1])).join('');
}

function writeParagraph(paragraph: string, text: string): string {
  let used = false;
  return paragraph.replace(/<a:t(\s[^>]*)?>([^<]*)<\/a:t>/g, (_full, attrs: string | undefined) => {
    const value = used ? '' : text;
    used = true;
    return `<a:t${attrs ?? ''}>${encodeXml(value)}</a:t>`;
  });
}

function nextParagraph(
  text: string,
  input: ClientPlanTemplateInput,
  sample: boolean,
  slideNo: number,
  notes: boolean,
): string {
  if (keepParagraph(text)) return applyIdentity(text, input);
  if (sample) return applyIdentity(text, input);
  if (slideNo === 10 && /^(1,4K|4|0)$/.test(text.trim())) return '—';
  if (/^(20\+|1,4K|12h|999\+)$/.test(text.trim())) return '—';
  if (!SAMPLE_FACT.test(text)) return applyIdentity(text, input);
  if (notes) return 'Số liệu này thuộc hồ sơ mẫu. Với khách hiện tại: [cần chốt].';
  return fit(lineForSlide(slideNo, input), text);
}

function keepParagraph(text: string): boolean {
  const value = text.trim();
  if (/^\d{1,2}$/.test(value)) return true;
  if (/^(I{1,3}|IV|VI{0,3}|V|A|B)$/.test(value)) return true;
  if (/^[IVX]+\.\s/.test(value)) return true;
  if (/^Trang \d/.test(value)) return true;
  if (/^PTT Advertising/.test(value)) return true;
  return (
    value === 'Mục lục' ||
    value === 'NỘI DUNG CHÍNH' ||
    value === 'TRỌNG TÂM ĐỀ XUẤT' ||
    value === 'PTT ADVERTISING' ||
    value === 'Cảm ơn' ||
    value === 'ƯU TIÊN'
  );
}

function applyIdentity(text: string, input: ClientPlanTemplateInput): string {
  const client = input.client.trim() || 'Khách hàng';
  const upper = client.toLocaleUpperCase('vi-VN');
  const phone = input.phone?.trim() || LOCK;
  const web = websiteLabel(input.website) || LOCK;
  const address = input.address?.trim() || LOCK;
  const fanpage = input.fanpage?.trim() || LOCK;
  const pairs: Array<[string, string]> = [
    ['MASSAGE TĨNH VIÊN', upper],
    ['Massage Tĩnh Viên', client],
    ['TĨNH VIÊN', upper],
    ['Tĩnh Viên', client],
    ['0927.717.717', phone],
    ['https://www.facebook.com/massagetinhvien', fanpage],
    ['massagetinhvien.com', web],
    ['@massagetinhvien', LOCK],
    ['151 Hòa Hưng, Phường Hòa Hưng, TP.HCM', address],
    ['151 Hòa Hưng, P. Hòa Hưng, TP.HCM', address],
    ['151 Hòa Hưng', address],
    ['bài gần nhất', 'bài gần đây'],
    ['video tốt nhất', 'video xem nhiều'],
    ['Giá massage thấp nhất', 'Giá massage mức thấp'],
    ['Giá massage cao nhất', 'Giá massage mức cao'],
    ['Địa chỉ duy nhất', 'Một địa chỉ,'],
    ['Tháng 10/2026', monthLabel(input.now ?? new Date())],
  ];
  return pairs.reduce((current, [from, to]) => current.split(from).join(to), text);
}

function lineForSlide(slideNo: number, input: ClientPlanTemplateInput): string {
  const name = input.client.trim() || 'Khách hàng';
  const show = (value?: string | null) => value?.trim() || LOCK;
  const lines: Record<number, string> = {
    1: `${name}. ${show(input.address)}. ${show(input.phone)}. ${show(input.website)}`,
    2: `${name} hôm nay`,
    3: `${show(input.niche)}. ${show(input.need)}`,
    4: `Dịch vụ: ${show(input.service)}. Bảng giá: ${LOCK}`,
    5: show(input.usp),
    6: show(input.audience || input.need),
    7: `So sánh giá: ${show(input.competitors)}`,
    8: show(input.message || input.usp),
    9: show(input.metrics || input.website),
    10: `Số liệu online: ${LOCK}`,
    11: `Điểm mạnh: ${show(input.usp)}. Đối thủ: ${show(input.competitors)}`,
    12: show(input.goal || input.northStar),
    13: show(input.message || input.usp),
    14: show(input.channels || input.media),
    15: show(input.media || input.channels),
    16: show(input.channels),
    17: `Từ khóa tìm kiếm: ${LOCK}`,
    18: show(input.retain),
    19: 'Lịch nội dung chốt sau khi chọn kênh.',
    20: show(input.usp),
    21: `Một đầu mối. Zalo ${show(input.phone)}. CRM rs.pttads.vn`,
    22: `Ngân sách: ${show(input.budget)}. Phí PTT tính riêng ${LOCK}. Khách trả trực tiếp cho nền tảng.`,
    23: 'KPI là số minh họa, chốt sau 14 ngày chạy thử. Không cam kết doanh thu.',
    24: `90 ngày theo mục tiêu: ${show(input.goal || input.northStar)}. Mốc ngày 14 chốt dải KPI.`,
    25: 'Báo cáo tuần: tin nhắn, lịch hẹn, khách đến, chi phí. PTT làm chiến lược và báo cáo.',
    26: `Chốt ngân sách: ${show(input.budget)}. Rồi chạy thử 14 ngày.`,
    27: `${name}. ${show(input.address)}. ${show(input.phone)}`,
  };
  return lines[slideNo] ?? LOCK;
}

function fit(next: string, previous: string): string {
  const limit = previous.trim().length;
  const clean = next.replace(/\s+/g, ' ').trim();
  if (limit <= 8) return '—';
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

async function scrubCharts(zip: JSZip, sample: boolean): Promise<void> {
  const charts = Object.keys(zip.files).filter((name) => /ppt\/charts\/chart\d+\.xml$/.test(name));
  for (const chartPath of charts) {
    const workbookPath = await workbookForChart(zip, chartPath);
    const kind = workbookPath?.endsWith('Sheet3.xlsx') ? 'price' : workbookPath?.endsWith('Sheet2.xlsx') ? 'kpi' : 'mix';
    const file = zip.file(chartPath);
    if (!file) continue;
    let xml = await file.async('string');
    xml = xml.replaceAll('Giá massage thấp nhất', 'Giá massage mức thấp').replaceAll('Giá massage cao nhất', 'Giá massage mức cao');
    if (!sample && kind !== 'mix') xml = zeroChart(xml, kind === 'price');
    zip.file(chartPath, xml);
    if (workbookPath && (!sample && kind !== 'mix' || kind === 'price')) {
      await scrubWorkbook(zip, workbookPath, kind, sample);
    }
  }
}

function zeroChart(xml: string, price: boolean): string {
  let next = xml;
  if (price) {
    for (const name of ['Dưỡng Sinh Bà Ba', 'Dưỡng Sinh Cô Ba', 'Rêu Spa', 'Miyako Spa', 'Nguyệt Lâu', 'TĨNH VIÊN']) {
      next = next.replaceAll(name, LOCK);
    }
  }
  return next.replace(/<c:v>\d+<\/c:v>/g, '<c:v>0</c:v>');
}

async function scrubWorkbook(zip: JSZip, path: string, kind: 'price' | 'kpi' | 'mix', sample: boolean): Promise<void> {
  const file = zip.file(path);
  if (!file) return;
  const workbook = new ExcelJS.Workbook();
  const bytes = await file.async('nodebuffer');
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return;
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (kind === 'price' && typeof cell.value === 'string') {
        if (cell.value.includes('thấp')) cell.value = 'Giá massage mức thấp';
        else if (cell.value.includes('cao')) cell.value = 'Giá massage mức cao';
        else if (!sample) cell.value = LOCK;
      }
      if (!sample && kind !== 'mix' && typeof cell.value === 'number') cell.value = 0;
    });
  });
  const out = await workbook.xlsx.writeBuffer();
  zip.file(path, Buffer.from(out));
}

async function workbookForChart(zip: JSZip, chartPath: string): Promise<string | null> {
  const relsPath = chartPath.replace('ppt/charts/', 'ppt/charts/_rels/') + '.rels';
  const rels = await zip.file(relsPath)?.async('string');
  const target = rels?.match(/Target="([^"]+\.xlsx)"/)?.[1];
  if (!target) return null;
  return `ppt/${target.replace(/^\.\.\//, '')}`;
}

async function slidePaths(zip: JSZip): Promise<string[]> {
  const presentation = await zip.file('ppt/presentation.xml')?.async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (!presentation || !rels) return [];
  const ids = [...presentation.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((match) => match[1]);
  return ids.map((id) => {
    const tag = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${id}"[^>]*>`))?.[0] ?? '';
    const target = tag.match(/Target="([^"]+)"/)?.[1] ?? '';
    return `ppt/${target.replace(/^\.\.\//, '')}`;
  });
}

function websiteLabel(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function monthLabel(date: Date): string {
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
