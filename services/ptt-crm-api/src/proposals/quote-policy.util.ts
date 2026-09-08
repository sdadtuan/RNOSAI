export type QuotePolicySettings = {
  gm_floor_bps: number;
  discount_auto_bps: number;
  director_value_vnd: number;
  payment_term_max_days: number;
};

export type QuotePolicyTotals = {
  fee_vnd: number | bigint;
  discount_vnd: number | bigint;
  payable_vnd: number | bigint;
  gm_bps: number | null;
};

export type QuotePolicyFlags = {
  payment_term_days?: number | null;
  clause_diverged?: boolean;
  has_custom?: boolean;
  has_zero_price?: boolean;
  cost_missing?: boolean;
};

export type QuotePolicyStep = {
  section: QuoteApproverSection;
  trigger: string;
  triggers: string[];
};

export const QUOTE_APPROVER_SECTIONS = [
  'Sales Manager',
  'AM Lead',
  'AD',
  'Finance',
  'GDKD',
  'Legal',
] as const;

export type QuoteApproverSection = (typeof QUOTE_APPROVER_SECTIONS)[number];

/** Mid-band ceiling in the §9.2 table (5–10%). Auto cap comes from settings. */
export const DISCOUNT_MID_MAX_BPS = 1000;

function asBigInt(value: number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.round(value));
}

function asNum(value: number | bigint): number {
  if (typeof value === 'bigint') return Number(value);
  return Number.isFinite(value) ? value : 0;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return numerator >= 0n
    ? (numerator + denominator / 2n) / denominator
    : (numerator - denominator / 2n) / denominator;
}

/** Discount bps from version totals (fee/discount), never from a single line. */
export function discountBpsFromTotals(
  feeVnd: number | bigint,
  discountVnd: number | bigint,
): number {
  const fee = asBigInt(feeVnd);
  const discount = asBigInt(discountVnd);
  if (fee <= 0n) return 0;
  return Number(roundDiv(discount * 10000n, fee));
}

function addTrigger(
  map: Map<QuoteApproverSection, string[]>,
  section: QuoteApproverSection,
  trigger: string,
): void {
  const current = map.get(section) ?? [];
  if (!current.includes(trigger)) current.push(trigger);
  map.set(section, current);
}

export function evaluateQuotePolicy(
  settings: QuotePolicySettings,
  totals: QuotePolicyTotals,
  flags: QuotePolicyFlags = {},
): QuotePolicyStep[] {
  const discountBps = discountBpsFromTotals(totals.fee_vnd, totals.discount_vnd);
  const gmBps = totals.gm_bps;
  const payable = asNum(totals.payable_vnd);
  const gmOk = gmBps != null && gmBps >= settings.gm_floor_bps;
  const gmLow = gmBps != null && gmBps < settings.gm_floor_bps;
  const hits = new Map<QuoteApproverSection, string[]>();

  if (discountBps <= settings.discount_auto_bps && gmOk) {
    addTrigger(hits, 'Sales Manager', 'discount_auto');
  }
  if (discountBps > settings.discount_auto_bps && discountBps <= DISCOUNT_MID_MAX_BPS) {
    addTrigger(hits, 'AM Lead', 'discount_mid');
    addTrigger(hits, 'AD', 'discount_mid');
  }
  if (discountBps > DISCOUNT_MID_MAX_BPS) {
    addTrigger(hits, 'AD', 'discount_high');
    addTrigger(hits, 'Finance', 'discount_high');
  }
  if (gmLow) {
    addTrigger(hits, 'Finance', 'gm_floor');
    addTrigger(hits, 'GDKD', 'gm_floor');
  }
  if (payable > settings.director_value_vnd) {
    addTrigger(hits, 'GDKD', 'director_value');
  }
  if (flags.payment_term_days != null && flags.payment_term_days > settings.payment_term_max_days) {
    addTrigger(hits, 'Finance', 'payment_term');
  }
  if (flags.clause_diverged) {
    addTrigger(hits, 'Legal', 'clause_diverged');
  }
  if (flags.has_custom || flags.has_zero_price || flags.cost_missing) {
    addTrigger(hits, 'Finance', 'custom_or_cost');
  }

  return QUOTE_APPROVER_SECTIONS.filter((section) => hits.has(section)).map((section) => {
    const triggers = hits.get(section) ?? [];
    return { section, trigger: triggers[0] ?? section, triggers };
  });
}
