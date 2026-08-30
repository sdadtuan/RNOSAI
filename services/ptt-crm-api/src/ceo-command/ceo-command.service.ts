import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { resolveIntent } from '../ai-intelligence/nl-query.engine';
import { BRIEFING_INTENTS } from './ceo-command-briefing.util';
import { CeoCommandActionsService } from './ceo-command-actions.service';
import { CEO_ACTION_IDS } from './ceo-command-action.catalog';
import {
  hasCeoAct,
  hasCeoConfigure,
  hasCeoView,
} from './ceo-command-caps.util';
import { CeoCommandBriefingService } from './ceo-command-briefing.service';
import { CeoCommandLearnService } from './ceo-command-learn.service';
import { CeoCommandLibraryService } from './ceo-command-library.service';
import { CeoCommandLlmService } from './ceo-command-llm.service';
import { CeoCommandNlService } from './ceo-command-nl.service';
import { CeoCommandRateService } from './ceo-command-rate.service';
import type { CeoActor, CeoTurnBody, CeoTurnOutput } from './ceo-command.types';
import { CeoCommandTurnsRepository } from './ceo-command-turns.repository';
import { CHIPS_A, CHIPS_B, ceoThreadId } from './ceo-command.util';

@Injectable()
export class CeoCommandService {
  constructor(
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly turns: CeoCommandTurnsRepository,
    private readonly rate: CeoCommandRateService,
    private readonly briefing: CeoCommandBriefingService,
    private readonly nl: CeoCommandNlService,
    private readonly actions: CeoCommandActionsService,
    private readonly llm: CeoCommandLlmService,
    private readonly library: CeoCommandLibraryService,
    private readonly learn: CeoCommandLearnService,
  ) {}

  assertActor(actor: CeoActor): void {
    if (!Number.isFinite(actor.staffId) || actor.staffId <= 0) {
      throw new ForbiddenException({ error: 'ceo_unresolved_staff' });
    }
  }

  async getContext(actor: CeoActor) {
    this.assertActor(actor);
    return {
      staff_id: actor.staffId,
      can_act: hasCeoAct(actor.caps),
      can_configure: hasCeoConfigure(actor.caps),
      chips_a: CHIPS_A.map((c) => c.label),
      chips_b: hasCeoView(actor.caps) ? CHIPS_B.map((c) => c.label) : [],
      actions: [...CEO_ACTION_IDS],
      llm_enabled: this.aiConfig.ceoCommandLlmEnabled,
      ceo_command_enabled: this.aiConfig.ceoCommandEnabled,
    };
  }

  async listThreads(actor: CeoActor, days = 7) {
    this.assertActor(actor);
    const threads = await this.turns.listThreadsByStaff(actor.staffId, days);
    return { threads };
  }

  async listTurns(actor: CeoActor, threadId: string) {
    this.assertActor(actor);
    const prefix = `ceo:${actor.staffId}:`;
    if (!threadId.startsWith(prefix)) {
      throw new ForbiddenException({ error: 'thread_forbidden' });
    }
    const turns = await this.turns.listByThread(threadId);
    return { turns };
  }

  async turn(body: CeoTurnBody, actor: CeoActor): Promise<CeoTurnOutput> {
    this.assertActor(actor);
    if (!hasCeoView(actor.caps)) {
      throw new ForbiddenException({ error: 'ceo_view_forbidden' });
    }
    this.rate.check(`ceo-cmd:${actor.staffId}`, 30, 300_000);

    const thread_id = body.thread_id?.trim() || ceoThreadId(actor.staffId);
    const intent = String(body.intent ?? 'freeform').trim();
    const message = String(body.message ?? '').trim();

    let reply_vi = 'Câu hỏi ngoài phạm vi — chọn chip Hôm nay hoặc một chỉ số.';
    let facts_json: Record<string, unknown> = {};
    let cards: unknown[] = [];
    let degraded: Array<{ source: string; reason: string }> = [];
    let citations: unknown[] = [];
    let proposed_action = null as CeoTurnOutput['proposed_action'];
    let rows: unknown[] | undefined;
    let result_kind: 'table' | 'chart' | undefined;
    let drill_href: string | undefined;
    let stub_mode = true;
    let model_name = 'facts';

    if (BRIEFING_INTENTS.has(intent)) {
      const out = await this.briefing.compose(intent, actor);
      reply_vi = out.reply_vi;
      facts_json = out.facts_json;
      cards = out.cards;
      degraded = out.degraded;
    } else if (intent === 'nl_query') {
      const nlOut = await this.nl.run({
        intent_id: body.intent_id,
        question: message,
        actorId: String(actor.staffId),
      });
      if (!nlOut.ok) {
        reply_vi = 'Câu hỏi ngoài phạm vi — chọn từ danh sách.';
        facts_json = { suggestions: nlOut.suggestions };
      } else {
        reply_vi = nlOut.payload.narrative;
        facts_json = nlOut.facts_json;
        rows = nlOut.payload.rows;
        result_kind = nlOut.payload.result_kind;
        drill_href = `/crm/ai/query?intent=${encodeURIComponent(nlOut.payload.intent_id)}`;
      }
    } else if (intent === 'propose_action') {
      const actionId = String(body.action_id ?? '').trim();
      proposed_action = await this.actions.preview(actionId, body.params ?? {}, actor);
      reply_vi = proposed_action.preview_vi;
      facts_json = { action_id: actionId, params: proposed_action.params };
    } else if (intent === 'ask_library' || (intent === 'freeform' && message)) {
      const forbidden = this.actions.parseForbidden(message);
      if (forbidden) {
        reply_vi = forbidden.reply_vi;
      } else if (intent === 'freeform' && resolveIntent({ question: message })) {
        const nlOut = await this.nl.run({ question: message, actorId: String(actor.staffId) });
        if (nlOut.ok) {
          reply_vi = nlOut.payload.narrative;
          facts_json = nlOut.facts_json;
          rows = nlOut.payload.rows;
          result_kind = nlOut.payload.result_kind;
          drill_href = `/crm/ai/query?intent=${encodeURIComponent(nlOut.payload.intent_id)}`;
        } else {
          reply_vi = 'Câu hỏi ngoài phạm vi — chọn từ danh sách.';
          facts_json = { suggestions: nlOut.suggestions };
        }
      } else {
        const chunks = await this.library.retrieve(message);
        if (chunks.length) {
          citations = chunks.map((c) => ({
            file_name: c.file_name,
            folder_path: c.folder_path,
            excerpt: c.excerpt,
            kind: c.kind,
          }));
          reply_vi = chunks.map((c) => `• ${c.excerpt}`).join('\n').slice(0, 1200);
          facts_json = { library_hits: chunks.length };
        }
      }
    }

    const polished = await this.llm.polish({ reply_vi, facts_json, intent });
    reply_vi = polished.reply_vi;
    stub_mode = polished.stub_mode;
    model_name = polished.model_name;

    const saved = await this.turns.insert({
      thread_id,
      actor_staff_id: actor.staffId,
      intent,
      user_text: message,
      reply_vi,
      stub_mode,
      model_name,
      facts_json,
      citations_json: citations,
      proposed_action_json: proposed_action,
      cards_json: cards,
      degraded_json: degraded,
    });

    return {
      turn_id: saved?.id ?? null,
      thread_id,
      intent,
      reply_vi,
      stub_mode,
      model_name,
      facts_json,
      citations,
      cards,
      degraded,
      proposed_action,
      rows,
      result_kind,
      drill_href,
    };
  }

  async rateTurn(id: string, rating: 'up' | 'down', reason: string | undefined, actor: CeoActor) {
    this.assertActor(actor);
    const turn = await this.turns.findById(id);
    if (!turn || turn.actor_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'turn_forbidden' });
    }
    const row = await this.turns.rate(id, rating, reason);
    if (rating === 'down') {
      void this.learn.enqueueFromRating(id);
    }
    return row;
  }
}
