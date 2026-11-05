import {
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
import { hasRevopsCap } from '../revops-scope.util';

export type RevopsCapAction = 'view' | 'view_team' | 'view_all' | 'manage';

export const REVOPS_REQUIRED_ACTION_KEY = 'revopsRequiredAction';

export const RequireRevopsAction = (action: RevopsCapAction) =>
  SetMetadata(REVOPS_REQUIRED_ACTION_KEY, action);

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function satisfies(caps: Array<{ section: string; action: string }>, wanted: RevopsCapAction): boolean {
  if (hasRevopsCap(caps, 'manage')) return true;
  if (wanted === 'manage') return false;
  if (hasRevopsCap(caps, 'view_all')) return wanted === 'view' || wanted === 'view_team' || wanted === 'view_all';
  if (wanted === 'view_all') return false;
  if (hasRevopsCap(caps, 'view_team')) return wanted === 'view' || wanted === 'view_team';
  if (wanted === 'view_team') return false;
  return hasRevopsCap(caps, 'view');
}

@Injectable()
export class StaffRevopsGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'revops_unresolved_staff' });
    }

    const action =
      this.reflector.get<RevopsCapAction | undefined>(REVOPS_REQUIRED_ACTION_KEY, context.getHandler()) ??
      'view';
    const me = await this.staffAuth.me(req.staffUser);
    if (!satisfies(me.caps, action)) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_revops',
        action,
      });
    }
    return true;
  }
}
