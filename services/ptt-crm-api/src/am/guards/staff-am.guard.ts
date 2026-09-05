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

export type AmCapAction = 'view' | 'view_all' | 'edit' | 'assign' | 'manage';
export type AmCapSection = 'crm_am' | 'crm_am.finance';

export const AM_REQUIRED_ACTION_KEY = 'amRequiredAction';
export const AM_REQUIRED_ANY_ACTION_KEY = 'amRequiredAnyAction';
export const AM_REQUIRED_SECTION_KEY = 'amRequiredSection';

export const RequireAmAction = (action: AmCapAction) => SetMetadata(AM_REQUIRED_ACTION_KEY, action);

export const RequireAmAnyAction = (actions: AmCapAction[]) =>
  SetMetadata(AM_REQUIRED_ANY_ACTION_KEY, actions);

export const RequireAmFinanceAction = (action: AmCapAction = 'view') =>
  applyDecorators(
    SetMetadata(AM_REQUIRED_SECTION_KEY, 'crm_am.finance' satisfies AmCapSection),
    SetMetadata(AM_REQUIRED_ACTION_KEY, action),
  );

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffAmGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'am_unresolved_staff' });
    }

    const anyActions =
      this.reflector.get<AmCapAction[] | undefined>(AM_REQUIRED_ANY_ACTION_KEY, context.getHandler()) ??
      undefined;
    const action =
      this.reflector.get<AmCapAction | undefined>(AM_REQUIRED_ACTION_KEY, context.getHandler()) ?? 'view';
    const section =
      this.reflector.get<AmCapSection | undefined>(AM_REQUIRED_SECTION_KEY, context.getHandler()) ?? 'crm_am';

    const me = await this.staffAuth.me(req.staffUser);
    const satisfies = (wanted: AmCapAction) =>
      this.staffAuth.hasCap(me.caps, section, wanted) ||
      (wanted === 'view' && this.staffAuth.hasCap(me.caps, section, 'view_all')) ||
      (wanted === 'assign' &&
        section === 'crm_am' &&
        this.staffAuth.hasCap(me.caps, section, 'manage'));
    const allowed = anyActions?.length ? anyActions.some(satisfies) : satisfies(action);
    if (!allowed) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section,
        action: anyActions?.length ? anyActions.join('|') : action,
      });
    }
    return true;
  }
}
