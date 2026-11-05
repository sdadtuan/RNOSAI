import { BadRequestException } from '@nestjs/common';

export const QT_LOST_REASONS = ['budget', 'competitor', 'priority', 'scope', 'other'] as const;

export type QtLostReason = (typeof QT_LOST_REASONS)[number];

export function parseLostReason(value: unknown): QtLostReason | null {
  const raw = String(value ?? '').trim().toLowerCase();
  return (QT_LOST_REASONS as readonly string[]).includes(raw) ? (raw as QtLostReason) : null;
}

export function requireLostReason(value: unknown): QtLostReason {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new BadRequestException({ error: 'lost_reason_required' });
  }
  const parsed = parseLostReason(raw);
  if (!parsed) {
    throw new BadRequestException({ error: 'lost_reason_invalid' });
  }
  return parsed;
}
