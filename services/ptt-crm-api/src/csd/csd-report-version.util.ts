export type CsdReportVersionBump = 'minor' | 'major';

export function bumpReportVersion(current: string, kind: CsdReportVersionBump): string {
  const match = /^v(\d+)\.(\d+)$/.exec(current);
  if (!match) return 'v2.0';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (kind === 'minor') {
    return `v${major}.${minor + 1}`;
  }
  return `v${major + 1}.0`;
}
