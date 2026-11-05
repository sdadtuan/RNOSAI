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

export type ImgCapAction = 'view' | 'edit' | 'manage' | 'execute';
export type ImgCapSection =
  | 'crm_img'
  | 'crm_img.sop'
  | 'crm_img.render'
  | 'crm_img.render_high_cost'
  | 'crm_img.gate1'
  | 'crm_img.gate2'
  | 'crm_img.gate3'
  | 'crm_img.finance'
  | 'crm_img.manage'
  | 'crm_img.admin';

export const IMG_REQUIRED_ACTION_KEY = 'imgRequiredAction';
export const IMG_REQUIRED_SECTION_KEY = 'imgRequiredSection';

export const RequireImgAction = (action: 'view' | 'edit' | 'manage') =>
  SetMetadata(IMG_REQUIRED_ACTION_KEY, action);

export const RequireImgSection = (section: ImgCapSection, action: ImgCapAction) =>
  applyDecorators(
    SetMetadata(IMG_REQUIRED_SECTION_KEY, section),
    SetMetadata(IMG_REQUIRED_ACTION_KEY, action),
  );

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffImgGuard implements CanActivate {
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
      throw new ForbiddenException({ error: 'img_unresolved_staff' });
    }

    const action =
      this.reflector.get<ImgCapAction | undefined>(IMG_REQUIRED_ACTION_KEY, context.getHandler()) ??
      'view';
    const section =
      this.reflector.get<ImgCapSection | undefined>(IMG_REQUIRED_SECTION_KEY, context.getHandler()) ??
      'crm_img';

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
