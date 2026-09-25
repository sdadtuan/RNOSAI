import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { isChatScopedPath } from '../csd/csd-chat-scope.util';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtPayload } from './staff-jwt.util';

@Injectable()
export class StaffOrInternalKeyGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (this.config.authDisabled || !this.config.internalKey) {
      req.staffAuthVia = 'internal';
      return true;
    }

    const key = String(req.headers['x-ptt-internal-key'] ?? '').trim();
    if (key && key === this.config.internalKey) {
      req.staffAuthVia = 'internal';
      return true;
    }

    const header = String(req.headers.authorization ?? '').trim();
    const queryToken = String((req.query as { access_token?: string })?.access_token ?? '').trim();
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : queryToken;
    if (token) {
      return this.staffAuth.verifyAccessToken(token).then((payload) => {
        if (payload.scope === 'chat' && !isChatScopedPath(req.path || req.url || '')) {
          throw new ForbiddenException({ error: 'chat_scope_forbidden' });
        }
        req.staffUser = payload;
        req.staffAuthVia = 'jwt';
        return true;
      });
    }

    throw new UnauthorizedException({ error: 'Unauthorized' });
  }
}
