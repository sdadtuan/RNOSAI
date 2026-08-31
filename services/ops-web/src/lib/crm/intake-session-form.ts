import type { IntakeSessionRow, LeadRow } from '@/lib/api';
import {
  checklistFromBant,
  parseBantChecklist,
  type BantChecklistState,
} from '@/lib/crm/intake-bant-checklist';
import { normalizeCommitments, type IntakeCommitmentRow } from '@/lib/crm/intake-commitments';
import {
  discoveryFromDefinition,
  normalizeIntakeMode,
  type DiscoveryChecklistState,
  type IntakeDefinitionUi,
} from '@/lib/crm/intake-discovery';
import { plainTextToRichHtml } from '@/lib/crm/intake-labels';
import { parseRedFlags, type IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';
import { normalizeIntakeSlug } from '@/lib/crm/intake-service-resolve';
import { normalizeStakeholders, type IntakeStakeholderRow } from '@/lib/crm/intake-stakeholders';
import { parseWinChecklist, type WinChecklistState } from '@/lib/crm/intake-win-checklist';
import {
  parseQualifyChecked,
  parseWinIntel,
  type WinIntelState,
} from '@/lib/crm/intake-win-intel';

export interface IntakeSessionFormState {
  bant: Record<string, number>;
  decision: string;
  decisionReason: string;
  contactName: string;
  need: string;
  discovery: DiscoveryChecklistState;
  stakeholders: IntakeStakeholderRow[];
  commitments: IntakeCommitmentRow[];
  redFlags: IntakeRedFlagsState;
  winIntel: WinIntelState;
  qualifyChecked: Record<string, boolean>;
  bantChecklist: BantChecklistState;
  winChecklist: WinChecklistState;
}

export function intakeFormFromSession(
  session: IntakeSessionRow,
  definition?: IntakeDefinitionUi | null,
): IntakeSessionFormState {
  const crm = (session.answers_json?.crm_fields || {}) as Record<string, string>;
  const mode = normalizeIntakeMode(session.mode);
  return {
    bant: { ...(session.bant_json || {}) },
    decision: session.decision || '',
    decisionReason: session.decision_reason || '',
    contactName: session.contact_name || '',
    need: plainTextToRichHtml(String(crm.need || '')),
    discovery: discoveryFromDefinition(definition ?? null, mode, session.answers_json),
    stakeholders: normalizeStakeholders(session.stakeholders_json),
    commitments: normalizeCommitments(session.commitments_json),
    redFlags: parseRedFlags(session.answers_json),
    winIntel: parseWinIntel(session.answers_json),
    qualifyChecked: parseQualifyChecked(session.answers_json),
    bantChecklist: (() => {
      const saved = parseBantChecklist(session.answers_json);
      return Object.keys(saved).length
        ? saved
        : checklistFromBant(
            Object.fromEntries(
              Object.entries(session.bant_json || {}).map(([k, v]) => [k, Number(v)]),
            ),
          );
    })(),
    winChecklist: parseWinChecklist(session.answers_json),
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
  serviceSlug?: string;
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
    service_slug: normalizeIntakeSlug(input.serviceSlug) || '_common',
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
