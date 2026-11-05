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

export type IwrCapAction =
  | 'view'
  | 'write'
  | 'review'
  | 'lists'
  | 'schedule'
  | 'export'
  | 'manage'
  | 'executive'
  | 'bcc'
  | 'external';

export const IWR_REQUIRED_ACTION_KEY = 'iwrRequiredAction';

export const RequireIwrAction = (action: IwrCapAction) => SetMetadata(IWR_REQUIRED_ACTION_KEY, action);

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffIwrGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'iwr_unresolved_staff' });
    }

    const action =
      this.reflector.get<IwrCapAction | undefined>(IWR_REQUIRED_ACTION_KEY, context.getHandler()) ??
      'view';

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'iwr', action)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action });
    }
    return true;
  }
}
