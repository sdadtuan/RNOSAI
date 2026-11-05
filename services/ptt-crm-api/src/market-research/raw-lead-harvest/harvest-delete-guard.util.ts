/**
 * Helpers for BR-18 / Task 13 — block hard-delete when harvest jobs still
 * snapshot the Admin lookup / provider / model / credential.
 */

export type HarvestJobSnapshotRef = {
  industry_key?: string | null;
  job_title_key?: string | null;
  provider?: string | null;
  model?: string | null;
  credential_id?: number | null;
  sources_json?: Array<{ key: string }> | null;
  channels_json?: Array<{ key: string }> | null;
};

export function isLeadLookupReferencedInJobs(
  kind: string,
  optionKey: string,
  jobs: HarvestJobSnapshotRef[],
): boolean {
  const key = String(optionKey ?? '');
  if (!key) return false;
  for (const job of jobs) {
    if (kind === 'industry' && job.industry_key === key) return true;
    if (kind === 'job_title' && job.job_title_key === key) return true;
    if (kind === 'source' && (job.sources_json ?? []).some((s) => s.key === key)) return true;
    if (kind === 'channel' && (job.channels_json ?? []).some((s) => s.key === key)) return true;
  }
  return false;
}

export function isProviderCodeReferencedInJobs(
  providerCode: string,
  jobs: HarvestJobSnapshotRef[],
): boolean {
  const code = String(providerCode ?? '');
  return Boolean(code) && jobs.some((j) => j.provider === code);
}

export function isModelIdReferencedInJobs(
  modelId: string,
  jobs: HarvestJobSnapshotRef[],
): boolean {
  const id = String(modelId ?? '');
  return Boolean(id) && jobs.some((j) => j.model === id);
}

export function isCredentialIdReferencedInJobs(
  credentialId: number,
  jobs: HarvestJobSnapshotRef[],
): boolean {
  return jobs.some((j) => Number(j.credential_id) === Number(credentialId));
}
