export type CapacityDecision =
  | { ok: true; kind: 'soft' | 'hard' | 'waitlist'; conflict: boolean }
  | { ok: false; error: 'overbook_hard' | 'partner_suspended' };

export function decideReserve(input: {
  total: number;
  reservedHard: number;
  reservedSoft: number;
  addQty: number;
  kind: 'soft' | 'hard' | 'waitlist';
  partnerStatus: string;
}): CapacityDecision {
  if (input.partnerStatus === 'suspended') {
    return { ok: false, error: 'partner_suspended' };
  }
  if (input.kind === 'waitlist') {
    return { ok: true, kind: 'waitlist', conflict: false };
  }
  if (input.kind === 'hard') {
    if (input.reservedHard + input.addQty > input.total) {
      return { ok: false, error: 'overbook_hard' };
    }
    return { ok: true, kind: 'hard', conflict: false };
  }
  const conflict = input.reservedHard + input.reservedSoft + input.addQty > input.total;
  return { ok: true, kind: 'soft', conflict };
}

export function calendarDayConflict(total: number, reservedHard: number, reservedSoft: number): boolean {
  return reservedHard + reservedSoft > total || reservedHard > total;
}
