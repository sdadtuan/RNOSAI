export type CeoIntent =
  | 'briefing_today'
  | 'briefing_pipeline'
  | 'briefing_sla'
  | 'briefing_ops'
  | 'briefing_finance'
  | 'briefing_coach'
  | 'nl_query'
  | 'propose_action'
  | 'freeform'
  | 'ask_library';

export type CeoProposedAction = {
  action_id: string;
  params: Record<string, unknown>;
  preview_vi: string;
  required_caps: Array<{ section: string; action: string }>;
  can_confirm: boolean;
};

export type CeoTurnOutput = {
  turn_id: string | null;
  thread_id: string;
  intent: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  facts_json: Record<string, unknown>;
  citations: unknown[];
  cards: unknown[];
  degraded: Array<{ source: string; reason: string }>;
  proposed_action: CeoProposedAction | null;
  rows?: unknown[];
  result_kind?: 'table' | 'chart';
  drill_href?: string;
};

export type CeoActor = {
  staffId: number;
  staffLabel: string;
  caps: Array<{ section: string; action: string }>;
};

export type CeoTurnBody = {
  intent: string;
  message?: string;
  intent_id?: string;
  action_id?: string;
  params?: Record<string, unknown>;
  thread_id?: string;
};
