import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LeadsFunnelPgRepository } from '../leads-funnel/leads-funnel-pg.repository';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import { extractLmpConsultMergeFields } from '../lead-meeting-prep/lmp-consult-merge.util';
import { parseLeadMetaIndustry, type IntakeLeadContextDto } from './intake-context.util';
import {
  definitionsPayload,
  getUiDefinition,
} from './intake-definitions.util';
import { IntakePgRepository } from './intake-pg.repository';
import {
  buildRulesInputFromSession,
  isSalesKitIntent,
  runSalesKitRules,
} from './intake-sales-kit-rules.util';
import { CreateIntakeSessionBody, PatchIntakeSessionBody } from './intake.types';
import { IntakeB2bVisibilityService, IntakeStaffActor } from './intake-b2b-visibility.service';

@Injectable()
export class IntakeService {
  constructor(
    private readonly pg: IntakePgRepository,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
    private readonly b2bVisibility: IntakeB2bVisibilityService,
    private readonly funnelPg: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
  ) {}

  getDefinitions() {
    return definitionsPayload();
  }

  getDefinition(slug: string) {
    return getUiDefinition(slug);
  }

  getStats(amId?: number, byAm?: boolean) {
    return this.pg.getIntakeStats(amId, byAm);
  }

  async getLeadContext(
    leadId: number,
    actor?: IntakeStaffActor | null,
  ): Promise<IntakeLeadContextDto> {
    await this.b2bVisibility.assertLeadVisible(leadId, actor);
    const lead = await this.lmpRepo.getLeadContext(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const meta = parseLeadMetaIndustry(lead.meta_json);

    let funnel_service_slug: string | null = null;
    let presales_stage: string | null = null;
    let l2_docs: unknown[] = [];
    try {
      const snap = await this.funnelPg.buildSnapshot(leadId, this.config.presalesOnLead);
      const slug = String(snap?.presales?.presales?.service_slug ?? '').trim();
      const stage = String(snap?.presales?.presales?.stage ?? '').trim();
      funnel_service_slug = slug || null;
      presales_stage = stage || null;
      const items = snap?.presales?.l2_docs?.items;
      l2_docs = Array.isArray(items) ? items : [];
    } catch {
      l2_docs = [];
    }

    let prep: IntakeLeadContextDto['prep'] = null;
    try {
      if (await this.lmpRepo.tableReady()) {
        const row = await this.lmpRepo.getByLeadId(leadId);
        if (row) {
          const lmp = extractLmpConsultMergeFields(row);
          prep = {
            status: row.status,
            prep_stage: row.prep_stage,
            pain_excerpt: String(lmp.close_brief || lmp.external_research_summary || '')
              .trim()
              .slice(0, 120),
          };
        }
      }
    } catch {
      prep = null;
    }

    return {
      lead_id: leadId,
      full_name: String(lead.full_name ?? '').trim(),
      company_name: meta.company_name,
      industry: meta.industry,
      industry_slug: meta.industry_slug,
      funnel_service_slug,
      presales_stage,
      l2_docs,
      prep,
    };
  }

  async resolveEntry(
    leadId?: number,
    mode?: string,
    form?: string,
    actor?: IntakeStaffActor | null,
  ) {
    if (!leadId || !Number.isFinite(leadId)) {
      throw new BadRequestException({ ok: false, error: 'Cần lead_id' });
    }
    await this.b2bVisibility.assertLeadVisible(leadId, actor);
    const result = await this.pg.resolveIntakeEntry(leadId, mode, form);
    if (!result.ok) {
      throw new NotFoundException(result);
    }
    return result;
  }

  async listSessions(
    leadId?: number,
    lifecycleId?: number,
    actor?: IntakeStaffActor | null,
  ) {
    if (!lifecycleId && !leadId) {
      throw new BadRequestException({ error: 'Cần lifecycle_id hoặc lead_id' });
    }
    if (leadId) {
      await this.b2bVisibility.assertLeadVisible(leadId, actor);
    }
    const sessions = await this.pg.listSessions({ leadId, lifecycleId });
    return { sessions };
  }

  async getSession(id: number, actor?: IntakeStaffActor | null) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    return session;
  }

  async createSession(body: CreateIntakeSessionBody, actor?: IntakeStaffActor | null) {
    if (body.lead_id) {
      await this.b2bVisibility.assertLeadVisible(body.lead_id, actor);
    }
    try {
      return await this.pg.createSession(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({ error: msg });
    }
  }

  async updateSession(id: number, body: PatchIntakeSessionBody, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    if (
      String(existing.status ?? '').trim() === 'completed' &&
      body.service_slug !== undefined
    ) {
      throw new BadRequestException({
        error: 'Không thể đổi dịch vụ khi phiên đã hoàn thành. Reopen hoặc tạo phiên mới.',
      });
    }
    const updated = await this.pg.updateSession(id, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }

  async completeSession(
    id: number,
    actorId: number | null,
    actor?: IntakeStaffActor | null,
  ) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    try {
      const updated = await this.pg.completeSession(id, actorId);
      if (!updated) {
        throw new NotFoundException({ error: 'Không tìm thấy phiên' });
      }
      if (String(updated.decision ?? '').trim() === 'go' && updated.lead_id) {
        void this.lmpEnqueue.enqueueAfterIntakeGo(updated.lead_id);
      }
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quyết định')) {
        throw new BadRequestException({ error: msg });
      }
      throw err;
    }
  }

  async reopenSession(id: number, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    const updated = await this.pg.reopenSession(id);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }

  async deleteSession(id: number, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    try {
      const deleted = await this.pg.deleteSession(id);
      if (!deleted) {
        throw new NotFoundException({ error: 'Không tìm thấy phiên' });
      }
      return { ok: true, deleted_id: id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('nháp')) {
        throw new BadRequestException({ error: msg });
      }
      throw err;
    }
  }

  async salesKitTurn(
    id: number,
    body: { intent?: string; message?: string },
    actor?: IntakeStaffActor | null,
  ) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    if (!isSalesKitIntent(body.intent)) {
      throw new BadRequestException({ error: 'intent_required' });
    }
    return runSalesKitRules(
      buildRulesInputFromSession({
        intent: body.intent,
        message: body.message,
        session,
      }),
    );
  }

  async generateAiSummary(id: number, actor?: IntakeStaffActor | null) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    const out = runSalesKitRules(
      buildRulesInputFromSession({ intent: 'summary_30s', session }),
    );
    const updated = await this.pg.saveAiSummary(id, out.reply_vi);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }
}
