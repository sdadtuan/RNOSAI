import { isAccountManagerPosition } from '../b2b-projects/b2b-director.util';

export type DefaultCanReceiveSolutionInput = {
  positionCode: string | null | undefined;
  /** When set, wins over position-based default (explicit tick or untick). */
  explicit?: boolean | null;
};

/** Default Nhận Solution: AM positions ticked; explicit body value always respected. */
export function defaultCanReceiveSolution(input: DefaultCanReceiveSolutionInput): boolean {
  if (typeof input.explicit === 'boolean') return input.explicit;
  return isAccountManagerPosition(input.positionCode);
}