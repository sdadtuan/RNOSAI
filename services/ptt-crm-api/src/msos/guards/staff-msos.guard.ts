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

export type MsosCapAction = 'view' | 'write' | 'publish' | 'finance_request' | 'admin';

export const MSOS_REQUIRED_ACTION_KEY = 'msosRequiredAction';

export const RequireMsosAction = (action: MsosCapAction) => SetMetadata(MSOS_REQUIRED_ACTION_KEY, action);

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffMsosGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'msos_unresolved_staff' });
    }

    const action =
      this.reflector.get<MsosCapAction | undefined>(MSOS_REQUIRED_ACTION_KEY, context.getHandler()) ?? 'view';

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_media', action)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_media', action });
    }
    return true;
  }
}
