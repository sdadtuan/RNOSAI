import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientOffboardService } from '../agency/client-offboard.service';
import { PortalAuthService } from './portal-auth.service';
import { PortalJwtPayload } from './portal-jwt.util';
import { viewerReadOnlyException, viewerWriteBlocked } from './portal-viewer.util';

@Injectable()
export class PortalJwtGuard implements CanActivate {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly tenantLock: ClientOffboardService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { portalUser?: PortalJwtPayload }>();
    const header = String(req.headers.authorization ?? '').trim();
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException({ error: 'Bearer token required' });
    }
    const user = await this.auth.verifyTokenAsync(token);
    await this.tenantLock.assertPortalTenantActive(user.client_id);
    // Disabled or removed accounts lose access immediately (not at token expiry);
    // a role change (e.g. staff -> viewer) applies on the next request.
    const liveRole = await this.auth.liveUserRole(user.sub, user.client_id);
    if (liveRole === null) {
      throw new UnauthorizedException({ error: 'account_disabled' });
    }
    req.portalUser = liveRole ? { ...user, role: liveRole } : user;
    // Viewer ("Chỉ xem") is strictly read-only: every write is refused here, before any handler runs.
    if (viewerWriteBlocked(req.portalUser.role, req.method, req.originalUrl ?? req.url)) {
      throw viewerReadOnlyException();
    }
    return true;
  }
}

export const PortalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PortalJwtPayload => {
    const req = ctx.switchToHttp().getRequest<Request & { portalUser?: PortalJwtPayload }>();
    if (!req.portalUser) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    return req.portalUser;
  },
);
