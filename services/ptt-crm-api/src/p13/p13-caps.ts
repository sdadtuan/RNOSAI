import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';

export function p13PositionCaps(
  positionCode: string | null | undefined,
): Array<{ section_id: string; action: string }> {
  const code = String(positionCode ?? '').trim().toLowerCase();
  if (code !== 'ceo' && !isSuperAdminPositionCode(positionCode)) return [];
  return [
    { section_id: 'p13_catalog', action: 'view' },
    { section_id: 'p13_catalog', action: 'manage' },
    { section_id: 'p13_holidays', action: 'manage' },
  ];
}
