import { API_BASE, ApiError, parseJson } from './api';
import type { LeadMeetingPrepResponse } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export class LeadMeetingPrepApiError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'LeadMeetingPrepApiError';
  }
}

async function lmpFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LeadMeetingPrepApiError(body || res.statusText, res.status);
  }
  return parseJson<T>(res);
}

export async function fetchLeadMeetingPrep(
  token: string,
  leadId: number,
): Promise<LeadMeetingPrepResponse> {
  return lmpFetch<LeadMeetingPrepResponse>(token, `/api/v1/leads/${leadId}/meeting-prep`);
}

export async function runLeadMeetingPrep(
  token: string,
  leadId: number,
  body: { force?: boolean; website_url?: string; social_urls?: string } = {},
): Promise<{ ok: boolean; enqueued: boolean; prep: LeadMeetingPrepResponse }> {
  return lmpFetch(token, `/api/v1/leads/${leadId}/meeting-prep/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function selectLeadMeetingPrepEntity(
  token: string,
  leadId: number,
  entityId: string,
): Promise<{ ok: boolean; enqueued: boolean; prep: LeadMeetingPrepResponse }> {
  return lmpFetch(token, `/api/v1/leads/${leadId}/meeting-prep/select-entity`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

export async function submitLeadMeetingPrepFeedback(
  token: string,
  leadId: number,
  body: { helpful: boolean; notes?: string; service_dv_code?: string },
): Promise<{ ok: boolean; feedback_id: number }> {
  return lmpFetch(token, `/api/v1/leads/${leadId}/meeting-prep/feedback`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchLeadMeetingPrepDealRoomSlice(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; lead_id: number; sci: import('@/lib/api').DealRoomSciSlice }> {
  return lmpFetch(token, `/api/v1/leads/${leadId}/meeting-prep/deal-room-slice`);
}

export async function applyLeadMeetingPrepOfferLadder(
  token: string,
  leadId: number,
): Promise<{
  ok: boolean;
  lead_id: number;
  proposal_id: number;
  href: string;
  tiers_applied: Array<'CB' | 'TC' | 'CS'>;
}> {
  return lmpFetch(token, `/api/v1/leads/${leadId}/meeting-prep/apply-offer-ladder`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function prepStatusChipLabel(status: LeadMeetingPrepResponse['status']): string | null {
  switch (status) {
    case 'ready':
      return 'Prep sẵn sàng';
    case 'awaiting_entity_choice':
      return 'Cần chọn DN';
    case 'running':
    case 'pending':
      return 'Đang prep…';
    case 'failed':
      return 'Prep lỗi';
    default:
      return null;
  }
}
