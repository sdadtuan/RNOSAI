export const CLIENT_GATE_KEYS = ['plan', 'go_live', 'acceptance'] as const;
export type ClientGateKey = (typeof CLIENT_GATE_KEYS)[number];

export const CLIENT_GATE_LABELS: Record<ClientGateKey, string> = {
  plan: 'Kế hoạch',
  go_live: 'Go-live',
  acceptance: 'Nghiệm thu',
};

export type ClientGateDecision = 'approved' | 'revision_requested';
export type ClientGateStatus = 'pending' | ClientGateDecision;

export type ClientGateHistoryEntry = {
  decision: ClientGateDecision;
  note: string;
  at: string;
  by_staff_id: number | null;
  by_name: string;
};

export type ClientGateState = {
  key: ClientGateKey;
  label: string;
  status: ClientGateStatus;
  note: string;
  revision_count: number;
  decided_at: string | null;
  decided_by_staff_id: number | null;
  decided_by_name: string;
  history: ClientGateHistoryEntry[];
};

function emptyGate(key: ClientGateKey): ClientGateState {
  return {
    key,
    label: CLIENT_GATE_LABELS[key],
    status: 'pending',
    note: '',
    revision_count: 0,
    decided_at: null,
    decided_by_staff_id: null,
    decided_by_name: '',
    history: [],
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function parseHistory(raw: unknown): ClientGateHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ClientGateHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const decision = String(rec.decision ?? '') === 'approved' ? 'approved' : 'revision_requested';
    out.push({
      decision,
      note: String(rec.note ?? '').trim(),
      at: String(rec.at ?? ''),
      by_staff_id: rec.by_staff_id != null ? Number(rec.by_staff_id) : null,
      by_name: String(rec.by_name ?? '').trim(),
    });
  }
  return out;
}

function parseOne(key: ClientGateKey, raw: unknown): ClientGateState {
  const rec = asRecord(raw);
  const statusRaw = String(rec.status ?? '').trim();
  const status: ClientGateStatus =
    statusRaw === 'approved' ? 'approved' : statusRaw === 'revision_requested' ? 'revision_requested' : 'pending';
  const history = parseHistory(rec.history);
  const revisionCount = Number(rec.revision_count);
  return {
    key,
    label: CLIENT_GATE_LABELS[key],
    status,
    note: String(rec.note ?? '').trim(),
    revision_count: Number.isFinite(revisionCount) && revisionCount > 0 ? revisionCount : history.filter((h) => h.decision === 'revision_requested').length,
    decided_at: rec.decided_at ? String(rec.decided_at) : null,
    decided_by_staff_id: rec.decided_by_staff_id != null ? Number(rec.decided_by_staff_id) : null,
    decided_by_name: String(rec.decided_by_name ?? '').trim(),
    history,
  };
}

export function parseClientGates(raw: unknown): Record<ClientGateKey, ClientGateState> {
  const rec = asRecord(raw);
  return {
    plan: parseOne('plan', rec.plan),
    go_live: parseOne('go_live', rec.go_live ?? rec.goLive),
    acceptance: parseOne('acceptance', rec.acceptance),
  };
}

export function serializeClientGates(gates: Record<ClientGateKey, ClientGateState>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CLIENT_GATE_KEYS) {
    const gate = gates[key];
    out[key] = {
      status: gate.status,
      note: gate.note,
      revision_count: gate.revision_count,
      decided_at: gate.decided_at,
      decided_by_staff_id: gate.decided_by_staff_id,
      decided_by_name: gate.decided_by_name,
      history: gate.history,
    };
  }
  return out;
}

export function applyClientGateDecision(
  gates: Record<ClientGateKey, ClientGateState>,
  key: ClientGateKey,
  decision: ClientGateDecision,
  note: string,
  actor: { staffId: number | null; name: string },
  at: Date,
): Record<ClientGateKey, ClientGateState> {
  const current = gates[key] ?? emptyGate(key);
  const trimmed = String(note ?? '').trim().slice(0, 2000);
  const entry: ClientGateHistoryEntry = {
    decision,
    note: trimmed,
    at: at.toISOString(),
    by_staff_id: actor.staffId,
    by_name: actor.name,
  };
  const next: ClientGateState = {
    ...current,
    status: decision,
    note: trimmed,
    revision_count: current.revision_count + (decision === 'revision_requested' ? 1 : 0),
    decided_at: at.toISOString(),
    decided_by_staff_id: actor.staffId,
    decided_by_name: actor.name,
    history: [...current.history, entry],
  };
  return { ...gates, [key]: next };
}

export function normalizeClientGateKey(raw: unknown): ClientGateKey | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'plan' || s === 'ke_hoach' || s === 'kehoach') return 'plan';
  if (s === 'go_live' || s === 'golive' || s === 'go_live_t') return 'go_live';
  if (s === 'acceptance' || s === 'nghiem_thu' || s === 'handover_accept') return 'acceptance';
  return null;
}

export function clientGatesBlockReason(
  fromStage: string,
  toStage: string,
  gates: Record<ClientGateKey, ClientGateState>,
): string {
  if (fromStage === 'deliver' && toStage === 'handover') {
    if (gates.plan.status !== 'approved') {
      return 'Cần khách duyệt Kế hoạch trước khi chuyển Bàn giao.';
    }
    if (gates.go_live.status !== 'approved') {
      return 'Cần khách duyệt Go-live trước khi chuyển Bàn giao.';
    }
  }
  if (fromStage === 'handover' && toStage === 'retain') {
    if (gates.acceptance.status !== 'approved') {
      return 'Cần khách duyệt Nghiệm thu trước khi chuyển Giữ chân.';
    }
  }
  return '';
}
