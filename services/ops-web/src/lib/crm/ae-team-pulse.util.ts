export function deskPulseKey(input: {
  breaches: Array<{ staffId: number; slaBreach: number }>;
  interventionIds: number[];
}): string {
  const breaches = [...input.breaches].sort((a, b) => a.staffId - b.staffId).map((row) => `${row.staffId}:${row.slaBreach}`);
  const leads = [...input.interventionIds].sort((a, b) => a - b);
  return `${breaches.join(',')}|${leads.join(',')}`;
}

export function deskPulseUnchanged(previous: string, next: string): boolean {
  return previous !== '' && previous === next;
}
