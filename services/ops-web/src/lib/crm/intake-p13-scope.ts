export type IntakeP13Scope = {
  service_code: string;
  item_codes: string[];
};

export function readIntakeP13Scope(answers: unknown): IntakeP13Scope | null {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const raw = (answers as { p13_scope?: unknown }).p13_scope;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const service_code = String((raw as { service_code?: unknown }).service_code ?? '')
    .trim()
    .toUpperCase();
  if (!service_code) return null;
  const codes = (raw as { item_codes?: unknown }).item_codes;
  const item_codes = Array.isArray(codes)
    ? [...new Set(codes.map((code) => String(code ?? '').trim()).filter(Boolean))]
    : [];
  return { service_code, item_codes };
}

export function mergeIntakeP13Scope(
  answers: Record<string, unknown> | undefined,
  scope: IntakeP13Scope | null,
): Record<string, unknown> {
  const next = { ...(answers ?? {}) };
  if (!scope?.service_code) {
    delete next.p13_scope;
    return next;
  }
  next.p13_scope = {
    service_code: scope.service_code.trim().toUpperCase(),
    item_codes: [...new Set(scope.item_codes.map((code) => code.trim()).filter(Boolean))],
  };
  return next;
}

export function toggleScopeItem(codes: string[], code: string, on: boolean): string[] {
  const next = new Set(codes);
  if (on) next.add(code);
  else next.delete(code);
  return [...next];
}
