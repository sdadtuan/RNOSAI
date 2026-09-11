export type CmktETask = {
  id: string;
  title: string;
  assignee_id: number | null;
  raci: { r: string; a: string; c?: string; i?: string };
  depends_on: string[];
  sla_h: number;
  effort_h: number;
  status: 'todo' | 'doing' | 'done' | 'blocked';
};

export type CapacityBand = 'ok' | 'warning' | 'at_risk' | 'overloaded' | null;

export type CapacityItemInput = {
  assignee_sp?: number | null;
  production_json?: {
    effort_h?: number | null;
    assignee_designer_id?: number | null;
    assignee_video_id?: number | null;
    tasks?: CmktETask[];
  } | null;
};

const WEEK_HOURS = 40;

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function collectAssignees(item: CapacityItemInput): number[] {
  const ids = new Set<number>();
  const push = (value: unknown) => {
    const n = positiveNumber(value);
    if (n != null) ids.add(n);
  };
  push(item.assignee_sp);
  const json = item.production_json ?? {};
  push(json.assignee_designer_id);
  push(json.assignee_video_id);
  for (const row of json.tasks ?? []) {
    push(row?.assignee_id);
  }
  return [...ids];
}

export function capacityBandFor(pct: number | null): CapacityBand {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct >= 100) return 'overloaded';
  if (pct >= 90) return 'at_risk';
  if (pct >= 80) return 'warning';
  return 'ok';
}

export function computeCapacity(items: CapacityItemInput[]): {
  capacity_pct: number | null;
  capacity_band: CapacityBand;
} {
  const assignees = new Set<number>();
  let effortSum = 0;
  let qualified = false;
  for (const item of items ?? []) {
    const effort = positiveNumber(item?.production_json?.effort_h);
    const people = collectAssignees(item ?? {});
    if (effort == null || !people.length) continue;
    qualified = true;
    effortSum += effort;
    for (const id of people) assignees.add(id);
  }
  if (!qualified || !assignees.size) {
    return { capacity_pct: null, capacity_band: null };
  }
  const capacity_pct = Math.round((effortSum / (assignees.size * WEEK_HOURS)) * 100);
  return { capacity_pct, capacity_band: capacityBandFor(capacity_pct) };
}

function remainingHours(task: CmktETask): number {
  if (task.status === 'done') return 0;
  return positiveNumber(task.effort_h) ?? positiveNumber(task.sla_h) ?? 0;
}

export function criticalPathTaskIds(tasks: CmktETask[] | null | undefined): string[] {
  const list = (tasks ?? []).filter((row) => row && String(row.id ?? ''));
  if (!list.length) return [];
  const byId = new Map(list.map((row) => [String(row.id), row]));
  const succs = new Map<string, string[]>();
  const predCount = new Map<string, number>();
  for (const row of list) {
    succs.set(String(row.id), []);
    predCount.set(String(row.id), 0);
  }
  for (const row of list) {
    const to = String(row.id);
    for (const dep of row.depends_on ?? []) {
      const from = String(dep);
      if (!byId.has(from) || from === to) continue;
      succs.get(from)!.push(to);
      predCount.set(to, (predCount.get(to) ?? 0) + 1);
    }
  }
  let sources = list.map((row) => String(row.id)).filter((id) => (predCount.get(id) ?? 0) === 0);
  if (!sources.length) sources = list.map((row) => String(row.id));

  const paths: string[][] = [];
  const walk = (id: string, path: string[], seen: Set<string>) => {
    const next = [...path, id];
    const nextSeen = new Set(seen);
    nextSeen.add(id);
    const outgoing = (succs.get(id) ?? []).filter((succ) => !nextSeen.has(succ));
    if (!outgoing.length) {
      paths.push(next);
      return;
    }
    for (const succ of outgoing) walk(succ, next, nextSeen);
  };
  for (const source of sources) walk(source, [], new Set());

  const score = (path: string[]) => path.reduce((sum, id) => sum + remainingHours(byId.get(id)!), 0);
  const max = Math.max(0, ...paths.map(score));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths.filter((row) => score(row) === max)) {
    for (const id of path) {
      const row = byId.get(id);
      if (!row || row.status === 'done' || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function hasDelayedCriticalTask(tasks: CmktETask[] | null | undefined): boolean {
  const critical = new Set(criticalPathTaskIds(tasks));
  return (tasks ?? []).some((row) => critical.has(String(row.id)) && row.status === 'blocked');
}
