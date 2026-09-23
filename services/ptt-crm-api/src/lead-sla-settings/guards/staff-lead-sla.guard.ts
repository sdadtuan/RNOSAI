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
import { hasGdkdSolutionDesk } from '../../staff-permissions/staff-gdkd.util';

export type LeadSlaAccess = {
  canView: boolean;
  canEdit: boolean;
  canPublish: boolean;
  isSuperAdmin: boolean;
};

@Injectable()
export class LeadSlaSettingsAccessService {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async resolve(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string }): Promise<LeadSlaAccess> {
    if (req.staffAuthVia === 'internal') {
      return { canView: true, canEdit: true, canPublish: true, isSuperAdmin: true };
    }
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    const isSuperAdmin = this.staffAuth.isSuperAdminPosition(me.position_code);
    const gdkd = hasGdkdSolutionDesk(me.caps);
    const amView = this.staffAuth.hasCap(me.caps, 'crm_leads', 'view');
    const salesLeadDesk = me.caps.some(
      (c) =>
        c.section === 'crm_gdkd' &&
        (c.action === 'assign' ||
          c.action === 'override' ||
          c.action === 'view_all_leads' ||
          c.action === 'review_queue'),
    );
    const canEdit = isSuperAdmin || gdkd || salesLeadDesk;
    const canPublish = isSuperAdmin || gdkd;
    const canView =
      canEdit || amView || this.staffAuth.hasCap(me.caps, 'crm_gdkd', 'view_all_leads');
    return { canView, canEdit, canPublish, isSuperAdmin };
  }
}

@Injectable()
export class StaffLeadSlaViewGuard implements CanActivate {
  constructor(private readonly access: LeadSlaSettingsAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const caps = await this.access.resolve(req);
    if (!caps.canView) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'lead_sla_settings' });
    }
    (req as { leadSlaAccess?: LeadSlaAccess }).leadSlaAccess = caps;
    return true;
  }
}

@Injectable()
export class StaffLeadSlaEditGuard implements CanActivate {
  constructor(private readonly access: LeadSlaSettingsAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const caps = await this.access.resolve(req);
    if (!caps.canEdit) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'lead_sla_settings', action: 'edit' });
    }
    (req as { leadSlaAccess?: LeadSlaAccess }).leadSlaAccess = caps;
    return true;
  }
}

@Injectable()
export class StaffLeadSlaPublishGuard implements CanActivate {
  constructor(private readonly access: LeadSlaSettingsAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const caps = await this.access.resolve(req);
    if (!caps.canPublish) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'lead_sla_settings', action: 'publish' });
    }
    (req as { leadSlaAccess?: LeadSlaAccess }).leadSlaAccess = caps;
    return true;
  }
}
