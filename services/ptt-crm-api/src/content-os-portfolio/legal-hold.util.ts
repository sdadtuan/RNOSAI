import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export type HardDeleteOutcome = 'deleted' | 'held' | 'missing' | 'out_of_scope';

export function isLegalHold(item: { legal_hold?: unknown } | null | undefined): boolean {
  return item?.legal_hold === true;
}

export function assertHardDeleteOutcome(
  outcome: HardDeleteOutcome,
  itemId: number,
): { ok: true; id: number } {
  if (outcome === 'held') {
    throw new ConflictException({ error: 'legal_hold' });
  }
  if (outcome === 'missing') {
    throw new NotFoundException({ error: 'item_not_found' });
  }
  if (outcome === 'out_of_scope') {
    throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
  }
  return { ok: true, id: itemId };
}
