import { Injectable } from '@nestjs/common';
import { AiNlQueryService } from '../ai-intelligence/ai-nl-query.service';
import { listNlQueryCatalog } from '../ai-intelligence/nl-query.catalog';
import { resolveIntent } from '../ai-intelligence/nl-query.engine';
import type { NlQueryResultPayload } from '../ai-intelligence/nl-query.types';
import { nearestNlAliases } from './ceo-command.util';

@Injectable()
export class CeoCommandNlService {
  constructor(private readonly nlQuery: AiNlQueryService) {}

  async run(input: {
    intent_id?: string;
    question?: string;
    actorId: string;
  }): Promise<
    | {
        ok: true;
        payload: NlQueryResultPayload;
        facts_json: Record<string, unknown>;
      }
    | {
        ok: false;
        error: 'query_out_of_scope';
        suggestions: Array<{ id: string; label: string }>;
      }
  > {
    const intent = resolveIntent({
      intent_id: input.intent_id,
      question: input.question,
    });
    if (!intent) {
      return {
        ok: false,
        error: 'query_out_of_scope',
        suggestions: nearestNlAliases(input.question ?? '', listNlQueryCatalog()),
      };
    }

    const out = await this.nlQuery.runQuery({
      intent_id: intent.id,
      question: input.question,
      actorId: input.actorId,
    });
    const payload = out.data;
    return {
      ok: true,
      payload,
      facts_json: {
        intent_id: payload.intent_id,
        rows: payload.rows,
        narrative: payload.narrative,
      },
    };
  }
}
