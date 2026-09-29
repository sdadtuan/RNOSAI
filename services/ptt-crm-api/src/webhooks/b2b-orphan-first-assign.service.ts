import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeadsWriteService } from '../leads/leads-write.service';
import { LeadsRepository } from '../leads/leads.repository';
import { B2bFirstAssignService } from '../b2b-projects/b2b-first-assign.service';
import { B2bProjectsService } from '../b2b-projects/b2b-projects.service';

export type OrphanAssignResult = {
  ok: true;
  project_id: string;
  scanned: number;
  assigned: number;
  skipped: number;
  failed: number;
  results: Array<{
    lead_id: number;
    status: 'assigned' | 'skipped' | 'failed';
    owner_id?: number | null;
    message?: string;
  }>;
};

@Injectable()
export class B2bOrphanFirstAssignService {
  private readonly logger = new Logger(B2bOrphanFirstAssignService.name);

  constructor(
    private readonly projects: B2bProjectsService,
    private readonly firstAssign: B2bFirstAssignService,
    private readonly leadsRepo: LeadsRepository,
    private readonly leadsWrite: LeadsWriteService,
  ) {}

  async assignUnassignedInProject(
    projectId: string,
    opts: { limit?: number } = {},
  ): Promise<OrphanAssignResult> {
    await this.projects.get(projectId);
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const leads = await this.leadsRepo.listUnassignedB2bLeads(projectId, limit);
    const results: OrphanAssignResult['results'] = [];
    let assigned = 0;
    let skipped = 0;
    let failed = 0;

    for (const lead of leads) {
      if (lead.owner_id != null) {
        skipped += 1;
        results.push({ lead_id: lead.id, status: 'skipped', message: 'already_owned' });
        continue;
      }
      try {
        const decide = await this.firstAssign.assign({
          projectId,
          score: null,
          channel: lead.channel,
          source: lead.source,
          phone: lead.phone,
        });
        if (!decide.ownerId) {
          skipped += 1;
          results.push({
            lead_id: lead.id,
            status: 'skipped',
            message: decide.reason || 'empty_pool',
          });
          continue;
        }
        await this.leadsWrite.patchLead(
          lead.id,
          {
            owner_id: decide.ownerId,
            split: 'reset_closer',
            assign_reason: `first_assign:${decide.strategy}:${decide.reason}`.slice(0, 500),
            assigned_by: 'orphan_first_assign',
          },
          'orphan_first_assign',
        );
        await this.firstAssign.notifyLeadArrival({
          leadId: lead.id,
          projectId,
          ownerId: decide.ownerId,
          score: null,
        });
        assigned += 1;
        results.push({ lead_id: lead.id, status: 'assigned', owner_id: decide.ownerId });
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`orphan_first_assign lead=${lead.id} failed: ${message}`);
        results.push({ lead_id: lead.id, status: 'failed', message });
      }
    }

    if (!leads.length) {
      // still ok — nothing to do
    }

    return {
      ok: true,
      project_id: projectId,
      scanned: leads.length,
      assigned,
      skipped,
      failed,
      results,
    };
  }

  async assignOne(leadId: number): Promise<OrphanAssignResult['results'][number]> {
    const lead = await this.leadsRepo.getLeadById(leadId);
    if (!lead) throw new NotFoundException({ error: 'lead_not_found' });
    const projectId = String(lead.b2b_project_id ?? '').trim();
    if (!projectId) {
      return { lead_id: leadId, status: 'skipped', message: 'not_b2b' };
    }
    const batch = await this.assignUnassignedInProject(projectId, { limit: 200 });
    return (
      batch.results.find((r) => r.lead_id === leadId) ?? {
        lead_id: leadId,
        status: 'skipped',
        message: 'not_in_unassigned_set',
      }
    );
  }
}
