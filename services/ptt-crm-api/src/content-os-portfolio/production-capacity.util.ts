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

function stronglyConnectedComponents(ids: string[], succs: Map<string, string[]>): string[][] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (start: string) => {
    const stack: Array<{ id: string; i: number }> = [{ id: start, i: 0 }];
    seen.add(start);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const outs = succs.get(frame.id) ?? [];
      if (frame.i < outs.length) {
        const nxt = outs[frame.i++];
        if (!seen.has(nxt)) {
          seen.add(nxt);
          stack.push({ id: nxt, i: 0 });
        }
        continue;
      }
      order.push(frame.id);
      stack.pop();
    }
  };
  for (const id of ids) if (!seen.has(id)) visit(id);

  const preds = new Map<string, string[]>();
  for (const id of ids) preds.set(id, []);
  for (const [from, tos] of succs) {
    for (const to of tos) preds.get(to)!.push(from);
  }

  const assigned = new Set<string>();
  const comps: string[][] = [];
  const assign = (start: string, bucket: string[]) => {
    const stack = [start];
    assigned.add(start);
    while (stack.length) {
      const id = stack.pop()!;
      bucket.push(id);
      for (const pred of preds.get(id) ?? []) {
        if (!assigned.has(pred)) {
          assigned.add(pred);
          stack.push(pred);
        }
      }
    }
  };
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    if (assigned.has(id)) continue;
    const bucket: string[] = [];
    assign(id, bucket);
    comps.push(bucket);
  }
  return comps;
}

export function criticalPathTaskIds(tasks: CmktETask[] | null | undefined): string[] {
  const list = (tasks ?? []).filter((row) => row && String(row.id ?? ''));
  if (!list.length) return [];
  const meta = new Map(list.map((row, index) => [String(row.id), { row, index }]));
  const ids = list.map((row) => String(row.id));
  const succs = new Map<string, string[]>();
  for (const id of ids) succs.set(id, []);
  for (const row of list) {
    const to = String(row.id);
    for (const dep of row.depends_on ?? []) {
      const from = String(dep);
      if (!meta.has(from) || from === to) continue;
      succs.get(from)!.push(to);
    }
  }

  const comps = stronglyConnectedComponents(ids, succs);
  const sccOf = new Map<string, number>();
  comps.forEach((comp, i) => {
    for (const id of comp) sccOf.set(id, i);
  });
  const sccPreds: number[][] = comps.map(() => []);
  const sccSuccs: number[][] = comps.map(() => []);
  const seenEdge = new Set<string>();
  for (const [from, tos] of succs) {
    const a = sccOf.get(from)!;
    for (const to of tos) {
      const b = sccOf.get(to)!;
      if (a === b) continue;
      const key = `${a}->${b}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      sccPreds[b].push(a);
      sccSuccs[a].push(b);
    }
  }

  const rem = (id: string) => remainingHours(meta.get(id)!.row);
  const score = comps.map((comp) => comp.reduce((sum, id) => sum + rem(id), 0));
  const orderKey = comps.map((comp) => Math.min(...comp.map((id) => meta.get(id)!.index)));
  const dist = score.slice();
  const parent = comps.map(() => -1);
  const indeg = sccPreds.map((preds) => preds.length);
  const queue = indeg.flatMap((deg, i) => (deg === 0 ? [i] : []));
  const topo: number[] = [];
  for (let q = 0; q < queue.length; q += 1) {
    const i = queue[q];
    topo.push(i);
    for (const nxt of sccSuccs[i]) {
      indeg[nxt] -= 1;
      if (indeg[nxt] === 0) queue.push(nxt);
    }
  }
  for (const i of topo) {
    for (const pred of sccPreds[i]) {
      const cand = dist[pred] + score[i];
      const better =
        cand > dist[i] ||
        (cand === dist[i] && (parent[i] < 0 || orderKey[pred] < orderKey[parent[i]]));
      if (!better) continue;
      dist[i] = cand;
      parent[i] = pred;
    }
  }

  let best = 0;
  for (let i = 1; i < comps.length; i += 1) {
    if (dist[i] > dist[best] || (dist[i] === dist[best] && orderKey[i] < orderKey[best])) {
      best = i;
    }
  }

  const sccPath: number[] = [];
  for (let cur = best; cur >= 0; cur = parent[cur]) sccPath.push(cur);
  sccPath.reverse();

  const out: string[] = [];
  for (const si of sccPath) {
    const members = comps[si].slice().sort((a, b) => meta.get(a)!.index - meta.get(b)!.index);
    for (const id of members) {
      if (meta.get(id)!.row.status === 'done') continue;
      out.push(id);
    }
  }
  return out;
}

export function hasDelayedCriticalTask(tasks: CmktETask[] | null | undefined): boolean {
  const critical = new Set(criticalPathTaskIds(tasks));
  return (tasks ?? []).some((row) => critical.has(String(row.id)) && row.status === 'blocked');
}
