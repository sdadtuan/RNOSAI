export type DictionaryPickerRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  kpi_group: string;
  department?: string;
  metric_type?: string;
  source?: string;
};

export function filterDictionaryRows(
  rows: DictionaryPickerRow[],
  q: { q?: string; groups?: string[]; status?: string; source?: string },
): DictionaryPickerRow[] {
  let out = rows;

  if (q.status?.trim()) {
    const status = q.status.trim().toUpperCase();
    out = out.filter((r) => r.status.toUpperCase() === status);
  }

  if (q.groups?.length) {
    const groups = new Set(q.groups.map((g) => g.toLowerCase()));
    out = out.filter((r) => groups.has(r.kpi_group.toLowerCase()));
  }

  if (q.source?.trim()) {
    const source = q.source.trim().toLowerCase();
    out = out.filter((r) => (r.source ?? '').toLowerCase().includes(source));
  }

  if (q.q?.trim()) {
    const needle = q.q.trim().toLowerCase();
    out = out.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    );
  }

  return out;
}

export function isDeprecatedDisabled(status: string): boolean {
  return status === 'DEPRECATED';
}

export function wizardKpiStorageKey(draftId: string): string {
  return `delivery-wizard:${draftId}:kpis`;
}

export function readWizardKpiSelection(draftId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(wizardKpiStorageKey(draftId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function writeWizardKpiSelection(draftId: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(wizardKpiStorageKey(draftId), JSON.stringify(ids));
}
