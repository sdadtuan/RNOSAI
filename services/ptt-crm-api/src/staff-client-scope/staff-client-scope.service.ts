import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  assertClientInScope,
  isClientScopeRestricted,
  normalizeClientIds,
} from './staff-client-scope.util';
import { StaffUserClientsRepository } from './staff-user-clients.repository';

export type ClientScopeContext = {
  restricted: boolean;
  allowedClientIds: string[];
};

@Injectable()
export class StaffClientScopeService {
  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly userClients: StaffUserClientsRepository,
  ) {}

  pilotEnabled(): boolean {
    return this.config.staffScopePilotEnabled;
  }

  async loadClientIdsForUser(userId: string, positionCode?: string | null): Promise<string[] | undefined> {
    if (!this.pilotEnabled()) return undefined;
    if (positionCode && this.staffAuth.isSuperAdminPosition(positionCode)) return undefined;
    const ids = await this.userClients.loadClientIdsForUser(userId);
    return ids.length ? ids : undefined;
  }

  async resolveForJwt(userId: string, positionId: number): Promise<string[] | undefined> {
    if (!this.pilotEnabled()) return undefined;
    const positionCode = await this.staffAuth.loadPositionCodePublic(positionId);
    return this.loadClientIdsForUser(userId, positionCode);
  }

  async resolveForRequest(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<ClientScopeContext> {
    if (!this.pilotEnabled() || req.staffAuthVia === 'internal' || !req.staffUser) {
      return { restricted: false, allowedClientIds: [] };
    }

    let clientIds = req.staffUser.client_ids;
    let positionCode: string | null | undefined;
    if (clientIds == null) {
      const me = await this.staffAuth.me(req.staffUser);
      clientIds = me.client_ids;
      positionCode = me.position_code;
    } else {
      positionCode = await this.staffAuth.loadPositionCodePublic(req.staffUser.position_id);
    }

    const allowedClientIds = normalizeClientIds(clientIds);
    const restricted = isClientScopeRestricted(this.pilotEnabled(), positionCode, allowedClientIds);
    return { restricted, allowedClientIds };
  }

  assertListClientFilter(scope: ClientScopeContext, requestedClientId?: string): void {
    if (!scope.restricted) return;
    if (requestedClientId?.trim() && !assertClientInScope(requestedClientId, scope.allowedClientIds)) {
      throw new ForbiddenException({ error: 'client_scope_denied', client_id: requestedClientId.trim() });
    }
  }

  assertLeadAccessible(scope: ClientScopeContext, leadClientId: string | null | undefined): void {
    if (!scope.restricted) return;
    if (!assertClientInScope(leadClientId, scope.allowedClientIds)) {
      throw new ForbiddenException({ error: 'client_scope_denied' });
    }
  }
}
