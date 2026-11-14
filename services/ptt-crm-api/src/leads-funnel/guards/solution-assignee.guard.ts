import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { isAccountManagerPosition } from '../../b2b-projects/b2b-director.util';
import { LeadsFunnelPgRepository } from '../leads-funnel-pg.repository';
import { canUseAssignedSolutionAction, NOT_SOLUTION_ASSIGNEE_MESSAGE } from '../solution-assignee-access.util';

export type SolutionAssigneeReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
  params: Record<string, string>;
};

/** Shared check for the assigned-Solution-person guards. Internal key is trusted. */
export async function assertSolutionAssignee(
  context: ExecutionContext,
  staffAuth: Pick<StaffAuthService, 'isSuperAdminUser' | 'resolveCrmStaffUserId' | 'me' | 'canReceiveSolution'>,
  leadPg: Pick<LeadsFunnelPgRepository, 'solutionAssigneeStaffId'>,
  denied: { section: string; action: string },
): Promise<true> {
  const req = context.switchToHttp().getRequest<SolutionAssigneeReq>();
  if (req.staffAuthVia === 'internal') return true;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
  if (await staffAuth.isSuperAdminUser(req.staffUser)) return true;
  const leadId = Number(req.params?.id);
  if (!Number.isInteger(leadId) || leadId <= 0) throw new BadRequestException({ error: 'invalid_lead_id' });
  const [staffId, me, canReceiveSolution, assigneeStaffId] = await Promise.all([
    staffAuth.resolveCrmStaffUserId(req.staffUser),
    staffAuth.me(req.staffUser),
    staffAuth.canReceiveSolution(req.staffUser),
    leadPg.solutionAssigneeStaffId(leadId),
  ]);
  if (
    canUseAssignedSolutionAction({
      staffId,
      assigneeStaffId,
      isAccountManager: isAccountManagerPosition(me.position_code),
      canReceiveSolution,
    })
  ) {
    return true;
  }
  throw new ForbiddenException({
    error: 'missing_cap',
    reason: 'not_solution_assignee',
    message: NOT_SOLUTION_ASSIGNEE_MESSAGE,
    section: denied.section,
    action: denied.action,
  });
}
