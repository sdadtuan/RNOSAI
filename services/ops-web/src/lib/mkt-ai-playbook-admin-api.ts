import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function adminFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await parseJson<
    T & {
      error?: string;
      message?: string;
      remaining?: number;
    }
  >(res);
  if (!res.ok) {
    const detail = body.message ?? body.error ?? 'Yêu cầu admin playbook thất bại';
    throw new ApiError(detail, res.status);
  }
  return body;
}

export type MktAiRollout = 'off' | 'pilot' | 'ga';

export type MktAiPlaybookVersionStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'active'
  | 'retired'
  | 'rejected_auto';

export type MktAiPlaybookVersionDepth = 'shipped' | 'shallow' | 'deep';

export type MktAiServicePolicyRow = {
  service_slug: string;
  rollout: MktAiRollout;
  enabled: boolean;
  active_version_id: number | null;
  strict_pilot_quality: boolean;
  updated_at: string;
  updated_by: string;
};

export type MktAiPlaybookVersionRow = {
  id: number;
  service_slug: string;
  version_no: number;
  status: MktAiPlaybookVersionStatus;
  depth: MktAiPlaybookVersionDepth;
  document_json: Record<string, unknown>;
  source: 'disk' | 'common' | 'learn' | 'manual';
  learn_job_id: number | null;
  corpus_json: Record<string, unknown>;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type MktAiPlaybookLearnJobRow = {
  id: number;
  service_slug: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  actor: string;
  error: string | null;
  output_version_id: number | null;
  created_at: string;
  finished_at: string | null;
};

export type MktAiCorpusRow = {
  lifecycle_id: number;
  quality_score: number;
  stage: string;
  closed_loop_win: boolean;
  has_tier3_artifact: boolean;
};

export type MktAiCorpusSummary = {
  candidate_count: number;
  winner_count: number;
  can_learn: boolean;
  remaining: number;
  depth: 'shallow' | 'deep';
  rows: MktAiCorpusRow[];
};

export type MktAiPlaybookAdminListItem = {
  service_slug: string;
  label_vi: string;
  policy: MktAiServicePolicyRow | null;
  active_version: MktAiPlaybookVersionRow | null;
  corpus: Omit<MktAiCorpusSummary, 'rows'>;
};

export type MktAiPlaybookListResponse = {
  ok: true;
  items: MktAiPlaybookAdminListItem[];
};

export type MktAiPlaybookDetailResponse = {
  ok: true;
  service_slug: string;
  label_vi: string;
  policy: MktAiServicePolicyRow | null;
  active_version: MktAiPlaybookVersionRow | null;
  versions: MktAiPlaybookVersionRow[];
  corpus: MktAiCorpusSummary;
  learn_jobs: MktAiPlaybookLearnJobRow[];
  fallback_playbook_slug: string;
};

export function canViewMktAiPlaybookAdmin(
  user: { caps?: Array<{ section: string; action: string }> } | null,
): boolean {
  if (!user?.caps?.length) return false;
  return user.caps.some(
    (c) =>
      (c.section === 'crm_mkt_ai' && (c.action === 'view' || c.action === 'approve')) ||
      (c.section === 'ai_admin' && c.action === 'view'),
  );
}

export async function fetchMktAiPlaybookList(token: string): Promise<MktAiPlaybookListResponse> {
  return adminFetch(token, '/api/v1/admin/mkt-ai/playbooks');
}

export async function fetchMktAiPlaybookDetail(
  token: string,
  slug: string,
): Promise<MktAiPlaybookDetailResponse> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/${encodeURIComponent(slug)}`);
}

export async function patchMktAiPlaybookPolicy(
  token: string,
  slug: string,
  patch: Partial<Pick<MktAiServicePolicyRow, 'rollout' | 'enabled'>>,
): Promise<{ ok: true; service_slug: string; policy: MktAiServicePolicyRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/${encodeURIComponent(slug)}/policy`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function enqueueMktAiPlaybookLearn(
  token: string,
  slug: string,
  excludeLifecycleIds: number[] = [],
): Promise<{ job_id: number; status: MktAiPlaybookLearnJobRow['status'] }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/${encodeURIComponent(slug)}/learn`, {
    method: 'POST',
    body: JSON.stringify({ exclude_lifecycle_ids: excludeLifecycleIds }),
  });
}

export async function fetchMktAiPlaybookLearnJob(
  token: string,
  slug: string,
  jobId: number,
): Promise<{ ok: true; job: MktAiPlaybookLearnJobRow }> {
  return adminFetch(
    token,
    `/api/v1/admin/mkt-ai/playbooks/${encodeURIComponent(slug)}/learn/${jobId}`,
  );
}

export async function patchMktAiPlaybookVersionDocument(
  token: string,
  versionId: number,
  documentJson: Record<string, unknown>,
): Promise<{ ok: true; version: MktAiPlaybookVersionRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/versions/${versionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ document_json: documentJson }),
  });
}

export async function submitMktAiPlaybookVersion(
  token: string,
  versionId: number,
): Promise<{ ok: true; version: MktAiPlaybookVersionRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/versions/${versionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function decideMktAiPlaybookVersion(
  token: string,
  versionId: number,
  body: { decision: 'approve' | 'request_changes'; note?: string },
): Promise<{ ok: true; version: MktAiPlaybookVersionRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/versions/${versionId}/decide`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function activateMktAiPlaybookVersion(
  token: string,
  versionId: number,
  body: { self_approve?: boolean; note?: string; accept_shallow?: boolean } = {},
): Promise<{ ok: true; version: MktAiPlaybookVersionRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/versions/${versionId}/activate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function rollbackMktAiPlaybookVersion(
  token: string,
  versionId: number,
): Promise<{ ok: true; version: MktAiPlaybookVersionRow }> {
  return adminFetch(token, `/api/v1/admin/mkt-ai/playbooks/versions/${versionId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rolloutLabelVi(rollout: MktAiRollout | null | undefined): string {
  if (rollout === 'pilot') return 'Pilot';
  if (rollout === 'ga') return 'GA';
  return 'Tắt';
}

export function versionStatusLabelVi(status: MktAiPlaybookVersionStatus): string {
  const map: Record<MktAiPlaybookVersionStatus, string> = {
    draft: 'Nháp',
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    active: 'Đang active',
    retired: 'Ngưng',
    rejected_auto: 'Từ chối (auto)',
  };
  return map[status] ?? status;
}

export function depthLabelVi(depth: MktAiPlaybookVersionDepth): string {
  if (depth === 'deep') return 'Sâu';
  if (depth === 'shallow') return 'Nông';
  return 'Shipped';
}

export function learnJobStatusLabelVi(status: MktAiPlaybookLearnJobRow['status']): string {
  const map: Record<MktAiPlaybookLearnJobRow['status'], string> = {
    queued: 'Đang chờ',
    running: 'Đang chạy',
    succeeded: 'Thành công',
    failed: 'Thất bại',
  };
  return map[status] ?? status;
}
