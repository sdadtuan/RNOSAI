export type DeliveryCapability = 'lead_ingest' | 'delivery';
export type DeliveryProjectStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'closed'
  | 'cancelled';
export type DeliveryHealth = 'stable' | 'needs_attention' | 'at_risk' | 'overdue' | 'no_data';
export type IngestStatus = 'draft' | 'active' | 'paused' | 'archived';

const CAPS: DeliveryCapability[] = ['lead_ingest', 'delivery'];

export function normalizeCapabilities(raw: unknown): DeliveryCapability[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<DeliveryCapability>();
  for (const item of list) {
    if (CAPS.includes(item as DeliveryCapability)) {
      seen.add(item as DeliveryCapability);
    }
  }
  return CAPS.filter((cap) => seen.has(cap));
}

export function hasCapability(caps: DeliveryCapability[], cap: DeliveryCapability): boolean {
  return caps.includes(cap);
}

export function nextPrjCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = /^PRJ-(\d+)$/i.exec(code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PRJ-${String(max + 1).padStart(3, '0')}`;
}

export function hasCircularMilestoneDeps(edges: Array<{ from: string; to: string }>): boolean {
  const graph = new Map<string, string[]>();
  for (const e of edges) {
    if (e.from === e.to) return true;
    const list = graph.get(e.from) ?? [];
    list.push(e.to);
    graph.set(e.from, list);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (node: string): boolean => {
    if (done.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const nxt of graph.get(node) ?? []) {
      if (visit(nxt)) return true;
    }
    visiting.delete(node);
    done.add(node);
    return false;
  };
  for (const key of graph.keys()) {
    if (visit(key)) return true;
  }
  return false;
}

export function deriveDeliveryHealth(input: {
  capabilities: DeliveryCapability[];
  ingestStatus?: IngestStatus | null;
  todayIso: string;
  milestones: Array<{ due_date: string; status: string }>;
}): { health: DeliveryHealth; components: { schedule: string; milestone: string } } {
  const caps = normalizeCapabilities(input.capabilities);
  const hasDelivery = caps.includes('delivery');
  if (!hasDelivery) {
    const ingest = input.ingestStatus ?? 'draft';
    if (ingest === 'active') {
      return { health: 'stable', components: { schedule: 'ingest_active', milestone: 'n/a' } };
    }
    if (ingest === 'paused') {
      return { health: 'needs_attention', components: { schedule: 'ingest_paused', milestone: 'n/a' } };
    }
    return { health: 'no_data', components: { schedule: `ingest_${ingest}`, milestone: 'n/a' } };
  }
  if (input.milestones.length === 0) {
    return { health: 'no_data', components: { schedule: 'no_milestones', milestone: 'none' } };
  }
  const today = input.todayIso.slice(0, 10);
  const open = input.milestones.filter((m) => m.status !== 'completed' && m.status !== 'cancelled');
  if (open.some((m) => m.due_date.slice(0, 10) < today)) {
    return { health: 'overdue', components: { schedule: 'past_due', milestone: 'overdue' } };
  }
  const plus3 = new Date(`${today}T00:00:00.000Z`);
  plus3.setUTCDate(plus3.getUTCDate() + 3);
  const limit = plus3.toISOString().slice(0, 10);
  if (open.some((m) => m.due_date.slice(0, 10) <= limit)) {
    return { health: 'needs_attention', components: { schedule: 'buffer_lt_3d', milestone: 'soon' } };
  }
  return { health: 'stable', components: { schedule: 'on_track', milestone: 'ok' } };
}

const HEALTH_LABELS: Record<DeliveryHealth, string> = {
  stable: 'Đúng tiến độ',
  needs_attention: 'Cần theo dõi',
  at_risk: 'Có rủi ro',
  overdue: 'Quá hạn',
  no_data: 'Chưa có dữ liệu',
};

export function labelDeliveryHealth(health: string): string {
  return HEALTH_LABELS[health as DeliveryHealth] ?? health;
}

export function deliveryHealthClass(health: string): string {
  switch (health) {
    case 'stable':
      return 'delivery-health delivery-health--stable';
    case 'needs_attention':
    case 'at_risk':
      return 'delivery-health delivery-health--warn';
    case 'overdue':
      return 'delivery-health delivery-health--overdue';
    default:
      return 'delivery-health delivery-health--muted';
  }
}

export function labelDeliveryCapability(cap: DeliveryCapability): string {
  return cap === 'lead_ingest' ? 'Nhận lead PTT' : 'Giao hàng';
}
