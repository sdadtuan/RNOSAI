import type {
  PortalResearchReportCard,
  PortalResearchReportDetail,
} from '../market-research/market-research.types';

export type { PortalResearchReportCard, PortalResearchReportDetail };

export type PortalResearchVersionRecord = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  generated_by: string | null;
  content_hash: string;
  embargo_until: string | null;
  expires_at: string | null;
  portal_visible: boolean;
  created_at: string;
  client_id: string;
};
