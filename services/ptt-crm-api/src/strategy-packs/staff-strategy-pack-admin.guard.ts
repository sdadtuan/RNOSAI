import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';

/** Admin / strategist cấu hình pack. AM sửa sections qua marketing-plan write, không sửa catalog. */
@Injectable()
export class StaffStrategyPackAdminGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    const allowed =
      this.staffAuth.hasCap(me.caps, 'ai_admin', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'approve') ||
      this.staffAuth.hasCap(me.caps, 'crm_board', 'configure');
    if (!allowed) throw new ForbiddenException({ error: 'missing_cap', section: 'strategy_packs' });
    return true;
  }
}
