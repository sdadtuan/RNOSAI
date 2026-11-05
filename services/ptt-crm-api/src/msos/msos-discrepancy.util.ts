import { UnprocessableEntityException } from '@nestjs/common';

export function classifyDiscrepancy(
  ioQty: number,
  reportQty: number | null,
  toleranceBps: number,
): { bps: number | null; material: boolean } {
  if (reportQty == null) {
    return { bps: null, material: false };
  }
  const diff = Math.abs(ioQty - reportQty);
  const bps = ioQty > 0 ? Math.round((diff / ioQty) * 10000) : null;
  const material = bps != null && bps > toleranceBps;
  return { bps, material };
}

export function assertNotSilentActual(
  planQty: number,
  actualQty: number,
  reportQty: number | null,
): void {
  if (reportQty != null && reportQty < planQty && actualQty === planQty) {
    throw new UnprocessableEntityException({ error: 'actual_eq_plan_forbidden' });
  }
}
