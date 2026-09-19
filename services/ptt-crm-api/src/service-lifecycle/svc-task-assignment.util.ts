/** Shared assignee / priority / due helpers for crm_svc_tasks (stored in form_data). */

export const SVC_TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type SvcTaskPriority = (typeof SVC_TASK_PRIORITIES)[number];

export type SvcTaskAssignmentFields = {
  assignee: string | null;
  assignee_staff_id: number | null;
  priority: SvcTaskPriority;
  due_date: string | null;
};

function optionalStr(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s ? s : undefined;
}

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function normalizePriority(raw: unknown): SvcTaskPriority | undefined {
  if (raw == null || raw === '') return undefined;
  const s = String(raw).trim().toLowerCase();
  if ((SVC_TASK_PRIORITIES as readonly string[]).includes(s)) return s as SvcTaskPriority;
  return undefined;
}

/** Accept YYYY-MM-DD or ISO datetime → YYYY-MM-DD. */
export function normalizeDueDate(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

export function readAssignmentFields(formData: Record<string, unknown> | null | undefined): SvcTaskAssignmentFields {
  const fd = formData ?? {};
  const assignee =
    optionalStr(fd.assignee) ?? optionalStr(fd.owner) ?? optionalStr(fd.owner_name) ?? null;
  const staffId = positiveInt(fd.assignee_staff_id ?? fd.owner_staff_id) ?? null;
  const priority = normalizePriority(fd.priority) ?? 'normal';
  const dueRaw = fd.due_date ?? fd.due_at ?? fd.due;
  const due = normalizeDueDate(dueRaw);
  return {
    assignee,
    assignee_staff_id: staffId,
    priority,
    due_date: due === undefined ? null : due,
  };
}

export function mergeAssignmentIntoFormData(
  existing: Record<string, unknown>,
  patch: {
    assignee?: string | null;
    owner?: string | null;
    assignee_staff_id?: number | null;
    priority?: string | null;
    due_date?: string | null;
    form_data?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existing,
    ...(patch.form_data ?? {}),
  };

  const assignee = patch.assignee !== undefined ? patch.assignee : patch.owner;
  if (assignee !== undefined) {
    const v = assignee == null ? null : String(assignee).trim() || null;
    next.assignee = v;
    next.owner = v;
  }
  if (patch.assignee_staff_id !== undefined) {
    next.assignee_staff_id = patch.assignee_staff_id;
  }
  if (patch.priority !== undefined) {
    const p = normalizePriority(patch.priority);
    if (p) next.priority = p;
    else if (patch.priority === null || patch.priority === '') next.priority = 'normal';
  }
  if (patch.due_date !== undefined) {
    const d = normalizeDueDate(patch.due_date);
    if (d === undefined && patch.due_date != null && String(patch.due_date).trim()) {
      // invalid date — leave unchanged
    } else {
      next.due_date = d ?? null;
    }
  }
  return next;
}

export function dueDateFromDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
