export type SatisfiedByteRange = {
  start: number;
  end: number;
  status: 200 | 206;
};

export function parseByteRange(
  header: string | undefined,
  size: number,
): SatisfiedByteRange | 'unsatisfiable' {
  if (!Number.isInteger(size) || size <= 0) return 'unsatisfiable';
  const raw = String(header ?? '').trim();
  if (!raw) return { start: 0, end: size - 1, status: 200 };
  if (!raw.toLowerCase().startsWith('bytes=')) return 'unsatisfiable';
  const spec = raw.slice(6).split(',')[0]?.trim() ?? '';
  const dash = spec.indexOf('-');
  if (dash < 0) return 'unsatisfiable';
  const left = spec.slice(0, dash);
  const right = spec.slice(dash + 1);
  if (left === '' && right !== '') {
    const suffix = Number(right);
    if (!Number.isInteger(suffix) || suffix <= 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1, status: 206 };
  }
  const start = Number(left);
  const end = right === '' ? size - 1 : Number(right);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return 'unsatisfiable';
  }
  return { start, end: Math.min(end, size - 1), status: 206 };
}
