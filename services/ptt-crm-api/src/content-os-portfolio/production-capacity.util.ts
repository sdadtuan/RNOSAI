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
  let effortSum = 0;
  let qualified = false;
  for (const item of items ?? []) {
    const effort = positiveNumber(item?.production_json?.effort_h);
    const people = collectAssignees(item ?? {});
    if (effort == null || !people.length) continue;
    qualified = true;
    effortSum += effort;
  }
  if (!qualified) {
    return { capacity_pct: null, capacity_band: null };
  }
  const rawPct = (effortSum * 100) / WEEK_HOURS;
  return { capacity_pct: Math.round(rawPct), capacity_band: capacityBandFor(rawPct) };
}

function remainingHours(task: CmktETask): number {
  if (task.status === 'done') return 0;
  return positiveNumber(task.effort_h) ?? positiveNumber(task.sla_h) ?? 0;
}

function taskGraph(tasks: CmktETask[] | null | undefined) {
  const list = (tasks ?? []).filter((row) => row && String(row.id ?? ''));
  const meta = new Map<string, { row: CmktETask; index: number }>();
  const ids: string[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    const id = String(row.id);
    if (meta.has(id)) continue;
    meta.set(id, { row, index });
    ids.push(id);
  }
  const succs = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) {
    succs.set(id, []);
    indeg.set(id, 0);
  }
  const seenEdge = new Set<string>();
  for (const id of ids) {
    for (const dep of meta.get(id)!.row.depends_on ?? []) {
      const from = String(dep);
      if (!meta.has(from)) continue;
      const key = `${from}->${id}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      succs.get(from)!.push(id);
      indeg.set(id, indeg.get(id)! + 1);
    }
  }
  return { meta, ids, succs, indeg };
}

export function hasDependsOnCycle(tasks: CmktETask[] | null | undefined): boolean {
  const { ids, succs, indeg } = taskGraph(tasks);
  if (!ids.length) return false;
  const queue = ids.filter((id) => indeg.get(id) === 0);
  let visited = 0;
  for (let q = 0; q < queue.length; q += 1) {
    const u = queue[q];
    visited += 1;
    for (const v of succs.get(u) ?? []) {
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  return visited !== ids.length;
}

export function criticalPathTaskIds(tasks: CmktETask[] | null | undefined): string[] {
  const { meta, ids, succs, indeg } = taskGraph(tasks);
  if (!ids.length) return [];

  const rem = (id: string) => remainingHours(meta.get(id)!.row);
  const orderKey = (id: string) => meta.get(id)!.index;
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const id of ids) {
    dist.set(id, rem(id));
    parent.set(id, null);
    if (indeg.get(id) === 0) queue.push(id);
  }

  let visited = 0;
  for (let q = 0; q < queue.length; q += 1) {
    const u = queue[q];
    visited += 1;
    for (const v of succs.get(u) ?? []) {
      const cand = dist.get(u)! + rem(v);
      const curParent = parent.get(v);
      const better =
        cand > dist.get(v)! ||
        (cand === dist.get(v)! && (curParent == null || orderKey(u) < orderKey(curParent)));
      if (better) {
        dist.set(v, cand);
        parent.set(v, u);
      }
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  if (visited !== ids.length) return [];

  let best = ids[0];
  for (let i = 1; i < ids.length; i += 1) {
    const id = ids[i];
    if (dist.get(id)! > dist.get(best)! || (dist.get(id) === dist.get(best) && orderKey(id) < orderKey(best))) {
      best = id;
    }
  }

  const out: string[] = [];
  for (let cur: string | null = best; cur != null; cur = parent.get(cur) ?? null) {
    if (meta.get(cur)!.row.status !== 'done') out.push(cur);
  }
  out.reverse();
  return out;
}

export function hasDelayedCriticalTask(tasks: CmktETask[] | null | undefined): boolean {
  const critical = new Set(criticalPathTaskIds(tasks));
  return (tasks ?? []).some((row) => critical.has(String(row.id)) && row.status === 'blocked');
}
