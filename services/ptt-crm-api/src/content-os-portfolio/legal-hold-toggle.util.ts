import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function parseLegalHoldPatch(body: Record<string, unknown>): { legal_hold: boolean; reason: string } {
  const legal_hold = body.legal_hold === true;
  const reason = String(body.reason ?? '').trim();
  if (body.legal_hold === true && reason.length < 10) {
    throw new BadRequestException({ error: 'hold_reason_required' });
  }
  if (typeof body.legal_hold !== 'boolean') {
    throw new BadRequestException({ error: 'hold_reason_required' });
  }
  return { legal_hold, reason };
}

export function assertCanReleaseHold(input: {
  sodEnabled: boolean;
  actor: string;
  setBy: string | null;
  canAdmin: boolean;
  canQa: boolean;
}): void {
  const actor = String(input.actor ?? '').trim().toLowerCase();
  const setBy = String(input.setBy ?? '').trim().toLowerCase();
  if (input.sodEnabled && actor && setBy && actor === setBy) {
    throw new ForbiddenException({ error: 'sod_hold_release' });
  }
  if (!input.canAdmin && !input.canQa) {
    throw new ForbiddenException({ error: 'hold_release_forbidden' });
  }
}
