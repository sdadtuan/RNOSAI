import { isAccountExecutivePosition } from '../leads-contract/contract-writer.util';
import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';

function normStatus(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Kanban moves that belong to the Sale who was assigned the lead:
 * Trả lại AM, → Proposal, Trả lại AM/CEO, Đã ký HĐ.
 */
export function isSaleKanbanStatusMove(fromStatus: string | null | undefined, toStatus: string | null | undefined): boolean {
  const from = normStatus(fromStatus);
  const to = normStatus(toStatus);
  if (!from || !to || from === to) return false;
  if (from === 'bao_gia' && (to === 'dang_tu_van' || to === 'proposal')) return true;
  if ((from === 'proposal' || from === 'dam_phan') && to === 'bao_gia') return true;
  if (from === 'won' && (to === 'proposal' || to === 'chot')) return true;
  return false;
}

/** True only for the Sale (AE) whose id is the lead owner. AM and Marketing Leader are never that Sale. */
export function saleOwnerMayMoveKanban(input: {
  staffId: number | null | undefined;
  ownerId: number | null | undefined;
  positionCode: string | null | undefined;
}): boolean {
  if (isAccountManagerPosition(input.positionCode) || isMarketingLeaderPosition(input.positionCode)) {
    return false;
  }
  if (!isAccountExecutivePosition(input.positionCode)) return false;
  const me = Number(input.staffId);
  const owner = Number(input.ownerId);
  return Number.isInteger(me) && me > 0 && me === owner;
}
