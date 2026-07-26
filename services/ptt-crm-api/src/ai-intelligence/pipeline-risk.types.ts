export interface PipelineRiskScanRequest {
  limit?: number;
  actorId?: string | null;
  correlationId?: string;
}

export interface PipelineRiskScanResult {
  scanned: number;
  at_risk_found: number;
  alerts_created: number;
  alerts_skipped: number;
  alerts_cleared: number;
  agent_run_id: string;
  scanned_at: string;
}

export interface PipelineRiskDealRow {
  deal_id: number;
  title: string;
  pipeline_stage: string;
  stalled_days: number;
  deal_score: number;
  score_band: string;
  recommendation_id: string;
  staff_name: string | null;
  customer_name: string | null;
  scanned_at: string;
  status: string;
}

export interface PipelineRiskListResult {
  deals: PipelineRiskDealRow[];
  total: number;
  last_scan_at: string | null;
}

export interface PipelineRiskScanResponse {
  data: PipelineRiskScanResult;
  meta: { request_id: string };
  errors: [];
}

export interface PipelineRiskListResponse {
  data: PipelineRiskListResult;
  meta: { request_id: string };
  errors: [];
}
