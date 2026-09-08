export type QuoteVersionDiff = {
  path: string;
  from: unknown;
  to: unknown;
  critical: boolean;
};

export type QuoteCompareLine = {
  qty?: number;
  unit_price_vnd?: number;
  final_price_vnd?: number;
  discount_vnd?: number;
  tax_vnd?: number;
  cost_labor_vnd?: number | null;
  cost_outsource_vnd?: number | null;
  cost_other_vnd?: number | null;
  scope_notes?: string;
};

export type QuoteCompareKpi = {
  name?: string;
  value_text?: string;
  client_visible?: boolean;
};

export type QuoteComparePayment = {
  seq?: number;
  pct_bps?: number;
  amount_vnd?: number;
  milestone?: string;
};

export type QuoteCompareClause = {
  template_key?: string;
  body?: string;
};

export type QuoteCompareSnapshot = {
  title?: string;
  lines?: QuoteCompareLine[];
  discount_vnd?: number;
  tax_vnd?: number;
  kpis?: QuoteCompareKpi[];
  payments?: QuoteComparePayment[];
  clauses?: QuoteCompareClause[];
};

const LINE_FIELDS: Array<{ key: keyof QuoteCompareLine; critical: boolean }> = [
  { key: 'qty', critical: true },
  { key: 'unit_price_vnd', critical: true },
  { key: 'final_price_vnd', critical: true },
  { key: 'discount_vnd', critical: true },
  { key: 'tax_vnd', critical: true },
  { key: 'cost_labor_vnd', critical: true },
  { key: 'cost_outsource_vnd', critical: true },
  { key: 'cost_other_vnd', critical: true },
  { key: 'scope_notes', critical: true },
];

const PAYMENT_FIELDS: Array<{ key: keyof QuoteComparePayment; critical: boolean }> = [
  { key: 'pct_bps', critical: true },
  { key: 'amount_vnd', critical: true },
  { key: 'milestone', critical: true },
];

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function push(
  out: QuoteVersionDiff[],
  path: string,
  from: unknown,
  to: unknown,
  critical: boolean,
): void {
  if (same(from, to)) return;
  out.push({ path, from: from ?? null, to: to ?? null, critical });
}

export function diffQuoteVersions(
  from: QuoteCompareSnapshot,
  to: QuoteCompareSnapshot,
): QuoteVersionDiff[] {
  const out: QuoteVersionDiff[] = [];
  push(out, 'title', from.title, to.title, false);
  push(out, 'discount_vnd', from.discount_vnd, to.discount_vnd, true);
  push(out, 'tax_vnd', from.tax_vnd, to.tax_vnd, true);

  const fromLines = from.lines ?? [];
  const toLines = to.lines ?? [];
  const lineCount = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < lineCount; i += 1) {
    const left = fromLines[i] ?? {};
    const right = toLines[i] ?? {};
    for (const field of LINE_FIELDS) {
      push(out, `lines[${i}].${field.key}`, left[field.key], right[field.key], field.critical);
    }
  }

  const fromKpis = from.kpis ?? [];
  const toKpis = to.kpis ?? [];
  const kpiCount = Math.max(fromKpis.length, toKpis.length);
  for (let i = 0; i < kpiCount; i += 1) {
    const left = fromKpis[i] ?? {};
    const right = toKpis[i] ?? {};
    const visible = left.client_visible !== false && right.client_visible !== false;
    push(out, `kpis[${i}].name`, left.name, right.name, visible);
    push(out, `kpis[${i}].value_text`, left.value_text, right.value_text, visible);
  }

  const fromPays = from.payments ?? [];
  const toPays = to.payments ?? [];
  const payCount = Math.max(fromPays.length, toPays.length);
  for (let i = 0; i < payCount; i += 1) {
    const left = fromPays[i] ?? {};
    const right = toPays[i] ?? {};
    for (const field of PAYMENT_FIELDS) {
      push(out, `payments[${i}].${field.key}`, left[field.key], right[field.key], field.critical);
    }
  }

  const fromClauses = from.clauses ?? [];
  const toClauses = to.clauses ?? [];
  const clauseCount = Math.max(fromClauses.length, toClauses.length);
  for (let i = 0; i < clauseCount; i += 1) {
    const left = fromClauses[i] ?? {};
    const right = toClauses[i] ?? {};
    push(out, `clauses[${i}].template_key`, left.template_key, right.template_key, true);
    push(out, `clauses[${i}].body`, left.body, right.body, true);
  }

  return out;
}
