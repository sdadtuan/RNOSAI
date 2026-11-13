/** Tiny CSV parser (quoted fields, comma or semicolon, BOM-safe). */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsv(raw);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = guessDelim(lines[0]);
  const headers = parseLine(lines[0], delim).map(normalizeHeader);
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = parseLine(line, delim);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return { headers, rows };
}

function guessDelim(header: string): string {
  const commas = (header.match(/,/g) || []).length;
  const semis = (header.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function splitCsv(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
    } else if (ch === '\n' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function stripVn(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
}

function normalizeHeader(h: string): string {
  const s = stripVn(h.trim().toLowerCase()).replace(/\s+/g, '_').replace(/[^\w]/g, '_');
  const aliases: Record<string, string> = {
    ten: 'name',
    ten_san_pham: 'name',
    product: 'name',
    product_name: 'name',
    ma_sku: 'sku',
    ma: 'sku',
    ma_vach: 'barcode',
    danh_muc: 'category',
    category_name: 'category',
    gia: 'price',
    gia_ban: 'price',
    price_vnd: 'price',
    gia_goc: 'compare_at',
    gia_so_sanh: 'compare_at',
    compare_at_price: 'compare_at',
    gia_von: 'cost',
    cost_vnd: 'cost',
    can_nang: 'weight_gram',
    weight: 'weight_gram',
    mau: 'color',
    mau_sac: 'color',
    kich_thuoc: 'size',
    ton: 'stock',
    ton_kho: 'stock',
    so_luong: 'stock',
    anh: 'image_url',
    image: 'image_url',
    hinh: 'image_url',
    mo_ta: 'detail',
    hoat_dong: 'active',
    ma_van_don: 'tracking_code',
    tracking: 'tracking_code',
    ma_don: 'order_code',
    order_code: 'order_code',
    cod: 'actual_cod',
    tien_cod: 'actual_cod',
    thu_ho: 'actual_cod',
    phi: 'fee',
    phi_van_chuyen: 'fee',
    thuc_nhan: 'payout',
    payout: 'payout',
    tien_chi: 'payout',
  };
  return aliases[s] || s;
}

export function csvMoney(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function csvBool(v: string | undefined, fallback = true): boolean {
  if (v == null || v === '') return fallback;
  const s = v.trim().toLowerCase();
  return !['0', 'false', 'no', 'n', 'ẩn', 'an', 'inactive', 'ngung'].includes(s);
}
