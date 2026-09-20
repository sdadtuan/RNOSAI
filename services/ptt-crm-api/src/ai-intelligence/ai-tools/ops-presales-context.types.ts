/** P6 — CrmContextPack.presales extension types. */

export type PresalesBantSlice = {
  session_id: number | null;
  score: string;
  decision: string;
  completed_at: string;
  discovery_answered: string;
  red_flags: number;
  sync_ok: boolean;
  sync_issues: string[];
};

export type PresalesTmmtSlice = {
  lifecycle_id: number | null;
  progress: string;
  gate_passed: boolean;
  missing_fields: string[];
  audience_bullets: string[];
  channels: string[];
  core_message: string;
  suggested_am: string;
  suggested_sp: string;
  geography_resolved: boolean;
};

export type PresalesL2AdsSlice = {
  ads_account_readable: boolean | null;
  pixel_capi: boolean | null;
  landing_page_url: string;
  historical_spend_available: boolean | null;
  gaps: string[];
};

export type PresalesContractSlice = {
  id: number | null;
  title: string;
  value_vnd: number | null;
  value_meaning: string;
  /** HĐ → crm_campaigns link (nullable until staff maps). */
  campaign_id: number | null;
  campaign_code: string;
  campaign_name: string;
  /** linked | contract_unmapped | hub_unmapped | missing_client */
  map_status: string;
};

export type PresalesProposalSlice = {
  ids: number[];
  qt_codes_found: string[];
  has_positive_total: boolean;
  kpi_contract_score: number;
  gaps: string[];
};

export type PresalesInsightSlice = {
  approved_count: number;
  approved_ids: number[];
  can_insert_into_plan: boolean;
};

export type PresalesHubAgencySlice = {
  client_key: string;
  client_id: string;
  campaign_map_rows: number;
  launch_qa_skipped: boolean;
  gaps: string[];
};

export type PresalesLeadSlice = {
  id: number | null;
  name: string;
  status: string;
  source: string;
  owner: string;
  created_at: string;
};

export type CrmPresalesPack = {
  lead: PresalesLeadSlice;
  bant: PresalesBantSlice;
  tmmt: PresalesTmmtSlice;
  l2_ads: PresalesL2AdsSlice;
  contract: PresalesContractSlice;
  proposal: PresalesProposalSlice;
  insight: PresalesInsightSlice;
  hub_agency: PresalesHubAgencySlice;
};

export type CrmPresalesContextPack = {
  ok: true;
  wired: true;
  phase: 'P6' | 'P8';
  source: 'ptt-crm';
  as_of: string;
  tool: 'presales.context.read';
  client: { id: string; name: string; lifecycle: string };
  presales: CrmPresalesPack;
  known: string[];
  assumed: string[];
  unknown: string[];
  blockers_for_winning_plan: Array<{ code: string; detail: string }>;
  consult_ready?: boolean;
  winning_plan_ready?: boolean;
  consult_ready_blockers?: Array<{ code: string; detail: string }>;
  gate_copy?: { consult: string; winning: string };
  links: string[];
};

export type PresalesContextInput = {
  lifecycle_id?: number;
  lead_id?: number;
  plan_id?: number;
  client_id?: string;
};
