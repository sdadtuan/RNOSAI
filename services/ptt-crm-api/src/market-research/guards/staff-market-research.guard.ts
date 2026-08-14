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

async function requireResearchCap(
  staffAuth: StaffAuthService,
  req: StaffReq,
  action: 'view' | 'create' | 'edit' | 'approve',
): Promise<boolean> {
  if (req.staffAuthVia === 'internal') return true;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

  const me = await staffAuth.me(req.staffUser);
  if (!staffAuth.hasCap(me.caps, 'crm_research', action)) {
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_research', action });
  }
  return true;
}

@Injectable()
export class StaffMarketResearchViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'view',
    );
  }
}

@Injectable()
export class StaffMarketResearchCreateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'create',
    );
  }
}

@Injectable()
export class StaffMarketResearchEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'edit',
    );
  }
}

@Injectable()
export class StaffMarketResearchApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'approve',
    );
  }
}
