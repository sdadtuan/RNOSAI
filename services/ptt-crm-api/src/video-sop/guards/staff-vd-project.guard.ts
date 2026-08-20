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

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Injectable()
export class StaffVdProjectCreateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'create') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'create',
    });
  }
}

@Injectable()
export class StaffVdProjectViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'create') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'view',
    });
  }
}

@Injectable()
export class StaffVdProjectEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'edit',
    });
  }
}
