import type { IntakeSessionRow, LeadRow } from '@/lib/api';
import {
  emptyDiscoveryForMode,
  normalizeIntakeMode,
  parseDiscoveryChecklist,
  type DiscoveryChecklistState,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { plainTextToRichHtml } from '@/lib/crm/intake-labels';

export interface IntakeSessionFormState {
  bant: Record<string, number>;
  decision: string;
  decisionReason: string;
  contactName: string;
  need: string;
  discovery: DiscoveryChecklistState;
}

export function intakeFormFromSession(session: IntakeSessionRow): IntakeSessionFormState {
  const crm = (session.answers_json?.crm_fields || {}) as Record<string, string>;
  const mode = normalizeIntakeMode(session.mode);
  return {
    bant: { ...(session.bant_json || {}) },
    decision: session.decision || '',
    decisionReason: session.decision_reason || '',
    contactName: session.contact_name || '',
    need: plainTextToRichHtml(String(crm.need || '')),
    discovery: parseDiscoveryChecklist(session.answers_json, mode),
  };
}

export function pickInitialSessionId(
  rows: IntakeSessionRow[],
  preferredId?: number | null,
): number | null {
  if (preferredId != null) {
    const found = rows.find((s) => s.id === preferredId);
    if (found) return found.id;
  }
  const draft = rows.find((s) => s.status === 'draft');
  if (draft) return draft.id;
  return rows[0]?.id ?? null;
}

export function sortIntakeSessions(rows: IntakeSessionRow[]): IntakeSessionRow[] {
  return [...rows].sort((a, b) => {
    const aDraft = a.status === 'draft' ? 1 : 0;
    const bDraft = b.status === 'draft' ? 1 : 0;
    if (aDraft !== bDraft) return bDraft - aDraft;
    return b.id - a.id;
  });
}

export function findDraftSession(rows: IntakeSessionRow[]): IntakeSessionRow | undefined {
  return rows.find((s) => s.status === 'draft');
}

export function buildCreateIntakeSessionBody(input: {
  leadId: number;
  lifecycleId: number;
  mode: 'phone' | 'in_person';
  lead?: Pick<LeadRow, 'full_name' | 'source'> | null;
}): {
  lead_id?: number;
  lifecycle_id?: number;
  mode: string;
  service_slug: string;
  contact_name?: string;
  source?: string;
} {
  const body: {
    lead_id?: number;
    lifecycle_id?: number;
    mode: string;
    service_slug: string;
    contact_name?: string;
    source?: string;
  } = {
    mode: input.mode,
    service_slug: '_common',
  };
  if (input.leadId > 0) body.lead_id = input.leadId;
  if (input.lifecycleId > 0) body.lifecycle_id = input.lifecycleId;
  if (input.lead?.full_name?.trim()) {
    body.contact_name = input.lead.full_name.trim();
  }
  if (input.lead?.source?.trim()) {
    body.source = input.lead.source.trim();
  }
  return body;
}
