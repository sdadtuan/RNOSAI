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

@Injectable()
export class StaffLeadsViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (await this.staffAuth.isSuperAdminUser(req.staffUser)) return true;
    const me = await this.staffAuth.me(req.staffUser);
    if (this.staffAuth.hasCap(me.caps, 'crm_leads', 'view')) {
      return true;
    }
    const leadId = req.params?.id;
    if (
      leadId != null &&
      String(leadId).trim() !== '' &&
      /^\d+$/.test(String(leadId)) &&
      this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'view')
    ) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_leads' });
  }
}
