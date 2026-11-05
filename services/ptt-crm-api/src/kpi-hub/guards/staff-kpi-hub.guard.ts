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

function makeGuard(section: string, actions: string[]) {
  @Injectable()
  class SectionGuard implements CanActivate {
    constructor(public readonly staffAuth: StaffAuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const req = context.switchToHttp().getRequest<ReqWithStaff>();
      if (req.staffAuthVia === 'internal') return true;
      if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
      const me = await this.staffAuth.me(req.staffUser);
      const ok = actions.some((action) => this.staffAuth.hasCap(me.caps, section, action));
      if (!ok) {
        throw new ForbiddenException({ error: 'missing_cap', section });
      }
      return true;
    }
  }
  return SectionGuard;
}

/** Dashboard — crm_kpi_hub */
@Injectable()
export class StaffKpiHubViewGuard extends makeGuard('crm_kpi_hub', ['view']) {}

/** Dictionary — crm_kpi_dictionary */
@Injectable()
export class StaffKpiHubDictionaryViewGuard extends makeGuard('crm_kpi_dictionary', ['view']) {}

@Injectable()
export class StaffKpiHubDictionaryManageGuard extends makeGuard('crm_kpi_dictionary', ['manage']) {}

@Injectable()
export class StaffKpiHubDictionaryPublishGuard extends makeGuard('crm_kpi_dictionary', ['publish', 'manage']) {}

/** Targets — crm_kpi_hub_targets */
@Injectable()
export class StaffKpiHubTargetsViewGuard extends makeGuard('crm_kpi_hub_targets', ['view']) {}

@Injectable()
export class StaffKpiHubTargetsManageGuard extends makeGuard('crm_kpi_hub_targets', ['manage']) {}

/** Sources — crm_kpi_hub_sources */
@Injectable()
export class StaffKpiHubSourcesViewGuard extends makeGuard('crm_kpi_hub_sources', ['view']) {}

@Injectable()
export class StaffKpiHubSourcesConfigureGuard extends makeGuard('crm_kpi_hub_sources', ['configure', 'manage']) {}

/** Quality — crm_kpi_quality */
@Injectable()
export class StaffKpiHubQualityViewGuard extends makeGuard('crm_kpi_quality', ['view']) {}

@Injectable()
export class StaffKpiHubQualityManageGuard extends makeGuard('crm_kpi_quality', ['manage']) {}

/** Reports — crm_kpi_hub_reports */
@Injectable()
export class StaffKpiHubReportsViewGuard extends makeGuard('crm_kpi_hub_reports', ['view']) {}

@Injectable()
export class StaffKpiHubReportsManageGuard extends makeGuard('crm_kpi_hub_reports', ['manage', 'send']) {}

/** Settings — crm_kpi_hub_settings */
@Injectable()
export class StaffKpiHubSettingsViewGuard extends makeGuard('crm_kpi_hub_settings', ['view']) {}

@Injectable()
export class StaffKpiHubSettingsManageGuard extends makeGuard('crm_kpi_hub_settings', ['manage']) {}
