import { readIntakeP13Scope, type IntakeP13Scope } from '@/lib/crm/intake-p13-scope';

export interface ConsultScopeSession {
  id: number;
  service_slug: string;
  answers_json?: Record<string, unknown> | null;
}

export interface ConsultScopeItem {
  code: string;
  task: string;
  subtask?: string | null;
}

export function scopeFromLeadSessions(sessions: readonly ConsultScopeSession[], serviceSlug: string): IntakeP13Scope | null {
  const slug = serviceSlug.trim();
  const ordered = [...sessions].sort((a, b) => b.id - a.id);
  const matched = ordered.find((session) => session.service_slug === slug && readIntakeP13Scope(session.answers_json));
  if (matched) return readIntakeP13Scope(matched.answers_json);
  const any = ordered.find((session) => readIntakeP13Scope(session.answers_json));
  return any ? readIntakeP13Scope(any.answers_json) : null;
}

export function attachedScopeLines(
  scope: IntakeP13Scope | null,
  items: readonly ConsultScopeItem[],
): Array<{ code: string; label: string }> {
  if (!scope) return [];
  const byCode = new Map(items.map((item) => [item.code, item]));
  return scope.item_codes.map((code) => {
    const item = byCode.get(code);
    const label = [item?.task, item?.subtask].map((part) => String(part ?? '').trim()).filter(Boolean).join(' — ');
    return { code, label };
  });
}
