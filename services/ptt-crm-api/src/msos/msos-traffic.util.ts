export function evaluateTraffic(input: {
  creativeId?: string | null;
  width?: number | null;
  height?: number | null;
  weightKb?: number | null;
  maxWeightKb?: number | null;
  clickUrl?: string | null;
  backupRequired: boolean;
  backupAttached: boolean;
  status: string;
}): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.status !== 'approved_by_partner') {
    reasons.push('status_not_approved');
  }
  if (!input.creativeId) {
    reasons.push('creative_required');
  }
  if (!input.width || !input.height) {
    reasons.push('size_required');
  }
  if (!input.clickUrl || !/^https:\/\//.test(input.clickUrl)) {
    reasons.push('click_url_not_https');
  }
  if (input.maxWeightKb && (input.weightKb ?? 0) > input.maxWeightKb) {
    reasons.push('weight_exceeds_max');
  }
  if (input.backupRequired && !input.backupAttached) {
    reasons.push('backup_required');
  }
  return { ready: reasons.length === 0, reasons };
}
