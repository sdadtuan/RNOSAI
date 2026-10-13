import { API_BASE, ApiError, parseJson, type LeadRow } from '@/lib/api';
import type { AeTeamSortRow } from '@/lib/crm/ae-team-table.util';

export interface AeTeamSummary {
  period: { preset: string; from: string; to: string };
  totals: {
    open_leads: number;
    within_sla_pct: number | null;
    attention: number;
    revenue_vnd: number | null;
    quota_vnd: number | null;
  };
  members: AeTeamSortRow[];
}

export interface AeTeamTimeline {
  activities: Array<{ id: number; lead_id: number; activity_type: string; content: string; created_at: string; created_by: string }>;
  assignments: Array<{ id: string; lead_id: number; from_owner_id: number | null; to_owner_id: number | null; reason: string; assigned_by: string; created_at: string }>;
  instructions: Array<{ id: number; lead_id: number; content: string; created_at: string; read_at: string | null }>;
}

export interface AeTeamSeriesPoint {
  day: string;
  within_sla_pct: number | null;
  calls: number;
  conversion_pct: number | null;
}

async function aeFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok?: boolean; data?: T; error?: { code?: string; message?: string } }>(res);
  if (!res.ok || body.ok === false || body.data == null) {
    throw new ApiError(body.error?.message ?? 'Không tải được đội AE', res.status, body.error?.code);
  }
  return body.data;
}

export function fetchAeTeamSummary(
  token: string,
  query: { preset: string; from?: string; to?: string },
): Promise<AeTeamSummary> {
  const params = new URLSearchParams({ preset: query.preset });
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return aeFetch(token, `/api/crm/ae-team/summary?${params.toString()}`);
}

export function fetchAeTeamMember(
  token: string,
  staffId: number,
  query: { preset: string; from?: string; to?: string },
): Promise<{ member: AeTeamSortRow; timeline: AeTeamTimeline; series: AeTeamSeriesPoint[] }> {
  const params = new URLSearchParams({ preset: query.preset });
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return aeFetch(token, `/api/crm/ae-team/members/${staffId}?${params.toString()}`);
}

export function fetchAeTeamLeads(token: string, staffId: number): Promise<LeadRow[]> {
  return aeFetch(token, `/api/crm/ae-team/members/${staffId}/leads`);
}

export interface AeInterventionItem {
  lead_id: number;
  name: string;
  owner_id: number;
  owner_name: string;
  status: string;
  b2b_project_id: string | null;
  requires_split: boolean;
  codes: string[];
  primary: string;
  delay: number;
  delayUnit: 'minutes' | 'days' | 'count';
}

export interface AeSuggestRow {
  staff_id: number;
  name: string;
  score: number;
}

async function aeSend<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await parseJson<{ ok?: boolean; data?: T; error?: { code?: string; message?: string } }>(res);
  if (!res.ok || payload.ok === false || payload.data == null) {
    throw new ApiError(payload.error?.message ?? 'Không thực hiện được', res.status, payload.error?.code);
  }
  return payload.data;
}

export function fetchAeInterventions(token: string): Promise<{ items: AeInterventionItem[] }> {
  return aeFetch(token, '/api/crm/ae-team/interventions');
}

export function postAeRemind(token: string, body: { lead_ids: number[]; note: string }) {
  return aeSend<{ sent: number }>(token, '/api/crm/ae-team/interventions/remind', body);
}

export function postAeReassign(
  token: string,
  body: { lead_ids: number[]; to_staff_id: number; reason: string; split?: string },
) {
  return aeSend<{ moved: number }>(token, '/api/crm/ae-team/reassign', body);
}

export function postAeInstruction(token: string, body: { lead_id: number; note: string }) {
  return aeSend<{ id: number | null }>(token, '/api/crm/ae-team/instructions', body);
}

export function postAeInstructionRead(token: string, activityId: number) {
  return aeSend<{ read: boolean }>(token, `/api/crm/ae-team/instructions/${activityId}/read`, {});
}

export function postAeIntake(token: string, body: { staff_id: number; accepting: boolean; note?: string }) {
  return aeSend<{ staff_id: number; accepting: boolean }>(token, '/api/crm/ae-team/intake', body);
}

export function fetchAeSuggest(token: string, leadId: number, preset: string): Promise<{ suggestions: AeSuggestRow[] }> {
  return aeFetch(token, `/api/crm/ae-team/suggest?lead_id=${leadId}&preset=${encodeURIComponent(preset)}`);
}

export interface AeTeamAlertItem {
  id: number;
  ruleCode: string;
  level: string;
  status: string;
  ownerStaffId: number;
  targetType: string;
  targetId: string;
}

export function fetchAeAlerts(token: string): Promise<{ items: AeTeamAlertItem[] }> {
  return aeFetch(token, '/api/crm/ae-team/alerts');
}

export function postAeAlertAck(token: string, id: number) {
  return aeSend<{ id: number; status: string }>(token, `/api/crm/ae-team/alerts/${id}/ack`, {});
}

export function postAeAlertResolve(token: string, id: number) {
  return aeSend<{ id: number; status: string }>(token, `/api/crm/ae-team/alerts/${id}/resolve`, {});
}

export interface AeRankBoard {
  grain: string;
  rows: Array<{
    rank: number;
    staff_id: number;
    name: string;
    score: number | null;
    sla_pct: number | null;
    call_pct: number | null;
    conversion_pct: number | null;
    revenue_pct: number | null;
  }>;
}

export function fetchAeRanking(token: string, grain: string): Promise<AeRankBoard> {
  return aeFetch(token, `/api/crm/ae-team/ranking?grain=${encodeURIComponent(grain)}`);
}

export async function downloadAeRanking(token: string, grain: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/crm/ae-team/ranking/export?format=csv&grain=${encodeURIComponent(grain)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError('Không xuất được xếp hạng', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'xep-hang-doi-ae.csv';
  link.click();
  URL.revokeObjectURL(url);
}
