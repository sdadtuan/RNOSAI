import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { LeadsRepository } from '../../leads/leads.repository';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';

/** BR-AI-04 — CSKH chỉ score lead của mình; GDKD (assign cap) hoặc internal bypass. */
@Injectable()
export class StaffAiLeadAccessGuard implements CanActivate {
  constructor(
    private readonly leads: LeadsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        staffUser?: StaffJwtPayload;
        staffAuthVia?: 'internal' | 'jwt';
        body?: { lead_id?: number | string; entity_id?: number | string; entity_type?: string; context?: string; text?: string };
        query?: { entity_id?: string };
      }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    const leadId = this.resolveLeadId(req);
    if (!leadId) {
      const body = req.body;
      const ctx = String(body?.context ?? 'activity').toLowerCase();
      if (ctx !== 'lead_brief' && body?.text?.trim()) {
        return true;
      }
      throw new ForbiddenException({ error: 'lead_id_required' });
    }

    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new ForbiddenException({ error: 'lead_not_found', lead_id: leadId });
    }

    const staffId = Number(req.staffUser.sub);
    if (lead.owner_id != null && lead.owner_id === staffId) {
      return true;
    }

    const me = await this.staffAuth.me(req.staffUser);
    if (this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign')) {
      return true;
    }

    throw new ForbiddenException({
      error: 'lead_owner_required',
      lead_id: leadId,
      owner_id: lead.owner_id,
    });
  }

  private resolveLeadId(req: {
    body?: { lead_id?: number | string; entity_id?: number | string; entity_type?: string };
    query?: { entity_id?: string; entity_type?: string };
  }): number | null {
    const fromBody = Number(req.body?.lead_id ?? 0);
    if (fromBody > 0) {
      return fromBody;
    }
    const entityType = String(req.body?.entity_type ?? req.query?.entity_type ?? 'lead');
    if (entityType === 'lead') {
      const fromBodyEntity = Number(req.body?.entity_id ?? 0);
      if (fromBodyEntity > 0) {
        return fromBodyEntity;
      }
      const fromQuery = Number(req.query?.entity_id ?? 0);
      if (fromQuery > 0) {
        return fromQuery;
      }
    }
    return null;
  }
}
