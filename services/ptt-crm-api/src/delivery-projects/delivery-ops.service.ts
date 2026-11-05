import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryProjectsRepository } from './delivery-projects.repository';
import { DeliveryOpsRepository } from './delivery-ops.repository';
import type {
  CapacityTeamRow,
  CreateDeliveryChangeRequestBody,
  CreateDeliveryRiskBody,
  PatchDeliveryRiskBody,
} from './delivery-ops.types';
import {
  addDays,
  computeDeliveryQuality,
  isoWeekStart,
  overlapAllocationPct,
} from './delivery-ops.util';

@Injectable()
export class DeliveryOpsService {
  constructor(
    private readonly opsRepo: DeliveryOpsRepository,
    private readonly projectsRepo: DeliveryProjectsRepository,
  ) {}

  async listRisks(projectId?: string) {
    return { items: await this.opsRepo.listRisks(projectId) };
  }

  async createRisk(projectId: string, body: CreateDeliveryRiskBody) {
    await this.ensureProject(projectId);
    if (!body.title?.trim()) {
      throw new BadRequestException({ error: 'title_required' });
    }
    return this.opsRepo.insertRisk(projectId, body);
  }

  async patchRisk(projectId: string, riskId: string, body: PatchDeliveryRiskBody) {
    await this.ensureProject(projectId);
    const existing = await this.opsRepo.getRisk(projectId, riskId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    if (body.status === 'closed' && !String(body.note ?? existing.note ?? '').trim()) {
      throw new BadRequestException({ error: 'RISK_NOTE_REQUIRED' });
    }
    const row = await this.opsRepo.patchRisk(projectId, riskId, body);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async listChangeRequests(projectId: string, status?: string) {
    await this.ensureProject(projectId);
    return { items: await this.opsRepo.listChangeRequests(projectId, status) };
  }

  async createChangeRequest(projectId: string, body: CreateDeliveryChangeRequestBody, actorStaffId: number) {
    await this.ensureProject(projectId);
    if (!body.kind) throw new BadRequestException({ error: 'kind_required' });
    const baseline = await this.opsRepo.getProjectVersion(projectId);
    const status = body.submit ? 'pending' : 'draft';
    return this.opsRepo.insertChangeRequest(projectId, body, actorStaffId, baseline, status);
  }

  async approveChangeRequest(id: string, note?: string | null) {
    const row = await this.opsRepo.patchChangeRequestStatus(id, 'approved', note);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    await this.opsRepo.bumpProjectVersion(row.project_id);
    return row;
  }

  async rejectChangeRequest(id: string, note?: string | null) {
    const row = await this.opsRepo.patchChangeRequestStatus(id, 'rejected', note);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async getCapacity(weeks = 4): Promise<{ range: { start: string; end: string }; teams: CapacityTeamRow[] }> {
    const start = isoWeekStart();
    const end = addDays(start, weeks * 7 - 1);
    const assignments = await this.opsRepo.listCapacityAssignments(start, end);
    const teamMap = new Map<string, CapacityTeamRow>();

    for (let w = 0; w < weeks; w += 1) {
      const weekStart = addDays(start, w * 7);
      const weekEnd = addDays(weekStart, 6);
      const weekLabel = weekStart.slice(5);
      const staffIds = [...new Set(assignments.map((a) => a.staff_id))];
      for (const staffId of staffIds) {
        const rows = assignments.filter((a) => a.staff_id === staffId);
        const team = rows[0]?.team_name?.trim() || 'Chưa gán team';
        const pct = overlapAllocationPct(
          rows.map((a) => ({
            staff_id: a.staff_id,
            pct: a.allocation_pct,
            start: a.start_date,
            end: a.end_date,
            project_status: a.project_status,
          })),
          staffId,
          { start: weekStart, end: weekEnd },
        );
        const entry = teamMap.get(team) ?? { team, weeks: [], peak_pct: 0 };
        entry.weeks.push({ week: weekLabel, pct, overloaded: pct > 100 });
        entry.peak_pct = Math.max(entry.peak_pct, pct);
        teamMap.set(team, entry);
      }
    }

    const teams = [...teamMap.values()].sort((a, b) => b.peak_pct - a.peak_pct);
    return { range: { start, end }, teams };
  }

  async computeQuality(projectId: string, period?: string) {
    await this.ensureProject(projectId);
    const p = period ?? new Date().toISOString().slice(0, 7);
    const milestones = await this.opsRepo.listMilestonesForQuality(projectId);
    const crCount = await this.opsRepo.countChangeRequests(projectId);
    const metrics = computeDeliveryQuality({ milestones, changeRequestCount: crCount });
    return this.opsRepo.upsertQualitySnapshot(projectId, p, metrics);
  }

  async listQuality(period?: string) {
    return { items: await this.opsRepo.listQualitySnapshots(period) };
  }

  async computeAllQuality(period?: string) {
    const p = period ?? new Date().toISOString().slice(0, 7);
    const ids = await this.opsRepo.listActiveProjectIds();
    const items = [];
    for (const id of ids) {
      items.push(await this.computeQuality(id, p));
    }
    return { items };
  }

  async listPendingDeliveryApprovals() {
    return this.opsRepo.listPendingProjects();
  }

  async listPendingChangeRequests() {
    return this.opsRepo.listChangeRequests(undefined, 'pending');
  }

  async scheduleClientReports(projectId: string, cadence: Record<string, unknown>) {
    await this.ensureProject(projectId);
    await this.opsRepo.updateCadence(projectId, cadence);
    return { ok: true, cadence_json: cadence };
  }

  async requestMilestoneApproval(projectId: string, milestoneCode: string, actorStaffId: number) {
    await this.ensureProject(projectId);
    return {
      ok: true,
      project_id: projectId,
      milestone_code: milestoneCode,
      status: 'pending',
      requested_by: actorStaffId,
    };
  }

  private async ensureProject(projectId: string) {
    const row = await this.projectsRepo.getById(projectId);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }
}
