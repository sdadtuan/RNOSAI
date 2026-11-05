import { UnprocessableEntityException } from '@nestjs/common';

export const MARGIN_FLOOR_BPS = 2400;
export const MARGIN_BLOCK_BPS = 1800;

export function computeWaterfall(input: {
  grossSell: number;
  discount: number;
  mediaCost: number;
  makeGoodCost: number;
  rebateAccrued: number;
  serviceCost: number;
}): { net: number; contribution: number; contributionBps: number } {
  const net = input.grossSell - input.discount;
  const contribution =
    net - input.mediaCost - input.makeGoodCost - input.serviceCost;
  const contributionBps = net > 0 ? Math.round((contribution / net) * 10_000) : 0;
  return { net, contribution, contributionBps };
}

export function assertMarginSubmit(contributionBps: number, isAdmin: boolean): void {
  if (contributionBps < MARGIN_BLOCK_BPS) {
    throw new UnprocessableEntityException({ error: 'margin_blocked' });
  }
  if (contributionBps < MARGIN_FLOOR_BPS && !isAdmin) {
    throw new UnprocessableEntityException({ error: 'margin_needs_director' });
  }
}
