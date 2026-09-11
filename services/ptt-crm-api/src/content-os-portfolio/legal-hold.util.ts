import { ConflictException, NotFoundException } from '@nestjs/common';

export function isLegalHold(item: { legal_hold?: unknown } | null | undefined): boolean {
  return item?.legal_hold === true;
}

export function assertHardDeleteAllowed<T extends { legal_hold?: unknown }>(
  item: T | null,
): asserts item is T {
  if (!item) {
    throw new NotFoundException({ error: 'item_not_found' });
  }
  if (isLegalHold(item)) {
    throw new ConflictException({ error: 'legal_hold' });
  }
}
