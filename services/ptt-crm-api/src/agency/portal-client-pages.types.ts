export interface PortalClientPage {
  id: string;
  client_id: string;
  channel: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'ad_account';
  page_id: string;
  page_name: string;
  active: boolean;
  created_at: string;
}

export interface PortalClientPagesListResponse {
  ok: true;
  client_id: string;
  pages: PortalClientPage[];
}

export interface PortalPageLead {
  id: string;
  page_id: string;
  external_lead_id: string;
  full_name: string;
  phone: string;
  email: string;
  campaign_name: string;
  campaign_id: string;
  created_at: string;
}

export interface PortalPageMessage {
  id: string;
  page_id: string;
  sender_name: string;
  body: string;
  received_at: string;
}

export interface PortalPageReportRow {
  performance_date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads_platform: number;
}

export interface PortalPageCampaign {
  external_campaign_id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface PortalPageCreative {
  id: string;
  status: string;
}

export interface PortalPageWorkspace {
  ok: true;
  enabled: true;
  client_id: string;
  page: PortalClientPage;
  lead_store: 'portal_page_leads';
  leads: PortalPageLead[];
  messages: PortalPageMessage[];
  reports: PortalPageReportRow[];
  campaigns: PortalPageCampaign[];
  creatives: PortalPageCreative[];
}
