import { API_BASE, ApiError, parseJson } from './api';
import type {
  PmAssignment,
  PmCampaigns,
  PmCheckInBundle,
  PmCrmSource,
  PmDashboard,
  PmMarketing,
  PmReports,
  PmScorecard,
  PmSettings,
} from './performance-types';

const BASE = '/api/crm/kpi-hub/performance';

async function pmFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body?.message ?? body?.error ?? `HTTP ${res.status}`, res.status, body);
  }
  return body as T;
}

export const fetchPmDashboard = (token: string) => pmFetch<PmDashboard>(token, `${BASE}/dashboard`);
export const fetchPmAssignments = (token: string, scope?: string) =>
  pmFetch<{ items: PmAssignment[] }>(token, `${BASE}/assignments${scope ? `?scope=${scope}` : ''}`);
export const fetchPmAssignment = (token: string, id: string) =>
  pmFetch<PmAssignment>(token, `${BASE}/assignments/${id}`);
export const createPmAssignment = (token: string, body: Record<string, unknown>) =>
  pmFetch<PmAssignment>(token, `${BASE}/assignments`, { method: 'POST', body: JSON.stringify(body) });
export const activatePmAssignment = (token: string, id: string) =>
  pmFetch<PmAssignment>(token, `${BASE}/assignments/${id}/activate`, { method: 'POST' });
export const fetchPmScorecards = (token: string) =>
  pmFetch<{ items: PmScorecard[] }>(token, `${BASE}/scorecards`);
export const addPmScorecardItem = (token: string, id: string, body: Record<string, unknown>) =>
  pmFetch<PmScorecard>(token, `${BASE}/scorecards/${id}/items`, { method: 'POST', body: JSON.stringify(body) });
export const fetchPmCheckIns = (token: string, assignment?: string) =>
  pmFetch<PmCheckInBundle>(
    token,
    `${BASE}/check-ins${assignment ? `?assignment=${assignment}` : ''}`,
  );
export const createPmCheckIn = (token: string, body: Record<string, unknown>) =>
  pmFetch(token, `${BASE}/check-ins`, { method: 'POST', body: JSON.stringify(body) });
export const reviewPmCheckIn = (token: string, id: string, body: { to: string; comment?: string }) =>
  pmFetch(token, `${BASE}/check-ins/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
export const createPmAction = (token: string, body: Record<string, unknown>) =>
  pmFetch(token, `${BASE}/actions`, { method: 'POST', body: JSON.stringify(body) });
export const fetchPmMarketing = (token: string) => pmFetch<PmMarketing>(token, `${BASE}/marketing`);
export const fetchPmCampaigns = (token: string) => pmFetch<PmCampaigns>(token, `${BASE}/campaigns`);
export const fetchPmCrmSource = (token: string) => pmFetch<PmCrmSource>(token, `${BASE}/crm-source`);
export const fetchPmReports = (token: string) => pmFetch<PmReports>(token, `${BASE}/reports`);
export const exportPmReport = (token: string, body: Record<string, unknown>) =>
  pmFetch(token, `${BASE}/reports/export`, { method: 'POST', body: JSON.stringify(body) });
export const fetchPmSettings = (token: string) => pmFetch<PmSettings>(token, `${BASE}/settings`);
export const patchPmSettings = (token: string, body: Partial<PmSettings>) =>
  pmFetch<PmSettings>(token, `${BASE}/settings`, { method: 'PATCH', body: JSON.stringify(body) });
export const closePmPeriod = (token: string, body: { scorecard_id: string; period: string }) =>
  pmFetch(token, `${BASE}/period-close`, { method: 'POST', body: JSON.stringify(body) });
export const reopenPmPeriod = (token: string, body: { scorecard_id: string; period: string; reason: string }) =>
  pmFetch(token, `${BASE}/period-reopen`, { method: 'POST', body: JSON.stringify(body) });
