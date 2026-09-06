import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';

export type CpCapAction = 'view' | 'edit' | 'manage' | 'execute';
export type CpCapSection = 'crm_cp' | 'crm_cp.render';

export const CP_REQUIRED_ACTION_KEY = 'cpRequiredAction';
export const CP_REQUIRED_SECTION_KEY = 'cpRequiredSection';

export const RequireCpAction = (action: 'view' | 'edit' | 'manage') =>
  SetMetadata(CP_REQUIRED_ACTION_KEY, action);

export const RequireCpSection = (section: CpCapSection, action: CpCapAction) =>
  applyDecorators(
    SetMetadata(CP_REQUIRED_SECTION_KEY, section),
    SetMetadata(CP_REQUIRED_ACTION_KEY, action),
  );

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffCpGuard implements CanActivate {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'cp_unresolved_staff' });
    }

    const action =
      this.reflector.get<CpCapAction | undefined>(CP_REQUIRED_ACTION_KEY, context.getHandler()) ??
      'view';
    const section =
      this.reflector.get<CpCapSection | undefined>(CP_REQUIRED_SECTION_KEY, context.getHandler()) ??
      'crm_cp';

    const me = await this.staffAuth.me(req.staffUser);
    const allowed =
      this.staffAuth.hasCap(me.caps, section, action) ||
      (action === 'view' && this.staffAuth.hasCap(me.caps, section, 'view_all'));
    if (!allowed) {
      throw new ForbiddenException({ error: 'missing_cap', section, action });
    }
    return true;
  }
}
