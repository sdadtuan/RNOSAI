import { Injectable, NotFoundException } from '@nestjs/common';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import { isB2bDirectorPosition } from './b2b-director.util';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { canSeeB2bLead, type B2bLeadScopeRow, type B2bProjectMembership } from './b2b-visibility.util';

export interface B2bLeadVisibilityInput {
  staffId: number;
  caps: StaffSectionCap[];
  positionCode?: string | null;
  lead: {
    owner_id: number | null;
    client_id: string | null;
    channel?: string | null;
    source?: string | null;
    status?: string | null;
    meta_json?: string | Record<string, unknown> | null;
    b2b_project_id?: string | null;
  };
}

export interface B2bListScope {
  staffId: number;
  viewAll: boolean;
  isDirector: boolean;
}

@Injectable()
export class B2bLeadScopeService {
  constructor(private readonly repo: B2bProjectsRepository) {}

  buildListScope(input: {
    staffId: number;
    caps: StaffSectionCap[];
    positionCode?: string | null;
  }): B2bListScope {
    return {
      staffId: input.staffId,
      viewAll: hasGdkdViewAllLeads(input.caps),
      isDirector: isB2bDirectorPosition(input.positionCode),
    };
  }

  async assertLeadVisible(input: B2bLeadVisibilityInput): Promise<void> {
    const scopeRow = this.toScopeRow(input.lead);
    if (scopeRow.flowKind !== 'b2b_prospect') return;
    const memberships = await this.loadMemberships(input.staffId);
    const allowed = canSeeB2bLead(
      {
        staffId: input.staffId,
        isDirector: isB2bDirectorPosition(input.positionCode),
        hasViewAllLeads: hasGdkdViewAllLeads(input.caps),
        isActivePttStaff: true,
      },
      scopeRow,
      memberships,
    );
    if (!allowed) {
      throw new NotFoundException({ error: 'not_found' });
    }
  }

  async loadMemberships(staffId: number): Promise<B2bProjectMembership[]> {
    return this.repo.listStaffMemberships(staffId);
  }

  toScopeRow(lead: B2bLeadVisibilityInput['lead']): B2bLeadScopeRow {
    const flowKind = resolveLeadFlowKind({
      clientId: lead.client_id,
      channel: lead.channel,
      source: lead.source,
      status: lead.status,
      metaJson: lead.meta_json,
    });
    return {
      flowKind,
      ownerId: lead.owner_id != null ? Number(lead.owner_id) : null,
      projectId: lead.b2b_project_id ? String(lead.b2b_project_id) : null,
    };
  }

  async filterFunnelRows<T extends {
    id: number;
    owner_id: number | null;
    status?: string | null;
    meta_json?: string | Record<string, unknown> | null;
  }>(
    rows: T[],
    input: Omit<B2bLeadVisibilityInput, 'lead'>,
  ): Promise<T[]> {
    const memberships = await this.loadMemberships(input.staffId);
    const actor = {
      staffId: input.staffId,
      isDirector: isB2bDirectorPosition(input.positionCode),
      hasViewAllLeads: hasGdkdViewAllLeads(input.caps),
      isActivePttStaff: true,
    };
    if (actor.hasViewAllLeads || actor.isDirector) return rows;
    return rows.filter((row) => {
      const meta =
        typeof row.meta_json === 'string'
          ? row.meta_json
          : row.meta_json != null
            ? row.meta_json
            : null;
      const scopeRow = this.toScopeRow({
        owner_id: row.owner_id,
        client_id: null,
        status: row.status,
        meta_json: meta,
        b2b_project_id: null,
      });
      if (scopeRow.flowKind !== 'b2b_prospect') return true;
      let projectId = scopeRow.projectId;
      if (!projectId && meta) {
        try {
          const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
          projectId = parsed?.b2b_project_id ? String(parsed.b2b_project_id) : null;
        } catch {
          projectId = null;
        }
      }
      return canSeeB2bLead(actor, { ...scopeRow, projectId }, memberships);
    });
  }
}
