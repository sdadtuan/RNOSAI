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
import { hasGdkdAssign, hasGdkdReviewQueue } from '../../staff-permissions/staff-gdkd.util';

/** GDKD, Sales Lead, or Account Manager with review_queue — release the review inbox. */
@Injectable()
export class StaffLeadsGdkdGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (await this.staffAuth.isSuperAdminUser(req.staffUser)) return true;
    const me = await this.staffAuth.me(req.staffUser);
    const position = String(me.position_code ?? '').trim().toLowerCase();
    if (position === 'gdkd' || hasGdkdAssign(me.caps) || hasGdkdReviewQueue(me.caps)) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_gdkd', action: 'review_queue' });
  }
}
