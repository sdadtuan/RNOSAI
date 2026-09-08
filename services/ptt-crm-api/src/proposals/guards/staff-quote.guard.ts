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

export type QuoteCapAction = 'view' | 'view_all' | 'edit' | 'manage' | 'execute';
export type QuoteCapSection =
  | 'crm_quote'
  | 'crm_quote.approve'
  | 'crm_quote.finance'
  | 'crm_quote.legal'
  | 'crm_quote.publish'
  | 'crm_quote.convert'
  | 'crm_quote.catalog'
  | 'crm_quote.audit';

export const QT_REQUIRED_ACTION_KEY = 'qtRequiredAction';
export const QT_REQUIRED_SECTION_KEY = 'qtRequiredSection';

export const RequireQuoteAction = (action: QuoteCapAction) =>
  SetMetadata(QT_REQUIRED_ACTION_KEY, action);

export const RequireQuoteSection = (section: QuoteCapSection, action: QuoteCapAction) =>
  applyDecorators(
    SetMetadata(QT_REQUIRED_SECTION_KEY, section),
    SetMetadata(QT_REQUIRED_ACTION_KEY, action),
  );

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffQuoteGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }

    const action =
      this.reflector.get<QuoteCapAction | undefined>(QT_REQUIRED_ACTION_KEY, context.getHandler()) ??
      'view';
    const section =
      this.reflector.get<QuoteCapSection | undefined>(QT_REQUIRED_SECTION_KEY, context.getHandler()) ??
      'crm_quote';

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
