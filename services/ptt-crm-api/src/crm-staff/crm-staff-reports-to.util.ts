/** Walk reports_to edges; true when assigning managerId would create a cycle with staffId. */
export function reportsToWouldCycle(
  staffId: number,
  managerId: number | null,
  edges: Map<number, number | null>,
): boolean {
  if (managerId == null) return false;
  if (managerId === staffId) return true;
  let cur: number | null = managerId;
  const seen = new Set<number>();
  while (cur != null) {
    if (cur === staffId) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = edges.has(cur) ? edges.get(cur)! : null;
  }
  return false;
}
