export const EVIDENCE_SLA_HOURS = 24;

export function isFresh(capturedAt: Date, now: Date, slaHours = EVIDENCE_SLA_HOURS): boolean {
  const ageMs = now.getTime() - capturedAt.getTime();
  return ageMs <= slaHours * 60 * 60 * 1000;
}

export function canOfficial(
  items: { hash?: string | null; capturedAt: Date; source: string }[],
  now: Date,
): boolean {
  return items.some(
    (item) =>
      Boolean(item.hash?.trim()) &&
      Boolean(item.source?.trim()) &&
      isFresh(item.capturedAt, now),
  );
}
