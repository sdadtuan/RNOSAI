import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';
import { isAccountManagerPosition } from '../../b2b-projects/b2b-director.util';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

/** Consult AI on the Tư vấn step. Solution edit stands in for the production board cap. */
export function canGenerateConsultAi(caps: StaffSectionCap[]): boolean {
  const generate = caps.some((cap) => cap.section === 'crm_mkt_ai' && cap.action === 'generate');
  if (!generate) return false;
  const boardEdit = caps.some((cap) => cap.section === 'crm_board' && cap.action === 'edit');
  const consultEdit = caps.some(
    (cap) => cap.section === 'crm_presales_solution' && cap.action === 'edit',
  );
  return boardEdit || consultEdit;
}

/** Assigned AM and Super-Admin can run AI tạo Solution at step 3 without crm_mkt_ai. */
export function canRunSolutionAiDraft(input: {
  isSuperAdmin?: boolean;
  isAccountManager?: boolean;
  caps: StaffSectionCap[];
}): boolean {
  if (input.isSuperAdmin || input.isAccountManager) return true;
  return canGenerateConsultAi(input.caps);
}

@Injectable()
export class StaffConsultAiGenerateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (await this.staffAuth.isSuperAdminUser(req.staffUser)) return true;
    const me = await this.staffAuth.me(req.staffUser);
    if (
      canRunSolutionAiDraft({
        isAccountManager: isAccountManagerPosition(me.position_code),
        caps: me.caps,
      })
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      message: 'Bạn chưa được cấp quyền thực hiện thao tác này.',
      section: 'crm_mkt_ai',
      action: 'generate',
    });
  }
}
