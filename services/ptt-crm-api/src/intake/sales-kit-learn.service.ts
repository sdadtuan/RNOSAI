import ExcelJS from 'exceljs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { buildKitLlmSystemPrompt } from './intake-sales-kit-llm.util';
import { IntakeB2bVisibilityService, IntakeStaffActor } from './intake-b2b-visibility.service';
import { IntakePgRepository } from './intake-pg.repository';
import { maskSalesKitPii } from './sales-kit-pii.util';
import {
  buildLoraJsonlLine,
  canStartLora,
  shouldExportTurn,
} from './sales-kit-learn-export.util';
import { SalesKitLearnRepository } from './sales-kit-learn.repository';
import {
  answerHasForbiddenMoney,
  candidateFromDownTurn,
  candidatesFromCompletedSession,
  normalizeLearnQuestion,
} from './sales-kit-learn.util';
import { folderKeyOk } from './sales-kit-library.util';
import { SalesKitLibraryService } from './sales-kit-library.service';
import { SalesKitTurnsRepository } from './sales-kit-turns.repository';

function hasConfigure(actor: IntakeStaffActor | null | undefined): boolean {
  if (actor === undefined || actor === null) return true;
  return (actor.caps ?? []).some(
    (c) =>
      (c.section === 'playbooks' && c.action === 'configure') ||
      (c.section === 'crm_leads' && c.action === 'configure'),
  );
}

async function buildQaXlsx(question: string, answer: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('qa');
  sheet.addRow(['question', 'answer']);
  sheet.addRow([question, answer]);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

@Injectable()
export class SalesKitLearnService {
  private readonly logger = new Logger(SalesKitLearnService.name);

  constructor(
    private readonly repo: SalesKitLearnRepository,
    private readonly turns: SalesKitTurnsRepository,
    private readonly intakePg: IntakePgRepository,
    private readonly library: SalesKitLibraryService,
    private readonly b2bVisibility: IntakeB2bVisibilityService,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  async listCandidates(
    query: { status?: string },
    actor?: IntakeStaffActor | null,
  ) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const candidates = await this.repo.listByStatus(query.status?.trim() || undefined);
    return { candidates };
  }

  async listDownTurns(days = 30, actor?: IntakeStaffActor | null) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const since = new Date(Date.now() - days * 86400000);
    const turns = await this.turns.listByRating('down', since, 100);
    return { turns };
  }

  async proposeFromTurn(turnId: string, actor?: IntakeStaffActor | null) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const turn = await this.turns.findById(turnId);
    if (!turn) throw new NotFoundException({ error: 'not_found' });
    if (turn.rating !== 'down') {
      throw new BadRequestException({ error: 'not_down_rated' });
    }
    const session = await this.intakePg.getSession(turn.session_id);
    if (!session) throw new NotFoundException({ error: 'session_not_found' });
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    const candidate = candidateFromDownTurn({
      turn,
      serviceSlug: String(session.service_slug ?? ''),
      sessionId: session.id,
      leadId: session.lead_id,
    });
    if (!candidate) {
      throw new BadRequestException({ error: 'money_in_qa' });
    }
    if (await this.repo.hasDuplicateQuestion(candidate.folder_key, candidate.question)) {
      throw new ConflictException({ error: 'duplicate_question' });
    }
    const row = await this.repo.insert(candidate);
    if (!row) {
      throw new BadRequestException({ error: 'schema_not_ready' });
    }
    return row;
  }

  async approveCandidate(
    id: string,
    body: { question?: string; answer?: string; folder_key?: string },
    actor?: IntakeStaffActor | null,
  ) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    const kind = existing.kind as 'qa' | 'battle_card' | 'pricing';
    const question = String(body.question ?? existing.question).trim();
    const answer = String(body.answer ?? existing.answer).trim().slice(0, 800);
    const folder_key = String(body.folder_key ?? existing.folder_key).trim();
    if (!folderKeyOk(folder_key)) {
      throw new BadRequestException({ error: 'invalid_folder' });
    }
    if (answerHasForbiddenMoney(answer, kind === 'pricing' ? 'pricing' : kind)) {
      throw new BadRequestException({ error: 'money_in_qa' });
    }
    const buffer = await buildQaXlsx(question, answer);
    const file = await this.library.uploadFile({
      file: {
        buffer,
        originalname: `learn-${id.slice(0, 8)}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
      } as Express.Multer.File,
      folderKey: folder_key,
      actor,
    });
    const staffId = actor && actor.staffId > 0 ? actor.staffId : null;
    const candidate = await this.repo.updateStatus(id, 'ingested', staffId);
    if (!candidate) throw new NotFoundException({ error: 'not_found' });
    return { candidate, file };
  }

  async rejectCandidate(
    id: string,
    body: { reason?: string },
    actor?: IntakeStaffActor | null,
  ) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) {
      throw new BadRequestException({ error: 'reason_required' });
    }
    const staffId = actor && actor.staffId > 0 ? actor.staffId : null;
    const candidate = await this.repo.updateStatus(id, 'rejected', staffId, reason);
    if (!candidate) throw new NotFoundException({ error: 'not_found' });
    return candidate;
  }

  async enqueueFromCompletedSession(session: {
    id: number;
    lead_id: number | null;
    service_slug?: string;
    decision?: string | null;
    decision_reason?: string | null;
  }): Promise<number> {
    if (!(await this.repo.tableReady())) return 0;
    const upTurns = await this.turns.listUpBySession(session.id);
    const drafts = candidatesFromCompletedSession({ session, upTurns });
    let inserted = 0;
    for (const draft of drafts) {
      if (await this.repo.hasDuplicateQuestion(draft.folder_key, draft.question)) continue;
      const row = await this.repo.insert({
        folder_key: draft.folder_key,
        kind: draft.kind,
        question: draft.question,
        answer: draft.answer,
        source_session_id: draft.source_session_id,
        source_lead_id: draft.source_lead_id,
        source_turn_id: draft.source_turn_id,
      });
      if (row) inserted += 1;
    }
    if (inserted > 0) {
      this.logger.log(`Enqueued ${inserted} learn candidate(s) for session=${session.id}`);
    }
    return inserted;
  }

  async metrics(actor?: IntakeStaffActor | null) {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const candidateMetrics = await this.repo.metrics();
    const up = await this.turns.listByRating('up', new Date(Date.now() - 30 * 86400000), 5000);
    const down = await this.turns.listByRating('down', new Date(Date.now() - 30 * 86400000), 5000);
    const rated = up.length + down.length;
    return {
      ...candidateMetrics,
      up_pct_30d: rated ? Math.round((up.length / rated) * 100) : 0,
      down_pct_30d: rated ? Math.round((down.length / rated) * 100) : 0,
    };
  }

  async exportJsonl(actor?: IntakeStaffActor | null): Promise<string> {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const systemPrompt = buildKitLlmSystemPrompt();
    const lines: string[] = [];
    const upTurns = await this.turns.listByRating('up', undefined, 2000);
    for (const turn of upTurns) {
      if (!shouldExportTurn(turn)) continue;
      lines.push(
        buildLoraJsonlLine({
          systemPrompt,
          userContent: maskSalesKitPii(turn.user_text || turn.intent),
          assistant: maskSalesKitPii(turn.reply_vi),
        }),
      );
    }
    const ingested = await this.repo.listIngestedPairs(500);
    for (const pair of ingested) {
      const q = normalizeLearnQuestion(pair.question);
      if (!q) continue;
      lines.push(
        buildLoraJsonlLine({
          systemPrompt,
          userContent: maskSalesKitPii(pair.question),
          assistant: maskSalesKitPii(pair.answer),
        }),
      );
    }
    const pairs = lines.length;
    const gate = canStartLora({
      enabled: this.aiConfig.salesKitLoraEnabled,
      pairs,
      minPairs: this.aiConfig.salesKitLoraMinPairs,
    });
    if (!gate.ok) {
      this.logger.debug(`LoRA export gate: ${gate.error}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
