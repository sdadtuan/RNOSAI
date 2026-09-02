import type { IwrStaffNode } from './iwr.types';

function nodeMap(nodes: IwrStaffNode[]): Map<number, IwrStaffNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function ancestorIds(staffId: number, nodes: IwrStaffNode[]): number[] {
  const byId = nodeMap(nodes);
  const out: number[] = [];
  const visited = new Set<number>();
  let cur = byId.get(staffId)?.reports_to_id ?? null;
  while (cur != null && !visited.has(cur)) {
    visited.add(cur);
    out.push(cur);
    cur = byId.get(cur)?.reports_to_id ?? null;
  }
  return out;
}

export function descendantIds(managerId: number, nodes: IwrStaffNode[]): number[] {
  const children = new Map<number, number[]>();
  for (const n of nodes) {
    if (n.reports_to_id == null) continue;
    const list = children.get(n.reports_to_id) ?? [];
    list.push(n.id);
    children.set(n.reports_to_id, list);
  }
  const out: number[] = [];
  const stack = [...(children.get(managerId) ?? [])];
  const seen = new Set<number>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export function isOnPath(actorId: number, otherId: number, nodes: IwrStaffNode[]): boolean {
  if (actorId === otherId) return true;
  const ancestors = new Set(ancestorIds(otherId, nodes));
  if (ancestors.has(actorId)) return true;
  const descendants = new Set(descendantIds(actorId, nodes));
  return descendants.has(otherId);
}

export function sameDepartment(
  a: IwrStaffNode | undefined,
  b: IwrStaffNode | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.department_id == null || b.department_id == null) return false;
  return a.department_id === b.department_id;
}
