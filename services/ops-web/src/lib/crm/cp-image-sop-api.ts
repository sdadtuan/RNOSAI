import { CpApiError, cpFetch } from './cp-api';
import { OFF_CP_IMAGE_FLAGS, type CpImageSopFlags } from './cp-image-sop.flags';

export type ImgIntent =
  | 'hero_lifestyle'
  | 'product_lock'
  | 'text_cta'
  | 'upscale_print'
  | 'bg_cutout'
  | 'format_pack'
  | 'human_art'
  | 'i2v_handoff';

export type ImgStage = 'explore' | 'select' | 'refine' | 'upscale' | 'pack' | 'qc';

export type ImgRecipeStage = {
  stage: ImgStage;
  capability: string;
  provider: string;
  required?: boolean;
};

export type CpImageDashboardKpis = {
  approved_month: number | null;
  brief_to_approved_hours: number | null;
  cost_per_approved: number | null;
  first_pass_rate: number | null;
};

export type CpImageBoardColumn = {
  id: string;
  label: string;
  count: number | null;
  items: Array<{
    id: string;
    title: string;
    detail: string | null;
    intent: string | null;
    stage: string | null;
    status: string | null;
  }>;
};

export type CpImageJob = {
  id: string;
  sop_code: string | null;
  sop_name: string | null;
  intent: ImgIntent | string | null;
  stage: string | null;
  capability: string | null;
  credits: number | null;
  status: string | null;
};

export type CpImageAsset = {
  id: string;
  filename: string;
  status: string | null;
};

export type CpImageProvenanceEvent = {
  label: string;
  detail: string;
};

export type CpImageQcScores = Partial<
  Record<
    | 'technical'
    | 'product_fidelity'
    | 'brand_fit'
    | 'creative_fit'
    | 'text_cta_vn'
    | 'compliance'
    | 'delivery',
    number | null
  >
>;

export type CpImageReview = {
  asset_id: string;
  status: string | null;
  scores: CpImageQcScores;
  format_pack: Record<string, string | null> | null;
  comments: Array<{ at: string; author: string | null; body: string }>;
};

export type CpImageSop = {
  id?: string;
  code: string;
  name: string;
  status: string;
  version: string | null;
  intent: string | null;
  category?: string | null;
};

export type CpImageIntentRow = {
  intent: ImgIntent;
  capability: string;
  health: 'ok' | 'blocked' | 'fallback' | 'hidden';
  decision: string;
};

export type CpImageBrandGraph = {
  kit: { id: string; name: string } | null;
  rules: Array<{ rule_key: string; enforcement: string; effect?: string | null }>;
};

export type CpImageFinopsSummary = {
  charged: number | null;
  reserved: number | null;
  cost_per_approved: number | null;
  anomalies: number | null;
  by_provider: Array<{
    provider: string;
    generated: number | null;
    approved: number | null;
    credits: number | null;
  }>;
};

export type CpImageAuditItem = {
  at: string;
  title: string;
  detail: string;
};

export type CpImageProviderHealth = {
  providers: Array<{ id: string; label: string; detail: string | null; health: string }>;
};

export type CpImageSupplyChainRow = {
  title: string;
  subtitle: string | null;
  sop_label: string | null;
  sop_detail: string | null;
  progress_pct: number | null;
  progress_note: string | null;
  status: string | null;
  sla: string | null;
};

export type CpImageDraftInput = {
  agency_client_id: number;
  service_lifecycle_id?: string | null;
  sop_version_id: string;
  intent: ImgIntent;
  variants: number;
  creative_direction: string;
  idempotency_key: string;
};

export type CpImageDraftResult = {
  job_id: string;
  recipe: ImgRecipeStage[];
  estimate_credits: number | null;
  blocked_reason: string | null;
};

function imagePath(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `/image${suffix}`;
}

export function cpImageFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return cpFetch<T>(token, imagePath(path), init);
}

export async function getCpImageFlags(token: string): Promise<CpImageSopFlags> {
  try {
    return await cpImageFetch<CpImageSopFlags>(token, '/flags');
  } catch (error) {
    if (error instanceof CpApiError && error.status === 404) {
      return OFF_CP_IMAGE_FLAGS;
    }
    return OFF_CP_IMAGE_FLAGS;
  }
}

export function getCpImageDashboardKpis(token: string) {
  return cpImageFetch<{ kpis: CpImageDashboardKpis }>(token, '/dashboard/kpis');
}

export function getCpImageSupplyChain(token: string) {
  return cpImageFetch<{ items: CpImageSupplyChainRow[] }>(token, '/dashboard/supply-chain');
}

export function getCpImageProviderHealth(token: string) {
  return cpImageFetch<CpImageProviderHealth>(token, '/dashboard/provider-health');
}

export function getCpImageGovernanceAuditFeed(token: string) {
  return cpImageFetch<{ items: CpImageAuditItem[] }>(token, '/governance/audit');
}

export function getCpImageOperationsBoard(token: string, cpProjectId?: string) {
  const query = cpProjectId ? `?cp_project_id=${encodeURIComponent(cpProjectId)}` : '';
  return cpImageFetch<{ columns: CpImageBoardColumn[] }>(token, `/operations/board${query}`);
}

export function listCpImageJobs(token: string) {
  return cpImageFetch<{ items: CpImageJob[] }>(token, '/jobs');
}

export function draftCpImageJob(token: string, input: CpImageDraftInput) {
  return cpImageFetch<CpImageDraftResult>(token, '/jobs/draft', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function previewCpImageRecipe(
  token: string,
  input: { intent: ImgIntent; sop_version_id?: string | null },
) {
  return cpImageFetch<{ stages: ImgRecipeStage[]; blocked_reason: string | null }>(
    token,
    '/recipes/preview',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listCpImageAssets(token: string) {
  return cpImageFetch<{ items: CpImageAsset[] }>(token, '/assets');
}

export function getCpImageAssetProvenance(token: string, assetId: string) {
  return cpImageFetch<{ events: CpImageProvenanceEvent[] }>(
    token,
    `/assets/${encodeURIComponent(assetId)}/provenance`,
  );
}

export function getCpImageReview(token: string, assetId: string) {
  return cpImageFetch<CpImageReview>(token, `/review/${encodeURIComponent(assetId)}`);
}

export function listCpImageSops(token: string) {
  return cpImageFetch<{ items: CpImageSop[] }>(token, '/sops');
}

export function createCpImageSop(
  token: string,
  input: {
    code: string;
    name: string;
    category: string;
    data_class: string;
    outcome: string;
  },
) {
  return cpImageFetch<{ id: string }>(token, '/sops', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function saveCpImageSopVersion(
  token: string,
  sopId: string,
  input: {
    version: string;
    manifest_json: Record<string, unknown>;
    creative_genome: Record<string, unknown>;
    prompt_package_id?: string | null;
  },
) {
  return cpImageFetch<{ version_id: string }>(
    token,
    `/sops/${encodeURIComponent(sopId)}/versions`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getCpImageBrandGraph(token: string, kitId: string) {
  return cpImageFetch<CpImageBrandGraph>(token, `/brand/${encodeURIComponent(kitId)}/graph`);
}

export function listCpImageIntents(token: string) {
  return cpImageFetch<{ items: CpImageIntentRow[] }>(token, '/intents');
}

export function previewCpImageRouter(
  token: string,
  input: { intent: ImgIntent; data_class?: string },
) {
  return cpImageFetch<{ stages: ImgRecipeStage[]; blocked_reason: string | null }>(
    token,
    '/providers/router/preview',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getCpImageFinopsSummary(token: string) {
  return cpImageFetch<CpImageFinopsSummary>(token, '/finops/summary');
}

export function getCpImageGovernanceAudit(token: string) {
  return cpImageFetch<{ items: CpImageAuditItem[] }>(token, '/governance/audit');
}
