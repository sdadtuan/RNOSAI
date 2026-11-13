/** Vietnamese number-to-words for contract "Bằng chữ" amounts. */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readTriple(n: number, announceZeroHundred: boolean): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const ten = Math.floor(rest / 10);
  const unit = rest % 10;
  const parts: string[] = [];
  if (hundred > 0) {
    parts.push(`${DIGITS[hundred]} trăm`);
  } else if (announceZeroHundred && rest > 0) {
    parts.push('không trăm');
  }
  if (ten > 1) {
    parts.push(`${DIGITS[ten]} mươi`);
    if (unit === 1) parts.push('mốt');
    else if (unit === 4) parts.push('tư');
    else if (unit === 5) parts.push('lăm');
    else if (unit > 0) parts.push(DIGITS[unit]);
  } else if (ten === 1) {
    parts.push('mười');
    if (unit === 5) parts.push('lăm');
    else if (unit > 0) parts.push(DIGITS[unit]);
  } else if (unit > 0) {
    if (hundred > 0 || announceZeroHundred) parts.push('linh');
    parts.push(DIGITS[unit]);
  }
  return parts.join(' ');
}

export function vndInWords(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  if (rounded === 0) return 'Không đồng';
  const negative = rounded < 0;
  let remaining = Math.abs(rounded);
  const groups: number[] = [];
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const announce = i < groups.length - 1;
    const words = readTriple(g, announce);
    const scale = SCALES[i] ?? '';
    parts.push(scale ? `${words} ${scale}` : words);
  }
  const raw = parts.join(' ').replace(/\s+/g, ' ').trim();
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  const body = `${capitalized} đồng chẵn`;
  return negative ? `Âm ${body}` : body;
}
