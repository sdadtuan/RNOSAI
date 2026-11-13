import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { QuoteSheetGroup, QuoteSheetRow, QuoteSheetView } from './quote-sheet.util';
import { vndInWords } from './vnd-in-words';

export const PTT_CONTRACT_TEMPLATE_FILENAME = 'ptt-hop-dong-dich-vu-marketing.docx';

export function resolvePttContractTemplatePath(): string | null {
  const filename = PTT_CONTRACT_TEMPLATE_FILENAME;
  const candidates = [
    path.join(__dirname, '..', 'assets', 'contracts', filename),
    path.join(__dirname, '..', '..', 'src', 'assets', 'contracts', filename),
    path.join(process.cwd(), 'src', 'assets', 'contracts', filename),
    path.join(process.cwd(), 'assets', 'contracts', filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function loadPttContractTemplate(): Buffer {
  const found = resolvePttContractTemplatePath();
  if (!found) {
    throw new Error('Không tìm thấy mẫu hợp đồng dịch vụ marketing của PTT.');
  }
  return fs.readFileSync(found);
}

export function formatVndDots(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function escapeXml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatViDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  if (x.getDate() < day) x.setDate(0);
  return x;
}

export function brandCodeFromName(name: string): string {
  const stripped = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(
      /\b(cong ty|cong-ty|tnhh|trach nhiem huu han|co phan|thuong mai|ho kinh doanh|hkd|mtv|cp)\b/gi,
      ' ',
    )
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim();
  const words = stripped.split(/\s+/).filter((w) => {
    if (!w) return false;
    if (/^\d+$/.test(w)) return false;
    if (/^\d{4}([-_./]\d{2}){1,2}/.test(w)) return false;
    if (/^\d{1,2}:\d{2}/.test(w)) return false;
    return true;
  });
  if (!words.length) return 'KH';
  const parts = words.map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w[0] ?? ''));
  const code = parts.join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 2) return 'KH';
  return code.slice(0, 8);
}

export function formatPttContractNo(leadId: number, brand: string, year: number): string {
  const serial = String(Math.abs(Number(leadId) || 0) % 1000).padStart(3, '0');
  const code = brandCodeFromName(brand);
  return `${serial} / ${code}-PTT / HĐDV / ${year}`;
}

const DASH = '—';

function dash(value: string | null | undefined): string {
  const t = String(value ?? '').trim();
  return t || DASH;
}

export type PttContractLine = {
  name: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  revisions: string;
  timeline: string;
};

export type PttContractPhase = {
  title: string;
  heading: string;
  scope: string;
  beforeVat: number;
  vat: number;
  afterVat: number;
  implemented: boolean;
  lines: PttContractLine[];
};

export type PttKpiRow = {
  group: string;
  metric: string;
  method: string;
  target: string;
  committed: string;
};

export type PttContractFillInput = {
  contractNo: string;
  packageSubtitle: string;
  signDay: string;
  signMonth: string;
  signYear: string;
  city: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  legalName: string;
  taxId: string;
  address: string;
  representative: string;
  representativeTitle: string;
  phone: string;
  email: string;
  brand: string;
  contactA: string;
  contactB: string;
  vatPercent: number;
  phases: [PttContractPhase, PttContractPhase, PttContractPhase];
  extrasApproved: number;
  totalBeforeVat: number;
  totalVat: number;
  totalAfterVat: number;
  amountInWordsFixed: string;
  amountInWordsMax: string;
  projectName: string;
  kpiRows: PttKpiRow[];
};

export type LeadContractPartyInput = {
  client: string;
  statusLabel?: string;
  createdLabel?: string;
  signedLabel?: string;
  amountVnd?: number;
  contractNo?: string;
  contactName?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  representativeTitle?: string;
  brand?: string;
  amName?: string;
  city?: string;
  signDate?: Date;
  startDate?: Date;
  endDate?: Date;
  durationMonths?: number;
  leadId?: number;
};

function qtyLabel(qty: number, unit: string): string {
  const q = Number(qty);
  const n = Number.isFinite(q) && q > 0 ? q : 1;
  const padded = n < 10 ? `0${Math.round(n)}` : String(Math.round(n));
  const u = String(unit ?? '').trim();
  if (!u || u === 'times' || u === 'lần' || u.toLowerCase() === 'time') return padded;
  return `${padded} ${u}`;
}

function unitPriceOf(amount: number, qty: number): number {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return amount;
  return amount / q;
}

function includedRows(group: QuoteSheetGroup | undefined): QuoteSheetRow[] {
  return (group?.rows ?? []).filter((r) => r.included && r.chargeable !== false);
}

function phaseTitleFromGroup(group: QuoteSheetGroup | undefined, fallback: string): string {
  if (!group) return fallback;
  const name = String(group.service_name || group.phase_name || '').trim();
  return name || fallback;
}

function scopeFromGroup(group: QuoteSheetGroup | undefined, giai: string, implemented: boolean): string {
  if (!implemented || !group) {
    return `${giai} — Không triển khai (Bên A chưa xác nhận).`;
  }
  const titles = includedRows(group)
    .map((r) => {
      const task = String(r.task ?? '').trim();
      const detail = String(r.subtask ?? '').trim();
      return detail && detail !== task ? `${task}: ${detail}` : task;
    })
    .filter(Boolean);
  const head = phaseTitleFromGroup(group, giai);
  const list = titles.length ? titles.join('; ') : head;
  return `${giai} — ${head} (theo khối lượng cố định): ${list}.`;
}

function linesFromGroup(
  group: QuoteSheetGroup | undefined,
  implemented: boolean,
  giaiLabel: string,
): PttContractLine[] {
  if (!implemented || !group) {
    return [
      {
        name: 'Không triển khai',
        description: 'Bên A chưa xác nhận triển khai giai đoạn này.',
        qty: DASH,
        unitPrice: DASH,
        amount: '0',
        revisions: DASH,
        timeline: DASH,
      },
    ];
  }
  const rows = includedRows(group);
  if (!rows.length) {
    return [
      {
        name: phaseTitleFromGroup(group, giaiLabel),
        description: DASH,
        qty: DASH,
        unitPrice: DASH,
        amount: '0',
        revisions: DASH,
        timeline: DASH,
      },
    ];
  }
  return rows.map((r) => ({
    name: String(r.task ?? '').trim() || phaseTitleFromGroup(group, giaiLabel),
    description: String(r.subtask ?? '').trim() || DASH,
    qty: qtyLabel(r.qty, r.unit),
    unitPrice: formatVndDots(unitPriceOf(r.amount_vnd, r.qty)),
    amount: formatVndDots(r.amount_vnd),
    revisions: DASH,
    timeline: DASH,
  }));
}

function allocatePhases(
  raw: number[],
  targetBefore: number,
  vatPercent: number,
): Array<{ beforeVat: number; vat: number; afterVat: number }> {
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0 || targetBefore <= 0) {
    return raw.map(() => ({ beforeVat: 0, vat: 0, afterVat: 0 }));
  }
  const befores = raw.map((v) => Math.round((v / sum) * targetBefore));
  let drift = targetBefore - befores.reduce((a, b) => a + b, 0);
  for (let i = befores.length - 1; i >= 0 && drift !== 0; i -= 1) {
    if (raw[i] > 0 || i === 0) {
      befores[i] += drift;
      drift = 0;
    }
  }
  return befores.map((b) => {
    const vat = Math.round(b * (vatPercent / 100));
    return { beforeVat: b, vat, afterVat: b + vat };
  });
}

const DEFAULT_MUC_TIEU: PttKpiRow[] = [
  {
    group: 'Mục tiêu',
    metric: 'Tần suất đăng',
    method: 'Lịch đăng đã duyệt',
    target: 'Theo lịch tuần',
    committed: 'Không',
  },
  {
    group: 'Mục tiêu',
    metric: 'Tiếp cận / tương tác',
    method: 'Insight kênh',
    target: 'Theo dõi tối ưu',
    committed: 'Không',
  },
  {
    group: 'Mục tiêu',
    metric: 'Lead / đơn từ nội dung',
    method: 'Form / Zalo / CRM Bên A',
    target: 'Theo dõi, không cam kết số',
    committed: 'Không',
  },
];

function kpisFromPhases(phases: PttContractPhase[]): PttKpiRow[] {
  const rows: PttKpiRow[] = [];
  for (const ph of phases) {
    if (!ph.implemented) continue;
    for (const line of ph.lines) {
      if (line.name === 'Không triển khai') continue;
      rows.push({
        group: 'Vận hành',
        metric: line.name,
        method: 'Bàn giao / email nghiệm thu',
        target: line.qty === DASH ? 'Theo Phụ lục 01' : line.qty,
        committed: 'Có',
      });
    }
  }
  if (!rows.length) {
    rows.push({
      group: 'Vận hành',
      metric: 'Deliverable theo Phụ lục 01',
      method: 'Bàn giao / email nghiệm thu',
      target: 'Theo Phụ lục 01',
      committed: 'Có',
    });
  }
  return [...rows, ...DEFAULT_MUC_TIEU];
}

function parseVi(label: string | undefined): Date | null {
  const m = String(label ?? '')
    .trim()
    .match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildPttContractFillInput(
  view: QuoteSheetView,
  input: LeadContractPartyInput,
  now = new Date(),
): PttContractFillInput {
  const legalName = String(input.client ?? '').trim() || DASH;
  const brand = String(input.brand ?? '').trim() || legalName;
  const contactA = String(input.contactName ?? '').trim() || legalName;
  const contactB = String(input.amName ?? '').trim() || 'PTT Agency';
  const sign = input.signDate ?? parseVi(input.createdLabel) ?? now;
  const start = input.startDate ?? sign;
  const months = input.durationMonths ?? 6;
  const end = input.endDate ?? addMonths(start, months);
  const year = sign.getFullYear();
  const givenNo = String(input.contractNo ?? '').trim();
  const contractNo =
    givenNo && !/^HĐ-|^HD-/i.test(givenNo)
      ? givenNo
      : formatPttContractNo(Number(input.leadId) || 0, brand, year);

  const groups = (view.groups ?? []).filter((g) => includedRows(g).length > 0);
  const g1 = groups[0];
  const g2 = groups[1];
  const rest = groups.slice(2);
  const g3: QuoteSheetGroup | undefined =
    rest.length > 1
      ? {
          ...rest[0],
          service_name: rest
            .map((g) => g.service_name)
            .filter(Boolean)
            .join(' · '),
          rows: rest.flatMap((g) => g.rows),
        }
      : rest[0];

  const raw = [g1, g2, g3].map((g) =>
    includedRows(g).reduce((s, r) => s + (Number(r.amount_vnd) || 0), 0),
  );
  const vatPercent = Number(view.vat_percent ?? 0);
  const promo = Number(view.promo_vnd ?? 0);
  const totalRaw = raw.reduce((a, b) => a + b, 0);
  const quotedBefore = Number(view.total_vnd);
  const targetBefore = Math.round(
    (Number.isFinite(quotedBefore) && quotedBefore > 0 ? quotedBefore : totalRaw) - (Number.isFinite(promo) ? promo : 0),
  );
  const allocated = allocatePhases(raw, targetBefore > 0 ? targetBefore : totalRaw, vatPercent);
  const defaultTitles = [
    'Xây dựng nền tảng và Sản xuất, vận hành',
    'Sản xuất & vận hành',
    'Sản xuất & vận hành',
  ];
  const letters = ['A', 'B', 'C'];
  const phases = ([0, 1, 2] as const).map((i) => {
    const g = [g1, g2, g3][i];
    const impl = raw[i] > 0;
    const titleBase = phaseTitleFromGroup(g, defaultTitles[i]);
    const title = `Giai đoạn ${i + 1}: ${impl ? titleBase : 'Không triển khai'}`;
    const heading = impl
      ? `${letters[i]}. GIAI ĐOẠN ${i + 1}: ${titleBase.toUpperCase()}:`
      : `${letters[i]}. GIAI ĐOẠN ${i + 1}: KHÔNG TRIỂN KHAI:`;
    return {
      title,
      heading,
      scope: scopeFromGroup(g, `Giai đoạn ${i + 1}`, impl),
      ...allocated[i],
      implemented: impl,
      lines: linesFromGroup(g, impl, `Giai đoạn ${i + 1}`),
    };
  }) as [PttContractPhase, PttContractPhase, PttContractPhase];

  let totalBefore = phases.reduce((s, p) => s + p.beforeVat, 0);
  let totalVat = phases.reduce((s, p) => s + p.vat, 0);
  let totalAfter = phases.reduce((s, p) => s + p.afterVat, 0);
  const grand = Number(input.amountVnd != null && input.amountVnd > 0 ? input.amountVnd : view.grand_total_vnd);
  if (Number.isFinite(grand) && grand >= 0 && grand !== totalAfter) {
    const idx =
      [...phases]
        .map((_, i) => i)
        .reverse()
        .find((i) => phases[i].implemented) ?? 0;
    const delta = Math.round(grand) - totalAfter;
    phases[idx].afterVat += delta;
    phases[idx].vat = phases[idx].afterVat - phases[idx].beforeVat;
    if (phases[idx].vat < 0) {
      phases[idx].beforeVat = phases[idx].afterVat;
      phases[idx].vat = 0;
    }
    totalBefore = phases.reduce((s, p) => s + p.beforeVat, 0);
    totalVat = phases.reduce((s, p) => s + p.vat, 0);
    totalAfter = phases.reduce((s, p) => s + p.afterVat, 0);
  }

  const packageParts: string[] = [];
  for (const g of groups) {
    const label = String(g.service_name || g.phase_name || '').trim();
    if (label && !packageParts.includes(label)) packageParts.push(label);
  }
  const packageSubtitle = packageParts.length
    ? `(Gói ${packageParts.join(' + ')})`
    : '(Gói dịch vụ theo báo giá đã chốt)';

  return {
    contractNo,
    packageSubtitle,
    signDay: pad2(sign.getDate()),
    signMonth: pad2(sign.getMonth() + 1),
    signYear: String(sign.getFullYear()),
    city: String(input.city ?? '').trim() || 'Thành phố Hồ Chí Minh',
    startDate: formatViDate(start),
    endDate: formatViDate(end),
    durationLabel: `${pad2(months)} tháng`,
    legalName,
    taxId: dash(input.taxId),
    address: dash(input.address),
    representative: contactA,
    representativeTitle: dash(input.representativeTitle),
    phone: dash(input.phone),
    email: dash(input.email),
    brand,
    contactA,
    contactB,
    vatPercent,
    phases,
    extrasApproved: 0,
    totalBeforeVat: totalBefore,
    totalVat,
    totalAfterVat: totalAfter,
    amountInWordsFixed: vndInWords(phases[0].afterVat),
    amountInWordsMax: vndInWords(totalAfter),
    projectName: `Marketing cho thương hiệu ${brand}`,
    kpiRows: kpisFromPhases(phases),
  };
}

function paymentSplit(afterVat: number): [number, number, number] {
  const total = Math.round(afterVat);
  const d1 = Math.round(total * 0.5);
  const d2 = Math.round(total * 0.3);
  const d3 = total - d1 - d2;
  return [d1, d2, d3];
}

function xmlSearchForm(from: string): string {
  return from.includes('&amp;') || from.includes('&lt;') ? from : escapeXml(from);
}

function replaceExact(xml: string, from: string, to: string): string {
  const src = xmlSearchForm(from);
  if (!src || !xml.includes(src)) return xml;
  return xml.split(src).join(escapeXml(to));
}

function setCellText(tc: string, text: string): string {
  let first = true;
  const escaped = escapeXml(text);
  return tc.replace(/<w:t\b([^>]*)>[^<]*<\/w:t>/g, (_m, attrs: string) => {
    const a = String(attrs ?? '');
    if (first) {
      first = false;
      const attrsOut = a.includes('xml:space') ? a : `${a} xml:space="preserve"`;
      return `<w:t${attrsOut}>${escaped}</w:t>`;
    }
    return `<w:t${a}></w:t>`;
  });
}

function setRowCells(rowXml: string, values: string[]): string {
  let i = 0;
  return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (tc) => {
    const val = values[i++];
    if (val === undefined) return tc;
    return setCellText(tc, val);
  });
}

function setRowValueByCol(rowXml: string, colIndex: number, value: string): string {
  let i = 0;
  return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (tc) => {
    const idx = i++;
    if (idx !== colIndex) return tc;
    return setCellText(tc, value);
  });
}

function tableRows(tbl: string): string[] {
  return [...tbl.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
}

function spliceRows(tbl: string, rows: string[]): string {
  const start = tbl.search(/<w:tr\b/);
  const end = tbl.lastIndexOf('</w:tr>') + '</w:tr>'.length;
  if (start < 0 || end < start) return tbl;
  return tbl.slice(0, start) + rows.join('') + tbl.slice(end);
}

function rewriteDataRows(tbl: string, headerCount: number, dataRows: string[][]): string {
  const rows = tableRows(tbl);
  if (!rows.length) return tbl;
  const headers = rows.slice(0, headerCount);
  const template = rows[headerCount] ?? rows[rows.length - 1];
  const built = dataRows.map((cells) => setRowCells(template, cells));
  return spliceRows(tbl, [...headers, ...built]);
}

function rewriteTableByRows(tbl: string, mutator: (rows: string[]) => string[]): string {
  return spliceRows(tbl, mutator(tableRows(tbl)));
}

function replaceFollowingTexts(xml: string, label: string, nexts: string[]): string {
  const escLabel = escapeXml(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<w:t\\b[^>]*>)${escLabel}(</w:t>)`);
  const m = re.exec(xml);
  if (!m) return xml;
  let pos = m.index + m[0].length;
  let result = xml.slice(0, pos);
  let rest = xml.slice(pos);
  for (const val of nexts) {
    const tm = /<w:t\b([^>]*)>[^<]*<\/w:t>/.exec(rest);
    if (!tm) break;
    const attrs = String(tm[1] ?? '');
    const attrsOut = attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`;
    const replacement = `<w:t${attrsOut}>${escapeXml(val)}</w:t>`;
    result += rest.slice(0, tm.index) + replacement;
    rest = rest.slice(tm.index + tm[0].length);
  }
  return result + rest;
}

/** Sample strings unique to anh Tuấn's filled 360 Auto Detailing deal. */
const SAMPLE = {
  subtitle: '(Gói Xây dựng nền tảng + Sản xuất & Vận hành nội dung)',
  contractNoFull: 'Số: 068 / 360AD-PTT / HĐDV / 2026',
  contractNoBare: '068 / 360AD-PTT / HĐDV / 2026',
  today: 'Hôm nay, ngày      tháng       năm 2026, tại Thành phố Hồ Chí Minh, chúng tôi gồm:',
  legalName: 'Hộ Kinh Doanh 360 Auto Detailing',
  tax: '8606482821-001',
  address: '469, Nguyễn Xiển , Phường Long Bình, Thành Phố Hồ Chí Minh',
  representative: 'Huỳnh Ngọc Tuyết Nhi',
  title: 'Chủ Hộ Kinh Doanh',
  phone: '0899888360',
  email: 'hungngo12436@gmail.com',
  brand: '360 Auto Detailing (hoặc tên khác do Bên A xác nhận bằng email)',
  gd1scope:
    'Giai đoạn 1 — Xây dựng nền tảng và sản xuất, vận hành nội dung (theo khối lượng cố định): Website Landing Page; chuẩn hóa Google Business Profile; bộ nhận diện nội dung trên kênh mạng xã hội; quay/chụp tại điểm kinh doanh; sản xuất video ngắn; bài ảnh Facebook; vận hành & báo cáo kênh.',
  gd2scope:
    'Giai đoạn 2 — Sản xuất & vận hành nội dung (theo khối lượng cố định): quay/chụp tại điểm kinh doanh; sản xuất video ngắn; bài ảnh Facebook; vận hành & báo cáo kênh.',
  gd3scope:
    'Giai đoạn 3 — Sản xuất & vận hành nội dung (theo khối lượng cố định): quay/chụp tại điểm kinh doanh; sản xuất video ngắn; bài ảnh Facebook; vận hành & báo cáo kênh.',
  term: 'từ ngày 23/09/2026 đến hết ngày 23/03/2027 (06 tháng), trừ khi Các Bên gia hạn bằng Phụ lục.',
  effective: 'Hợp đồng có hiệu lực kể từ ngày ký hoặc từ ngày 23/09/2026, tùy ngày nào đến sau.',
  bangChu:
    'Bằng chữ: Giá trị cố định (Giai đoạn 1): Hai mươi chín triệu năm trăm bốn mươi tám nghìn tám trăm đồng chẵn. Giá trị tối đa khi triển khai đủ Giai đoạn 1 và cả Giai đoạn 2, Giai đoạn 3: Bảy mươi lăm triệu sáu tám mươi sáu ngàn bốn trăm đồng (đã bao gồm VAT 8%).',
  signA: 'Họ tên: Huỳnh Ngọc Tuyết Nhi',
  signATitle: 'Chức danh: Chủ hộ Kinh doanh',
  signAEmail: 'Email xác nhận: hungngo12436@gmail.com',
  signAApp: 'Họ tên: Huỳnh Ngọc Tuyết Nhi - Chủ Hộ Kinh Doanh',
  project: 'Marketing nền tảng & nội dung cho thương hiệu 360 Auto Detailing',
  headingA: 'A. GIAI ĐOẠN 1: XÂY DỰNG NỀN TẢNG VÀ SẢN XUẤT, VẬN HÀNH:',
  headingB: 'B. GIAI ĐOẠN 2: SẢN XUẤT & VẬN HÀNH:',
  headingC: 'C. GIAI ĐOẠN 3: SẢN XUẤT & VẬN HÀNH:',
};

export async function fillPttMarketingContract(
  template: Buffer,
  data: PttContractFillInput,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('Mẫu hợp đồng thiếu word/document.xml');
  let xml = await file.async('string');

  const today = `Hôm nay, ngày ${data.signDay} tháng ${data.signMonth} năm ${data.signYear}, tại ${data.city}, chúng tôi gồm:`;
  const term = `từ ngày ${data.startDate} đến hết ngày ${data.endDate} (${data.durationLabel}), trừ khi Các Bên gia hạn bằng Phụ lục.`;
  const effective = `Hợp đồng có hiệu lực kể từ ngày ký hoặc từ ngày ${data.startDate}, tùy ngày nào đến sau.`;
  const bangChu = `Bằng chữ: Giá trị cố định (Giai đoạn 1): ${data.amountInWordsFixed}. Giá trị tối đa khi triển khai đủ Giai đoạn 1 và cả Giai đoạn 2, Giai đoạn 3: ${data.amountInWordsMax} (đã bao gồm VAT ${data.vatPercent}%).`;
  const signDate = `Ngày: ${data.signDay} / ${data.signMonth} / ${data.signYear}`;
  const titleA =
    data.representativeTitle === DASH ? `Chức danh: ${DASH}` : `Chức danh: ${data.representativeTitle}`;
  const appendixName =
    data.representativeTitle !== DASH
      ? `Họ tên: ${data.representative} - ${data.representativeTitle}`
      : `Họ tên: ${data.representative}`;

  // Longer unique phrases first so shorter substrings remain findable.
  xml = replaceExact(xml, SAMPLE.contractNoFull, `Số: ${data.contractNo}`);
  xml = replaceExact(xml, SAMPLE.contractNoBare, data.contractNo);
  xml = replaceExact(xml, SAMPLE.subtitle, data.packageSubtitle);
  xml = replaceExact(xml, SAMPLE.today, today);
  xml = replaceExact(xml, SAMPLE.signAApp, appendixName);
  xml = replaceExact(xml, SAMPLE.signA, `Họ tên: ${data.representative}`);
  xml = replaceExact(xml, SAMPLE.signATitle, titleA);
  xml = replaceExact(xml, SAMPLE.signAEmail, `Email xác nhận: ${data.email === DASH ? DASH : data.email}`);
  xml = replaceExact(xml, SAMPLE.brand, data.brand);
  xml = replaceExact(xml, SAMPLE.legalName, data.legalName);
  xml = replaceExact(xml, SAMPLE.tax, data.taxId);
  xml = replaceExact(xml, SAMPLE.address, data.address);
  xml = replaceExact(xml, SAMPLE.representative, data.representative);
  xml = replaceExact(xml, SAMPLE.title, data.representativeTitle);
  xml = replaceExact(xml, SAMPLE.phone, data.phone);
  xml = replaceExact(xml, SAMPLE.email, data.email);
  xml = replaceExact(xml, SAMPLE.gd1scope, data.phases[0].scope);
  xml = replaceExact(xml, SAMPLE.gd2scope, data.phases[1].scope);
  xml = replaceExact(xml, SAMPLE.gd3scope, data.phases[2].scope);
  // Điều 2.1 is split across several w:t runs in the template (GD1/GD2).
  // Replace unique fragments after the standalone "Giai đoạn N" runs; clear leftovers.
  const gd2Rest = ' — Sản xuất & vận hành nội dung (theo khối lượng cố định): quay/chụp tại điểm kinh doanh; sản xuất video ngắn; bài ảnh Facebook; vận hành & báo cáo kênh.';
  xml = replaceExact(xml, gd2Rest, data.phases[1].scope.replace(/^Giai đoạn 2/, ''));
  xml = replaceExact(xml, ' — Xây dựng nền tảng ', data.phases[0].scope.replace(/^Giai đoạn 1/, ''));
  xml = replaceExact(xml, 'và sản xuất, vận hành nội dung (theo khối lượng cố định)', '');
  xml = replaceExact(xml, ': Website Landing Page; chuẩn hóa Google Business Profile; bộ nhận diện nội dung trên kênh mạng xã hội', '');
  xml = replaceExact(xml, '; quay/chụp tại điểm kinh doanh; sản xuất video ngắn; bài ảnh Facebook; vận hành & báo cáo kênh.', '');
  xml = replaceExact(xml, SAMPLE.term, term);
  xml = replaceExact(xml, SAMPLE.effective, effective);
  xml = replaceExact(xml, SAMPLE.bangChu, bangChu);
  xml = replaceExact(xml, SAMPLE.project, data.projectName);
  xml = replaceExact(xml, SAMPLE.headingA, data.phases[0].heading);
  xml = replaceExact(xml, SAMPLE.headingB, data.phases[1].heading);
  xml = replaceExact(xml, SAMPLE.headingC, data.phases[2].heading);
  xml = replaceExact(xml, 'Ngày:      /      / 2026', signDate);
  xml = replaceExact(xml, 'Ngày:    /      / 2026', signDate);
  xml = replaceExact(xml, 'Ngày:     /       / 2026', signDate);

  if (data.vatPercent !== 8) {
    xml = xml.split('VAT 8%').join(`VAT ${data.vatPercent}%`);
  }

  let tblIdx = 0;
  xml = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const idx = tblIdx++;
    if (idx === 1 || idx === 4) return tbl;
    if (idx === 0) {
      const values = [
        data.legalName,
        data.taxId,
        data.address,
        data.representative,
        data.representativeTitle,
        data.phone,
        data.email,
        data.brand,
      ];
      return rewriteTableByRows(tbl, (rows) =>
        rows.map((row, ri) => (ri === 0 ? row : setRowValueByCol(row, 1, values[ri - 1] ?? ''))),
      );
    }
    if (idx === 2) {
      return rewriteTableByRows(tbl, (rows) =>
        rows.map((row, ri) => {
          if (ri === 0) return row;
          return setRowValueByCol(setRowValueByCol(row, 1, data.contactA), 2, data.contactB);
        }),
      );
    }
    if (idx === 3) {
      const extrasVat = Math.round(data.extrasApproved * (data.vatPercent / 100));
      const money = [
        [
          data.phases[0].title,
          formatVndDots(data.phases[0].beforeVat),
          formatVndDots(data.phases[0].vat),
          formatVndDots(data.phases[0].afterVat),
        ],
        [
          data.phases[1].title,
          formatVndDots(data.phases[1].beforeVat),
          formatVndDots(data.phases[1].vat),
          formatVndDots(data.phases[1].afterVat),
        ],
        [
          data.phases[2].title,
          formatVndDots(data.phases[2].beforeVat),
          formatVndDots(data.phases[2].vat),
          formatVndDots(data.phases[2].afterVat),
        ],
        [
          'Phí phát sinh đã được phê duyệt',
          formatVndDots(data.extrasApproved),
          formatVndDots(extrasVat),
          formatVndDots(data.extrasApproved + extrasVat),
        ],
        [
          'TỔNG GIÁ TRỊ HỢP ĐỒNG',
          formatVndDots(data.totalBeforeVat),
          formatVndDots(data.totalVat),
          formatVndDots(data.totalAfterVat),
        ],
      ];
      return rewriteTableByRows(tbl, (rows) =>
        rows.map((row, ri) => {
          if (ri === 0) return row.replace(/>VAT 8%</g, `>VAT ${data.vatPercent}%<`);
          return setRowCells(row, money[ri - 1] ?? []);
        }),
      );
    }
    if (idx === 5) {
      const rowsMoney = data.phases.map((p, i) => {
        const [a, b, c] = paymentSplit(p.afterVat);
        const label = i === 0 ? 'Giai đoạn 1' : `Giai đoạn ${i + 1} (nếu triển khai)`;
        return [label, formatVndDots(a), formatVndDots(b), formatVndDots(c), formatVndDots(p.afterVat)];
      });
      return rewriteTableByRows(tbl, (rows) =>
        rows.map((row, ri) => (ri === 0 ? row : setRowCells(row, rowsMoney[ri - 1] ?? []))),
      );
    }
    if (idx === 7 || idx === 8 || idx === 9) {
      const phase = data.phases[idx - 7];
      const lines = phase.lines.map((l) => [
        l.name,
        l.description,
        l.qty,
        l.unitPrice,
        l.amount,
        l.revisions,
        l.timeline,
      ]);
      return rewriteDataRows(tbl, 1, lines);
    }
    if (idx === 11) {
      const kpis = data.kpiRows.map((k) => [k.group, k.metric, k.method, k.target, k.committed]);
      return rewriteDataRows(tbl, 1, kpis);
    }
    return tbl;
  });

  for (let i = 0; i < 3; i += 1) {
    const p = data.phases[i];
    xml = replaceFollowingTexts(xml, `Tổng Giai đoạn ${i + 1} trước VAT: `, [
      `${formatVndDots(p.beforeVat)}  ·  `,
      `VAT ${data.vatPercent}%: `,
      `${formatVndDots(p.vat)}  ·  `,
      `Tổng sau VAT: ${formatVndDots(p.afterVat)} đồng`,
    ]);
  }

  zip.file('word/document.xml', xml);
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
