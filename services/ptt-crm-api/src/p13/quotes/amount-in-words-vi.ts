const DIGIT = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const;
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'] as const;

function readGroup(value: number, forceHundreds: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  const parts: string[] = [];
  if (hundreds > 0 || forceHundreds) parts.push(`${DIGIT[hundreds]} trăm`);
  if (tens > 1) {
    parts.push(`${DIGIT[tens]} mươi`);
    if (ones === 1) parts.push('mốt');
    else if (ones === 4) parts.push('tư');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGIT[ones]);
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGIT[ones]);
  } else if (ones > 0) {
    if (hundreds > 0 || forceHundreds) parts.push('linh');
    parts.push(DIGIT[ones]);
  }
  return parts.join(' ');
}

/** Integer dong, Vietnamese, "linh", first letter capitalised. */
export function amountInWordsVi(amount: string | number): string {
  const digits = String(amount).replace(/[^\d]/g, '');
  if (!digits || /^0+$/.test(digits)) return 'Không đồng';
  const groups: number[] = [];
  let rest = digits.replace(/^0+/, '');
  while (rest.length) {
    const take = rest.length > 3 ? rest.slice(rest.length - 3) : rest;
    groups.push(Number(take));
    rest = rest.length > 3 ? rest.slice(0, rest.length - 3) : '';
  }
  const spoken: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index] ?? 0;
    if (!group) continue;
    const higher = groups.slice(index + 1).some((item) => item > 0);
    const text = readGroup(group, higher && group < 100);
    const scale = SCALES[index] ?? '';
    spoken.push(scale ? `${text} ${scale}` : text);
  }
  const sentence = `${spoken.join(' ')} đồng`.replace(/\s+/g, ' ').trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
