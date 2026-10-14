/** Lead roles that still belong to the teams being saved. */
export function membershipLeadIds(
  teamIds: number[],
  requested: number[] | undefined,
  existing: number[] = [],
): number[] {
  const allow = new Set(teamIds.filter((id) => Number.isFinite(id) && id > 0));
  const source = requested ?? existing;
  return [...new Set(source.map(Number).filter((id) => allow.has(id)))];
}
