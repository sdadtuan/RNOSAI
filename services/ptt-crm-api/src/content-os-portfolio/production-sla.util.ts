export type SlaThreshold = 75 | 90 | 100;
export type SlaAction = 'reminder' | 'at_risk' | 'breached';

export type SlaEvalTask = {
  id: string;
  sla_h?: unknown;
  status?: unknown;
  started_at?: unknown;
};

export type SlaEvent = {
  task_id: string;
  threshold: SlaThreshold;
  action: SlaAction;
  pct: number;
};

const THRESHOLDS: Array<{ threshold: SlaThreshold; action: SlaAction; crosses: (pct: number) => boolean }> = [
  { threshold: 75, action: 'reminder', crosses: (pct) => pct >= 75 },
  { threshold: 90, action: 'at_risk', crosses: (pct) => pct >= 90 },
  { threshold: 100, action: 'breached', crosses: (pct) => pct > 100 },
];

export function slaFiredKey(taskId: string, threshold: SlaThreshold): string {
  return `${taskId}:${threshold}`;
}

function positiveSlaHours(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStartedAt(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

export function parseSlaFired(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is string => typeof row === 'string' && row.length > 0);
}

export function evaluateProductionSla(
  item: { production_json?: { tasks?: SlaEvalTask[] | null; sla_fired?: unknown } | null } | null | undefined,
  now: Date,
): { events: SlaEvent[]; sla_fired: string[] } {
  const json = item?.production_json ?? {};
  const fired = new Set(parseSlaFired(json.sla_fired));
  const events: SlaEvent[] = [];
  const nowMs = now.getTime();

  for (const row of json.tasks ?? []) {
    if (!row || typeof row.id !== 'string' || !row.id) continue;
    if (row.status === 'done') continue;
    const slaH = positiveSlaHours(row.sla_h);
    const started = parseStartedAt(row.started_at);
    if (slaH == null || started == null) continue;
    const elapsedH = (nowMs - started.getTime()) / 3600_000;
    if (!Number.isFinite(elapsedH) || elapsedH < 0) continue;
    const pct = (elapsedH / slaH) * 100;
    for (const rule of THRESHOLDS) {
      const key = slaFiredKey(row.id, rule.threshold);
      if (!rule.crosses(pct) || fired.has(key)) continue;
      fired.add(key);
      events.push({ task_id: row.id, threshold: rule.threshold, action: rule.action, pct });
    }
  }

  return { events, sla_fired: [...fired] };
}

export function resolveAmStaffId(item: {
  assigned_am?: number | null;
  account_manager_id?: number | null;
  am_id?: number | null;
  owner_id?: number | null;
  assignee_sp?: number | null;
}): number | null {
  for (const value of [item.assigned_am, item.account_manager_id, item.am_id, item.owner_id, item.assignee_sp]) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
