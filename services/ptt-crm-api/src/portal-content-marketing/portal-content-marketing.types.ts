export type CmktPortalApprovalPackage = {
  id: number;
  status: string;
  created_at: string;
  snapshot_json: Record<string, unknown>;
};

export type CmktPortalSummaryItem = {
  id: number;
  title: string;
  channel: string;
  format: string;
  status: string;
  updated_at: string;
  approval_package?: CmktPortalApprovalPackage;
};

export type CmktPortalContentSummary = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  items_by_status: Record<string, number>;
  pending_client_count: number;
  published_mtd: number;
  pending_items: CmktPortalSummaryItem[];
  staff_content_url: string;
};
