import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
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
  emptyLibraryReply,
  isSalesKitIntent,
  runSalesKitRules,
  type SalesKitCitation,
} from './intake-sales-kit-rules.util';
import { CreateIntakeSessionBody, PatchIntakeSessionBody } from './intake.types';
import { IntakeB2bVisibilityService, IntakeStaffActor } from './intake-b2b-visibility.service';
import { IntakeSalesKitLlmService } from './intake-sales-kit-llm.service';
import { SalesKitLibraryService } from './sales-kit-library.service';
import { qaAnswerFromBody, type SalesKitHit } from './sales-kit-retrieve.util';

@Injectable()
export class IntakeService {
  constructor(
    private readonly pg: IntakePgRepository,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
    private readonly b2bVisibility: IntakeB2bVisibilityService,
    private readonly funnelPg: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
    private readonly library: SalesKitLibraryService,
    private readonly salesKitLlm: IntakeSalesKitLlmService,
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
    body: { intent?: string; message?: string; service_slug?: string },
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
    const input = buildRulesInputFromSession({
      intent: body.intent,
      message: body.message,
      serviceSlug: body.service_slug,
      session,
    });
    const rules = runSalesKitRules(input);
    const industry = industryFromSession(session);
    if (!needsLibrary(body.intent, body.message)) {
      return this.salesKitLlm.polish({
        intent: body.intent,
        rules,
        citations: rules.citations,
        industry,
        service_slug: input.serviceSlug,
        session_id: session.id,
        useCase: AI_USE_CASE.INTAKE_SALES_KIT,
      });
    }
    const query =
      body.intent === 'pricing_band'
        ? `pricing ${input.serviceSlug}`
        : String(body.message ?? '').trim();
    const hits = await this.library.retrieveForSession(
      { id: session.id, lead_id: session.lead_id, service_slug: input.serviceSlug },
      query,
      body.intent,
    );
    if (!hits.length) {
      const emptyKind =
        body.intent === 'pricing_band' || body.intent === 'battle_card'
          ? body.intent
          : 'ask_library';
      return { ...rules, citations: [], reply_vi: emptyLibraryReply(emptyKind), stub_mode: true };
    }
    const top = hits[0]!;
    const withHits = {
      ...rules,
      reply_vi: body.intent === 'pricing_band' ? top.body : qaAnswerFromBody(top.body),
      citations: hits.map(toCitation),
      stub_mode: true,
    };
    return this.salesKitLlm.polish({
      intent: body.intent,
      rules: withHits,
      citations: withHits.citations,
      industry,
      service_slug: input.serviceSlug,
      session_id: session.id,
      useCase: AI_USE_CASE.INTAKE_SALES_KIT,
    });
  }

  async generateAiSummary(id: number, actor?: IntakeStaffActor | null) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    const input = buildRulesInputFromSession({ intent: 'summary_30s', session });
    const out = runSalesKitRules(input);
    const polished = await this.salesKitLlm.polish({
      intent: 'summary_30s',
      rules: out,
      citations: out.citations,
      industry: industryFromSession(session),
      service_slug: input.serviceSlug,
      session_id: session.id,
      useCase: AI_USE_CASE.INTAKE_AI_SUMMARY,
    });
    const updated = await this.pg.saveAiSummary(id, polished.reply_vi);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }
}

function industryFromSession(session: {
  company_name?: string;
  answers_json?: Record<string, unknown>;
}): string {
  const answers = session.answers_json ?? {};
  const direct = String(answers.industry ?? answers.phone_industry ?? '').trim();
  if (direct) return direct;
  const discovery = answers.discovery_responses;
  if (discovery && typeof discovery === 'object') {
    const row = (discovery as Record<string, { answer?: string }>).phone_industry;
    const answer = String(row?.answer ?? '').trim();
    if (answer) return answer;
  }
  return String(session.company_name ?? '').trim();
}

function needsLibrary(intent: string, message?: string): boolean {
  if (intent === 'ask_library' || intent === 'pricing_band' || intent === 'battle_card') {
    return true;
  }
  return intent === 'freeform' && /(đắt|giá|case|báo giá|band)/i.test(String(message ?? ''));
}

function toCitation(hit: SalesKitHit): SalesKitCitation {
  return {
    file_id: hit.file_id,
    file_name: hit.file_name,
    folder_path: hit.folder_path,
    excerpt: hit.excerpt,
    score: hit.score,
    kind: hit.kind,
  };
}
