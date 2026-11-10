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
export class StaffIntakeViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'view')
    ) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_leads' });
  }
}

@Injectable()
export class StaffIntakeWriteGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'edit')
    ) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_leads' });
  }
}
