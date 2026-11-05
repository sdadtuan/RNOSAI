export const B2B_DIRECTOR_POSITION_CODES = new Set(['gdkd-01']);

export function isB2bDirectorPosition(positionCode: string | null | undefined): boolean {
  if (!positionCode) return false;
  return B2B_DIRECTOR_POSITION_CODES.has(String(positionCode).trim().toLowerCase());
}

/** Account Manager desk. KD-01 is the handover alias of ACM. */
export function isAccountManagerPosition(positionCode: string | null | undefined): boolean {
  const code = String(positionCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return code === 'acm' || code === 'kd-01' || code === 'kd01';
}

/** Marketing Leader desk. mkt-01 is the older position code. */
export function isMarketingLeaderPosition(positionCode: string | null | undefined): boolean {
  const code = String(positionCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return code === 'mkl' || code === 'mkt-01' || code === 'mkt01';
}
