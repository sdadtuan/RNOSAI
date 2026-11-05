export type QuoteMoneyLine = {
  itemType: string;
  netVnd: bigint;
};

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return numerator >= 0n
    ? (numerator + denominator / 2n) / denominator
    : (numerator - denominator / 2n) / denominator;
}

export function calcPayable(input: {
  feeVnd: bigint;
  mediaVnd: bigint;
  discountVnd: bigint;
  vatBps: number;
}): { taxVnd: bigint; payableVnd: bigint } {
  const taxable = input.feeVnd + input.mediaVnd - input.discountVnd;
  const base = taxable < 0n ? 0n : taxable;
  const taxVnd = roundDiv(base * BigInt(input.vatBps), 10000n);
  return { taxVnd, payableVnd: base + taxVnd };
}

export function calcNsr(lines: QuoteMoneyLine[]): bigint {
  return lines.reduce((sum, line) => {
    if (line.itemType !== 'fee') return sum;
    return sum + line.netVnd;
  }, 0n);
}

export function calcGmBps(nsrVnd: bigint, directCostVnd: bigint): number | null {
  if (nsrVnd === 0n) return null;
  return Number(roundDiv((nsrVnd - directCostVnd) * 10000n, nsrVnd));
}

export function allocatePayment(payableVnd: bigint, pctBps: number[]): bigint[] {
  if (!pctBps.length) return [];
  const amounts: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < pctBps.length; i += 1) {
    if (i === pctBps.length - 1) {
      amounts.push(payableVnd - allocated);
      continue;
    }
    const amt = (payableVnd * BigInt(pctBps[i])) / 10000n;
    amounts.push(amt);
    allocated += amt;
  }
  return amounts;
}
