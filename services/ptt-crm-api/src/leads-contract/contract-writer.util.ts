import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';

export const CONTRACT_AM_ONLY_MESSAGE = 'Chỉ AM được lập hợp đồng và gửi GDKD duyệt.';

export const CONTRACT_OWNER_ONLY_MESSAGE =
  'Chỉ AM phụ trách case (người lập báo giá / nhận Solutions) được lập hợp đồng.';

export function isAccountExecutivePosition(positionCode: string | null | undefined): boolean {
  const code = String(positionCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return code === 'ae' || code.startsWith('ae-') || code.startsWith('ae_');
}

export function canWriteLeadContract(opts: {
  positionCode?: string | null;
  asSuperAdmin?: boolean;
  actorEmail?: string;
  createdBy?: string | null;
  allowGrandfather?: boolean;
  actorStaffId?: number | null;
  quoteAssigneeStaffId?: number | null;
  solutionOwnerStaffId?: number | null;
  lastSolutionOwnerStaffId?: number | null;
}): boolean {
  if (opts.asSuperAdmin) return true;
  const isAmDesk =
    isAccountManagerPosition(opts.positionCode) || isMarketingLeaderPosition(opts.positionCode);
  const actorId = Number(opts.actorStaffId ?? 0);
  const owners = [
    opts.quoteAssigneeStaffId,
    opts.solutionOwnerStaffId,
    opts.lastSolutionOwnerStaffId,
  ]
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (owners.length > 0) {
    if (actorId > 0 && owners.includes(actorId)) return true;
  } else if (isAmDesk) {
    return true;
  }
  if (!opts.allowGrandfather) return false;
  const email = String(opts.actorEmail ?? '').trim().toLowerCase();
  const created = String(opts.createdBy ?? '').trim().toLowerCase();
  return Boolean(
    email && created && email === created && isAccountExecutivePosition(opts.positionCode),
  );
}
