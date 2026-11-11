import {
  isAccountManagerPosition,
  isMarketingLeaderPosition,
} from '../b2b-projects/b2b-director.util';
import { holdsQuoteDesk, type QuoteDesk } from './quote-case.util';

export function holdsSolutionDesk(positionCode: string | null | undefined): boolean {
  return isAccountManagerPosition(positionCode);
}

/** In-flight Solution/Quote owner who is still MKL may finish their case. */
export function grandfatheredMarketingLeaderOwner(positionCode: string | null | undefined): boolean {
  return isMarketingLeaderPosition(positionCode);
}

export function canClaimSolutionCase(
  positionCode: string | null | undefined,
  opts: { asSuperAdmin?: boolean; gdkdAssign?: boolean; canReceiveSolution?: boolean } = {},
): boolean {
  if (opts.asSuperAdmin || opts.gdkdAssign || opts.canReceiveSolution) return true;
  return holdsSolutionDesk(positionCode);
}

export function canMutateQuoteDesk(
  desk: QuoteDesk | null,
  positionCode: string | null | undefined,
  row: { position_code?: string | null; job_title?: string | null; job_function?: string | null },
  opts: {
    asSuperAdmin?: boolean;
    isAssignee?: boolean;
    isSolutionOwner?: boolean;
  } = {},
): boolean {
  if (opts.asSuperAdmin) return true;
  if (!desk) return false;
  if (desk === 'sale') {
    return holdsQuoteDesk('sale', row);
  }
  if (holdsQuoteDesk('am', row)) return true;
  return Boolean(
    (opts.isAssignee || opts.isSolutionOwner) && grandfatheredMarketingLeaderOwner(positionCode),
  );
}
