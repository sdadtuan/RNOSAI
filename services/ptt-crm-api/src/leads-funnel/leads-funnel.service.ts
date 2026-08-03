import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { parseLeadMeta } from './care-pipeline.util';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  EnsurePresalesBody,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  ReleaseReviewQueueBody,
} from './leads-funnel.types';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { LeadsFunnelSqliteRepository } from './leads-funnel-sqlite.repository';
import { validatePreliminaryPlan } from './presales-marketing-plan.util';
import { reviewQueuePublicState } from './review-queue.util';

@Injectable()
export class LeadsFunnelService {
  constructor(
    private readonly sqliteRepo: LeadsFunnelSqliteRepository,
    private readonly pgRepo: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private get usePgFunnel(): boolean {
    return this.config.crmLeadsFunnelPg;
  }

  async getFunnel(leadId: number): Promise<LeadFunnelSnapshot> {
    const snap = this.usePgFunnel
      ? await this.pgRepo.buildSnapshot(leadId, this.config.presalesOnLead)
      : this.sqliteRepo.buildSnapshot(leadId, this.config.presalesOnLead);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    return snap;
  }

  async getCarePipeline(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, ...snap.care_pipeline, presales_care_gate: snap.presales_care_gate };
  }

  private funnelError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof NotFoundException) throw err;
    throw new BadRequestException({ error: msg, message: msg });
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.submitCareReport(leadId, body, actor, userId);
      } else {
        this.sqliteRepo.submitCareReport(leadId, body, actor, userId);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async completeCareStage(leadId: number, body: CompleteCareStageBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.completeCareStage(leadId, body, actor);
      } else {
        this.sqliteRepo.completeCareStage(leadId, body, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async reviewQueueCount(): Promise<{ count: number }> {
    const count = this.usePgFunnel
      ? await this.pgRepo.countReviewQueue()
      : this.sqliteRepo.countReviewQueue();
    return { count };
  }

  async listReviewQueue(limit?: number) {
    const rows = this.usePgFunnel
      ? await this.pgRepo.listReviewQueue(limit)
      : this.sqliteRepo.listReviewQueue(limit);
    return {
      leads: rows.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        status: row.status,
        review_queue: reviewQueuePublicState(parseLeadMeta(row.meta_json), row.first_assigned_at || ''),
      })),
      total: rows.length,
    };
  }

  async syncReviewQueue(actor: string, dryRun = false) {
    return this.usePgFunnel
      ? this.pgRepo.syncReviewQueue(actor, dryRun)
      : this.sqliteRepo.syncReviewQueue(actor, dryRun);
  }

  async releaseReviewQueue(leadId: number, body: ReleaseReviewQueueBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.releaseFromReviewQueue(leadId, body, actor);
      } else {
        this.sqliteRepo.releaseFromReviewQueue(leadId, body, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getPresales(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, presales: snap.presales };
  }

  async ensurePresales(leadId: number, body: EnsurePresalesBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.ensurePresales(leadId, body.service_slug, actor);
      } else {
        this.sqliteRepo.ensurePresales(leadId, body.service_slug, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getConsultAdvanceGate(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const gate = await this.pgRepo.buildConsultAdvanceGate(leadId, ps.id);
      return { ok: true, gate, presales_stage: ps.stage };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const gate = this.sqliteRepo.buildConsultAdvanceGate(leadId, snap.presales.id);
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async advancePresales(leadId: number, body: AdvancePresalesBody, allowOverride = false) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      } else {
        this.sqliteRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async staffHasAssignCap(staffUser: StaffJwtPayload): Promise<boolean> {
    const me = await this.staffAuth.me(staffUser);
    return this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
  }

  async patchPresalesTask(
    leadId: number,
    taskId: number,
    body: PatchPresalesTaskBody,
    doneBy: number | null,
  ) {
    if (this.usePgFunnel) {
      await this.pgRepo.updatePresalesTask(taskId, body, doneBy);
    } else {
      this.sqliteRepo.updatePresalesTask(taskId, body, doneBy);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getMarketingPlan(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const plan = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
      const validation = validatePreliminaryPlan(plan);
      return { ok: true, plan, validation };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const plan = this.sqliteRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const validation = validatePreliminaryPlan(plan);
    return { ok: true, plan, validation };
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody) {
    if (this.usePgFunnel) {
      const plan = await this.pgRepo.patchMarketingPlan(leadId, body);
      const validation = validatePreliminaryPlan(plan);
      return { ok: true, plan, validation, funnel: await this.getFunnel(leadId) };
    }
    const plan = this.sqliteRepo.patchMarketingPlan(leadId, body);
    const validation = validatePreliminaryPlan(plan);
    return { ok: true, plan, validation, funnel: await this.getFunnel(leadId) };
  }
}
