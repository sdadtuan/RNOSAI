function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function formatContentRequestCode(d: Date, seq: number): string {
  return `CR-${ymd(d)}-${String(seq).padStart(3, '0')}`;
}

export function formatContentItemCode(d: Date, seq: number): string {
  return `CNT-${ymd(d)}-${String(seq).padStart(3, '0')}`;
}

export type RequestCompletenessInput = {
  client: string;
  brand: string;
  deliverable: string;
  objective: string;
  due: string;
  source: string;
};

export function requestCompleteness(f: RequestCompletenessInput): number {
  const keys: (keyof RequestCompletenessInput)[] = [
    'client', 'brand', 'deliverable', 'objective', 'due', 'source',
  ];
  const done = keys.filter((k) => String(f[k] ?? '').trim().length > 0).length;
  return Math.round((done / keys.length) * 100);
}
