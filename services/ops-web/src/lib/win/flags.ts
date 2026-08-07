/** WIN program feature flags (see competitive-win-implementation-plan §12.2). */

export function winPwaEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_WIN_PWA === '0') return false;
  if (process.env.NEXT_PUBLIC_PWA_ENABLED === '0') return false;
  return true;
}

export function winOrgUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_ORG_UI === '1';
}

export function winKpiSolutionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_KPI_SOLUTION === '1';
}
