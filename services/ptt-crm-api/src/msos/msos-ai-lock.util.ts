import { ForbiddenException } from '@nestjs/common';

export const MSOS_AI_FORBIDDEN = [
  'live',
  'issue_io',
  'partner_confirm',
  'make_good_close',
  'finance_request',
  'enable_reseller',
] as const;

export type MsosAiForbiddenAction = (typeof MSOS_AI_FORBIDDEN)[number];

export function assertHumanMsosAction(action: string, actor: 'human' | 'ai'): void {
  if (actor === 'ai' && (MSOS_AI_FORBIDDEN as readonly string[]).includes(action)) {
    throw new ForbiddenException({ error: 'ai_action_forbidden' });
  }
}
