export interface LeadV1 {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  client_id: string | null;
  campaign_id: string | null;
  external_lead_id: string | null;
  owner_id: number | null;
  created_at: string;
  received_at: string;
  is_duplicate: boolean;
  review_queue?: {
    active: boolean;
    message?: string;
    hours_waiting?: number | null;
  };
}

export interface LeadsListResponseV1 {
  leads: LeadV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeadRow {
  id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  owner_id: number | null;
  created_at: string | null;
  is_duplicate: number | null;
  meta_json: string | null;
}

export interface PgLeadRow {
  sqlite_lead_id: number | string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  owner_id: number | null;
  is_duplicate: boolean | null;
  agency_client_id: string | null;
  channel: string | null;
  external_lead_id: string | null;
  campaign_id: string | null;
  received_at: Date | string | null;
  created_at: Date | string | null;
  meta_json?: string | Record<string, unknown> | null;
  first_assigned_at?: Date | string | null;
}

export type ReviewQueueListFilter = 'only' | 'hide';

export interface ListLeadsQuery {
  client_id?: string;
  status?: string;
  source?: string;
  channel?: string;
  q?: string;
  limit?: number;
  offset?: number;
  review_queue_only?: boolean;
  /** When false, include review-queue leads in the main list. Default hide when funnel enabled. */
  hide_review_queue?: boolean;
  review_queue_filter?: ReviewQueueListFilter;
  /** Populated by LeadsService when filtering PG reads via SQLite funnel state. */
  review_queue_ids?: number[];
  owner_id?: number;
  unassigned_only?: boolean;
}

export interface CreateLeadV1Body {
  full_name: string;
  phone?: string;
  email?: string;
  status?: string;
  source?: string;
  channel?: string;
  client_id?: string | null;
  campaign_id?: string | null;
  external_lead_id?: string | null;
  owner_id?: number | null;
}

export interface PatchLeadV1Body {
  owner_id?: number | null;
  status?: string;
  score?: number;
  assigned_by?: string;
  /** Required for terminal status changes when PTT_LEAD_STATUS_GATE=1. */
  audit_note?: string;
  /** GDKD / assign cap only — bypass B2 & outreach gates with status_override_reason. */
  allow_status_override?: boolean;
  status_override_reason?: string;
}

export interface PatchLeadResult {
  lead: LeadV1;
  assigned: boolean;
  scored: boolean;
  status_changed?: boolean;
  previous_status?: string | null;
}

export interface BulkAssignLeadsBody {
  lead_ids: number[];
  owner_id: number;
  reason?: string;
}

export interface BulkAssignLeadsResult {
  assigned: number;
  skipped: number;
  lead_ids: number[];
}
