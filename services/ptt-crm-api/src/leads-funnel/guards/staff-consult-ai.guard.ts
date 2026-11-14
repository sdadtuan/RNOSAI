import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';
import { LeadsFunnelPgRepository } from '../leads-funnel-pg.repository';
import { assertSolutionAssignee } from './solution-assignee.guard';

/** Legacy cap check (crm_mkt_ai generate + board/consult edit). No longer grants consult AI on its own. */
export function canGenerateConsultAi(caps: StaffSectionCap[]): boolean {
  const generate = caps.some((cap) => cap.section === 'crm_mkt_ai' && cap.action === 'generate');
  if (!generate) return false;
  const boardEdit = caps.some((cap) => cap.section === 'crm_board' && cap.action === 'edit');
  const consultEdit = caps.some(
    (cap) => cap.section === 'crm_presales_solution' && cap.action === 'edit',
  );
  return boardEdit || consultEdit;
}

/**
 * Consult AI (client-brief/suggest, marketing-plan/ai-draft): only the person assigned to this
 * lead's Solution step (AM position or HR "Nhận Solution") and SUPER-ADMIN.
 */
@Injectable()
export class StaffConsultAiGenerateGuard implements CanActivate {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly leadPg: LeadsFunnelPgRepository,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return assertSolutionAssignee(context, this.staffAuth, this.leadPg, {
      section: 'crm_mkt_ai',
      action: 'generate',
    });
  }
}
