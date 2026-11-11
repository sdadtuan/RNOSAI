import { isAccountManagerPosition } from '../b2b-projects/b2b-director.util';

export const CONTRACT_AM_ONLY_MESSAGE = 'Chỉ AM được lập hợp đồng và gửi GDKD duyệt.';

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
}): boolean {
  if (opts.asSuperAdmin) return true;
  if (isAccountManagerPosition(opts.positionCode)) return true;
  if (!opts.allowGrandfather) return false;
  const actor = String(opts.actorEmail ?? '').trim().toLowerCase();
  const created = String(opts.createdBy ?? '').trim().toLowerCase();
  return Boolean(
    actor && created && actor === created && isAccountExecutivePosition(opts.positionCode),
  );
}
