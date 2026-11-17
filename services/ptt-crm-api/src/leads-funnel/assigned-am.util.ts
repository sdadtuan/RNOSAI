/** assigned_am is only a real AM when it is set and is not the Sales owner. */
export function effectiveAssignedAmId(assignedAm: unknown, salesOwnerId?: unknown): number | null {
  const am = Number(assignedAm);
  if (!Number.isFinite(am) || am <= 0) return null;
  const sales = Number(salesOwnerId);
  if (Number.isFinite(sales) && sales > 0 && am === sales) return null;
  return am;
}

/** True when assigned_am should be replaced (unset, or still pointing at the Sales owner). */
export function assignedAmShouldReplace(assignedAm: unknown, salesOwnerId?: unknown): boolean {
  return effectiveAssignedAmId(assignedAm, salesOwnerId) == null;
}
