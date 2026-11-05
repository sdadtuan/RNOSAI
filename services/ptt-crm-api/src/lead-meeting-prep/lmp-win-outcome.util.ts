import { extractLmpDiscoverMeta } from './lmp-identity-writeback.util';
import { parseDealValueVnd } from '../performance/performance-conversion.util';
import type { LeadMeetingPrepDebriefBody, WinOutcomeJson } from './lead-meeting-prep.types';

export function buildWinOutcomeFromDebrief(input: {
  leadStatus: string;
  metaJson: Record<string, unknown>;
  debrief: LeadMeetingPrepDebriefBody;
  actorEmail: string;
  prepStage?: string | null;
}): WinOutcomeJson {
  const status = String(input.leadStatus ?? '').trim().toLowerCase();
  const outcome: WinOutcomeJson['outcome'] =
    status === 'chot' || status === 'won' ? 'won' : 'lost';

  let dealValue = Number(input.debrief.deal_value_vnd ?? 0);
  if (!Number.isFinite(dealValue) || dealValue <= 0) {
    dealValue = parseDealValueVnd(input.metaJson);
  }

  const discover = extractLmpDiscoverMeta(input.metaJson);

  return {
    outcome,
    deal_value_vnd: dealValue > 0 ? dealValue : null,
    closed_tier: input.debrief.closed_tier ?? null,
    objection_faced: input.debrief.objection_faced?.trim() || null,
    am_feedback: input.debrief.am_feedback?.trim() || null,
    sci_helpful:
      input.debrief.sci_helpful === undefined ? null : Boolean(input.debrief.sci_helpful),
    submitted_at: new Date().toISOString(),
    submitted_by: input.actorEmail || 'unknown',
    prep_stage_at_close: input.prepStage ?? null,
    discover_source: discover?.discover_source ?? null,
    identity_confirmed_by_am:
      discover?.confirmed_by_am === undefined ? null : Boolean(discover.confirmed_by_am),
  };
}

export function winOutcomeHasDebrief(win: Record<string, unknown> | null | undefined): boolean {
  if (!win || typeof win !== 'object') return false;
  return Boolean(
    win.submitted_at &&
      (win.closed_tier || win.objection_faced || win.am_feedback),
  );
}
