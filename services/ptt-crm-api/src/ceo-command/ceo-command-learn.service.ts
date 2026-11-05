import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import {
  buildLoraJsonlLine,
  canStartLora,
  shouldExportTurn,
} from '../intake/sales-kit-learn-export.util';
import { maskSalesKitPii } from '../intake/sales-kit-pii.util';
import { hasCeoConfigure } from './ceo-command-caps.util';
import { buildCeoSystemPrompt } from './ceo-command-llm.util';
import {
  candidateFromDownTurn,
  normalizeLearnQuestion,
} from './ceo-command-learn.util';
import { CeoCommandLearnRepository } from './ceo-command-learn.repository';
import type { CeoActor } from './ceo-command.types';
import { CeoCommandTurnsRepository } from './ceo-command-turns.repository';

async function buildQaXlsx(question: string, answer: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('qa');
  sheet.addRow(['question', 'answer']);
  sheet.addRow([question, answer]);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

@Injectable()
export class CeoCommandLearnService {
  private readonly logger = new Logger(CeoCommandLearnService.name);

  constructor(
    private readonly repo: CeoCommandLearnRepository,
    private readonly turns: CeoCommandTurnsRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  private assertConfigure(actor: CeoActor): void {
    if (!hasCeoConfigure(actor.caps)) {
      throw new ForbiddenException({ error: 'ceo_configure_forbidden' });
    }
  }

  async listCandidates(status: string | undefined, actor: CeoActor) {
    this.assertConfigure(actor);
    return { candidates: await this.repo.listByStatus(status) };
  }

  async listDownTurns(days: number, actor: CeoActor) {
    this.assertConfigure(actor);
    const since = new Date(Date.now() - days * 86400000);
    const turns = await this.turns.listByRating('down', since, 100);
    return { turns };
  }

  async proposeFromTurn(turnId: string, actor: CeoActor) {
    this.assertConfigure(actor);
    const turn = await this.turns.findById(turnId);
    if (!turn) throw new NotFoundException({ error: 'not_found' });
    if (turn.rating !== 'down') throw new BadRequestException({ error: 'not_down_rated' });
    const candidate = candidateFromDownTurn(turn);
    if (!candidate) throw new BadRequestException({ error: 'money_in_qa' });
    if (await this.repo.hasDuplicateQuestion(candidate.folder_key, candidate.question)) {
      throw new BadRequestException({ error: 'duplicate_question' });
    }
    const row = await this.repo.insert(candidate);
    if (!row) throw new BadRequestException({ error: 'schema_not_ready' });
    return row;
  }

  async approveCandidate(
    id: string,
    body: { question?: string; answer?: string; folder_key?: string },
    actor: CeoActor,
  ) {
    this.assertConfigure(actor);
    const rows = await this.repo.listByStatus('pending_review');
    const found = rows.find((r) => r.id === id);
    if (!found) throw new NotFoundException({ error: 'not_found' });
    const question = String(body.question ?? found.question).trim();
    const answer = String(body.answer ?? found.answer).trim();
    const folder_key = String(body.folder_key ?? found.folder_key).trim();
    if (!question || !answer) throw new BadRequestException({ error: 'empty_qa' });
    await buildQaXlsx(question, answer);
    await this.repo.updateStatus(id, 'ingested', actor.staffId);
    return {
      candidate: { ...found, question, answer, folder_key, status: 'ingested' },
      note: 'Upload ceo_os pending file via library admin — not auto-ready',
    };
  }

  async rejectCandidate(id: string, reason: string, actor: CeoActor) {
    this.assertConfigure(actor);
    const row = await this.repo.updateStatus(id, 'rejected', actor.staffId, reason);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async exportJsonl(actor: CeoActor): Promise<{ lines: string[]; pairs: number; lora: ReturnType<typeof canStartLora> }> {
    this.assertConfigure(actor);
    const since = new Date(Date.now() - 180 * 86400000);
    const upTurns = await this.turns.listByRating('up', since, 500);
    const ingested = (await this.repo.listByStatus('ingested')).slice(0, 200);
    const systemPrompt = buildCeoSystemPrompt();
    const lines: string[] = [];

    for (const turn of upTurns) {
      if (!shouldExportTurn(turn)) continue;
      const userContent = JSON.stringify({ intent: turn.intent, facts_json: turn.facts_json });
      const assistant = maskSalesKitPii(turn.reply_vi);
      lines.push(
        buildLoraJsonlLine({ systemPrompt, userContent, assistant }),
      );
    }

    for (const c of ingested) {
      lines.push(
        buildLoraJsonlLine({
          systemPrompt,
          userContent: normalizeLearnQuestion(c.question),
          assistant: maskSalesKitPii(c.answer),
        }),
      );
    }

    const lora = canStartLora({
      pairs: lines.length,
      minPairs: this.aiConfig.ceoCommandLoraMinPairs,
      enabled: this.aiConfig.ceoCommandLoraEnabled,
    });
    return { lines, pairs: lines.length, lora };
  }

  async enqueueFromRating(turnId: string): Promise<void> {
    try {
      const turn = await this.turns.findById(turnId);
      if (!turn || turn.rating !== 'down') return;
      const candidate = candidateFromDownTurn(turn);
      if (!candidate) return;
      if (await this.repo.hasDuplicateQuestion(candidate.folder_key, candidate.question)) return;
      await this.repo.insert(candidate);
    } catch (e) {
      this.logger.warn(`learn enqueue failed: ${String((e as Error).message)}`);
    }
  }
}
