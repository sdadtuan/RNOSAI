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

type ReqWithStaff = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Injectable()
export class StaffKpiTypesViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqWithStaff>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_kpi_types', 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_kpi_types' });
    }
    return true;
  }
}

@Injectable()
export class StaffKpiTypesManageGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqWithStaff>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_kpi_types', 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_kpi_types' });
    }
    return true;
  }
}

@Injectable()
export class StaffKpiTypesConfigureGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqWithStaff>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    const hasConfigure = this.staffAuth.hasCap(me.caps, 'crm_kpi_types', 'configure');
    const hasManage = this.staffAuth.hasCap(me.caps, 'crm_kpi_types', 'manage');
    if (!hasConfigure && !hasManage) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_kpi_types' });
    }
    return true;
  }
}
