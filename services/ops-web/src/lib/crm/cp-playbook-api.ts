import { cpFetch } from './cp-api';

export type CpPlaybookSummary = {
  id: string;
  line: string;
  label: string;
  template_slug: string;
  qc_pack: string;
  channels: string[];
  vars: string[];
  source: string;
  sop_handoff?: boolean;
};

export type CpPlaybookRunInput = {
  source?: string;
  rows?: Array<Record<string, string>>;
  re_project_id?: number;
  product_ids?: number[];
};

export type CpPlaybookRunResult = {
  batch_id: string;
  href: string;
  valid_count: number;
  invalid_count: number;
};

export type CpReHandoffResult = {
  cp_project_id: string;
  batch_id: string;
  href: string;
};

export function listCpPlaybooks(token: string) {
  return cpFetch<CpPlaybookSummary[]>(token, '/playbooks');
}

export function getCpPlaybook(token: string, id: string) {
  return cpFetch<CpPlaybookSummary>(token, `/playbooks/${encodeURIComponent(id)}`);
}

export type CpPlaybookCloneResult = {
  id: string;
  name: string;
  status: string;
  version?: number;
};

export function cloneCpPlaybookTemplate(
  token: string,
  id: string,
  input: { name?: string; agency_client_id?: string | null } = {},
) {
  return cpFetch<CpPlaybookCloneResult>(
    token,
    `/playbooks/${encodeURIComponent(id)}/clone-template`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function runCpPlaybook(token: string, id: string, input: CpPlaybookRunInput) {
  return cpFetch<CpPlaybookRunResult>(token, `/playbooks/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reProjectCpHandoff(
  token: string,
  reProjectId: number,
  input: { playbook_id?: string; product_ids?: number[] } = {},
) {
  return cpFetch<CpReHandoffResult>(
    token,
    `/re-projects/${reProjectId}/cp-handoff`,
    {
      method: 'POST',
      body: JSON.stringify({
        playbook_id: input.playbook_id ?? 'bds_social_916',
        product_ids: input.product_ids,
      }),
    },
  );
}

export function autoScriptCpVideo(token: string, videoId: string) {
  return cpFetch<Record<string, unknown>>(token, `/videos/${videoId}/auto-script`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type CpSopIngestInput = {
  project_id: string;
  name: string;
  output_uri: string;
  draft_id?: string;
  playbook_id?: string;
  facts?: Record<string, unknown>;
};

export function ingestCpVideoFromSop(token: string, input: CpSopIngestInput) {
  return cpFetch<{ draft_id: string; version_id: string; href: string }>(
    token,
    '/videos/sop-ingest',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
