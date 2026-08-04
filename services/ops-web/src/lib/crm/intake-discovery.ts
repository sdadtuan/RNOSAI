export type IntakeSessionMode = 'phone' | 'in_person';

export interface DiscoveryChecklistState {
  mode: IntakeSessionMode;
  checked: Record<string, boolean>;
  notes: string;
}

export interface IntakeDefinitionUi {
  slug: string;
  title: string;
  phone_questions: string[];
  inperson_questions: string[];
}

export function normalizeIntakeMode(mode: string | null | undefined): IntakeSessionMode {
  return mode === 'in_person' ? 'in_person' : 'phone';
}

export function questionsForMode(definition: IntakeDefinitionUi | null, mode: IntakeSessionMode): string[] {
  if (!definition) return [];
  return mode === 'in_person' ? definition.inperson_questions : definition.phone_questions;
}

export function parseDiscoveryChecklist(
  answers: Record<string, unknown> | undefined,
  sessionMode: IntakeSessionMode,
): DiscoveryChecklistState {
  const raw = answers?.discovery_checklist;
  if (!raw || typeof raw !== 'object') {
    return { mode: sessionMode, checked: {}, notes: '' };
  }
  const block = raw as Record<string, unknown>;
  const notes = typeof block.notes === 'string' ? block.notes : '';
  const storedMode = normalizeIntakeMode(String(block.mode ?? sessionMode));
  const checkedRaw = block.checked;
  const checked: Record<string, boolean> = {};
  if (storedMode === sessionMode && checkedRaw && typeof checkedRaw === 'object') {
    for (const [key, val] of Object.entries(checkedRaw as Record<string, unknown>)) {
      if (val === true || val === 'true' || val === 1) checked[key] = true;
    }
  }
  return { mode: sessionMode, checked, notes };
}

export function countDiscoveryChecked(checked: Record<string, boolean>): number {
  return Object.values(checked).filter(Boolean).length;
}

export function buildDiscoveryAnswersPatch(
  existing: Record<string, unknown> | undefined,
  crmNeed: string,
  discovery: DiscoveryChecklistState,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    crm_fields: {
      ...(((existing?.crm_fields as Record<string, unknown>) ?? {}) as Record<string, unknown>),
      need: crmNeed,
    },
    discovery_checklist: {
      mode: discovery.mode,
      checked: discovery.checked,
      notes: discovery.notes.trim(),
    },
  };
}

export function emptyDiscoveryForMode(mode: IntakeSessionMode): DiscoveryChecklistState {
  return { mode, checked: {}, notes: '' };
}
