export type PublishGateInput = {
  briefReady: boolean;
  internalApproved: boolean;
  legalRequired: boolean;
  legalApproved: boolean;
  rightsValid?: boolean;
  altComplete?: boolean;
  clientApproved: boolean;
  urlOk: boolean;
  versionLocked?: boolean;
  accountHealthy?: boolean;
  paidExpiryWarning?: boolean;
};

export type PublishGateIssue = { code: string; message: string };

export type PublishGateResult = {
  status: 'Pass' | 'Warning' | 'Blocked';
  blockers: PublishGateIssue[];
  warnings: PublishGateIssue[];
};

export function evaluatePublishGate(input: PublishGateInput): PublishGateResult {
  const blockers: PublishGateIssue[] = [];
  const warnings: PublishGateIssue[] = [];
  if (!input.briefReady) blockers.push({ code: 'brief', message: 'Brief chưa đủ threshold.' });
  if (!input.internalApproved) blockers.push({ code: 'internal_approval', message: 'Chưa duyệt nội bộ.' });
  if (input.legalRequired && !input.legalApproved) {
    blockers.push({ code: 'legal_pending', message: 'Conditional legal review chưa có kết quả.' });
  }
  if (input.rightsValid === false) blockers.push({ code: 'rights_invalid', message: 'Asset rights Invalid/Unknown.' });
  if (input.altComplete === false) blockers.push({ code: 'a11y_alt', message: 'Carousel alt text chưa đầy đủ.' });
  if (!input.clientApproved) blockers.push({ code: 'client_approval', message: 'Client approval evidence chưa được lưu.' });
  if (!input.urlOk) blockers.push({ code: 'url', message: 'Destination URL không hợp lệ.' });
  if (input.versionLocked === false) blockers.push({ code: 'version_lock', message: 'Chưa lock snapshot.' });
  if (input.accountHealthy === false) blockers.push({ code: 'channel_health', message: 'Channel account không healthy.' });
  if (input.paidExpiryWarning) {
    warnings.push({ code: 'paid_expiry', message: 'Quyền paid sắp hết hạn.' });
  }
  const status = blockers.length ? 'Blocked' : warnings.length ? 'Warning' : 'Pass';
  return { status, blockers, warnings };
}
