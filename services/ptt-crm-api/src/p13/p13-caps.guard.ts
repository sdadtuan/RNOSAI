import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';

type StaffRequest = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

async function capsOf(staffAuth: StaffAuthService, req: StaffRequest) {
  if (req.staffAuthVia === 'internal') return null;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
  return staffAuth.me(req.staffUser);
}

@Injectable()
export class P13CatalogViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_catalog', 'view') || this.staffAuth.hasCap(me.caps, 'p13_catalog', 'manage')) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_catalog', action: 'view' });
  }
}

@Injectable()
export class P13CatalogManageGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_catalog', 'manage')) return true;
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_catalog', action: 'manage' });
  }
}

@Injectable()
export class P13PricingViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_pricing', 'view')) return true;
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_pricing', action: 'view' });
  }
}

@Injectable()
export class P13PricingEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_pricing', 'edit_draft')) return true;
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_pricing', action: 'edit_draft' });
  }
}

@Injectable()
export class P13PricingActivateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_pricing', 'activate')) return true;
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_pricing', action: 'activate' });
  }
}

@Injectable()
export class P13HolidayGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const me = await capsOf(this.staffAuth, req);
    if (!me) return true;
    if (this.staffAuth.hasCap(me.caps, 'p13_holidays', 'manage')) return true;
    throw new ForbiddenException({ error: 'missing_cap', section: 'p13_holidays', action: 'manage' });
  }
}
