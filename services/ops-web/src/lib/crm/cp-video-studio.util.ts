import { dash } from './cp-format';

export const VIDEO_STUDIO_TABS = [
  { id: 'studio', label: 'Studio' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'ops', label: 'Ops' },
  { id: 'review', label: 'Review' },
  { id: 'batch', label: 'Batch' },
  { id: 'template', label: 'Template' },
  { id: 'version', label: 'Version' },
] as const;

export type VideoStudioTabId = (typeof VIDEO_STUDIO_TABS)[number]['id'];

export type StudioConfig = {
  aspect_ratio: string;
  duration_sec: number;
  resolution: string;
  style: string;
  language: string;
  voice_id: string;
  subtitle: boolean;
  music: string;
  model_id: string;
  auto_script: boolean;
  estimated_credits: string;
  source_url: string;
};

const RATIOS = ['9:16', '16:9', '1:1', '4:5'] as const;
const DURATIONS = [15, 30, 60] as const;

export function studioTabHref(
  tab: VideoStudioTabId,
  input: { videoId: string; scope: string; versionId?: string | null },
): string {
  const scope = `scope=${encodeURIComponent(input.scope)}`;
  const video = `/crm/creative-os/video/${encodeURIComponent(input.videoId)}`;
  if (tab === 'studio') return `${video}?${scope}`;
  if (tab === 'storyboard' || tab === 'timeline' || tab === 'review' || tab === 'version') {
    if ((tab === 'review' || tab === 'version') && input.versionId) {
      return `/crm/creative-os/video/versions/${encodeURIComponent(input.versionId)}?${scope}`;
    }
    return `${video}?${scope}&tab=${tab}`;
  }
  if (tab === 'ops') return `/crm/creative-os/video/ops?${scope}`;
  if (tab === 'batch') return `/crm/creative-os/video/batch?${scope}`;
  return `/crm/creative-os/video/templates?${scope}`;
}

export function promptMaxChars(policy: Record<string, unknown> | null | undefined): number {
  const value = Number(policy?.prompt_max_chars ?? policy?.max_chars);
  return Number.isFinite(value) && value > 0 ? value : 2000;
}

export function formatCharCount(length: number, max: number): string {
  return `${formatInt(length)} / ${formatInt(max)}`;
}

export function urlFieldState(settings: { policy_json?: Record<string, unknown> | null } | null | undefined): {
  disabled: boolean;
  reason: string | null;
} {
  if (settings?.policy_json?.url_extract === true) {
    return { disabled: false, reason: null };
  }
  return { disabled: true, reason: 'URL extract chưa mở — chờ legal (W2).' };
}

export function studioConfigFrom(value: unknown): StudioConfig {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const duration = Number(config.duration_sec ?? config.duration);
  const ratio = String(config.aspect_ratio ?? config.ratio ?? '9:16');
  return {
    aspect_ratio: (RATIOS as readonly string[]).includes(ratio) ? ratio : '9:16',
    duration_sec: (DURATIONS as readonly number[]).includes(duration) ? duration : 30,
    resolution: textOf(config.resolution),
    style: textOf(config.style),
    language: textOf(config.language) || textOf(config.locale) || 'vi-VN',
    voice_id: textOf(config.voice_id) || textOf(config.voice),
    subtitle: config.subtitle !== false,
    music: textOf(config.music),
    model_id: textOf(config.model_id) || textOf(config.model) || 'stub',
    auto_script: config.auto_script === true,
    estimated_credits: config.estimated_credits == null ? '' : String(config.estimated_credits),
    source_url: textOf(config.source_url),
  };
}

export function studioConfigPayload(config: StudioConfig): Record<string, unknown> {
  const credits = config.estimated_credits === '' ? null : Number(config.estimated_credits);
  return {
    ratio: config.aspect_ratio,
    aspect_ratio: config.aspect_ratio,
    duration: config.duration_sec,
    duration_sec: config.duration_sec,
    resolution: config.resolution || null,
    style: config.style || null,
    locale: config.language || null,
    language: config.language || null,
    voice: config.voice_id || null,
    voice_id: config.voice_id || null,
    subtitle: config.subtitle,
    music: config.music || null,
    model: config.model_id || null,
    model_id: config.model_id || null,
    auto_script: config.auto_script,
    estimated_credits: Number.isFinite(credits) ? credits : null,
    source_url: config.source_url || null,
  };
}

export function formatPlayhead(
  currentSec: number | null | undefined,
  durationSec: number | null | undefined,
): string {
  const duration = Number(durationSec);
  const end = Number.isFinite(duration) && duration > 0 ? formatClock(duration) : dash(null);
  if (currentSec == null || !Number.isFinite(Number(currentSec))) {
    return `${dash(null)} / ${end}`;
  }
  return `${formatClock(Number(currentSec))} / ${end}`;
}

export function formatEstimate(
  credits: number | null | undefined,
  watermarkDraft: boolean | null | undefined,
): string {
  const amount = credits == null || !Number.isFinite(Number(credits))
    ? dash(null)
    : `${formatInt(Number(credits))} cr`;
  const watermark = watermarkDraft === true ? 'ON' : watermarkDraft === false ? 'OFF' : dash(null);
  return `Ước tính ${amount} · watermark draft ${watermark}`;
}

export function studioJobs<T extends { draft_id?: string | null }>(
  items: T[],
  draftId: string,
): T[] {
  return items.filter((item) => String(item.draft_id ?? '') === draftId);
}

export function formatJobStatus(job: {
  state?: string | null;
  stage?: string | null;
  progress?: number | string | null;
}): string {
  if (job.state === 'failed') return 'Failed';
  const progress = Number(job.progress);
  const label = job.stage === 'encode' ? 'Encoding' : String(job.stage || job.state || '').trim();
  if (Number.isFinite(progress) && job.state !== 'completed') {
    return `${capitalize(label || 'Job')} ${Math.round(progress)}%`;
  }
  return capitalize(label) || dash(null);
}

export function draftAssets<T extends { project_id?: string | null }>(
  items: T[],
  projectId: string | null | undefined,
): T[] {
  if (!projectId) return [];
  return items.filter((item) => String(item.project_id ?? '') === projectId);
}

export function sceneStripLabel(scene: {
  idx?: number | null;
  title?: string | null;
  locked?: boolean | null;
}): string {
  const index = Number(scene.idx);
  const n = Number.isFinite(index) ? index + 1 : 1;
  const title = String(scene.title ?? '').trim() || dash(null);
  return scene.locked ? `${n} ${title} · lock` : `${n} ${title}`;
}

export function formatKitOption(kit: { name?: string | null; latest_version?: number | string | null }): string {
  const name = String(kit.name ?? '').trim() || dash(null);
  const version = kit.latest_version == null || kit.latest_version === '' ? '' : ` v${kit.latest_version}`;
  return `${name}${version}`;
}

export function modelOptions(models: Array<{ id?: string | null } | null | undefined> | null | undefined): Array<{
  id: string;
  label: string;
}> {
  const items = (models ?? [])
    .map((model) => String(model?.id ?? '').trim())
    .filter(Boolean)
    .map((id) => ({ id, label: id }));
  return items.length ? items : [{ id: 'stub', label: 'stub' }];
}

export function liveRenderBlocks(input: {
  aiEnabled: boolean;
  assets: Array<{ state?: string | null; rights_status?: string | null }>;
}): string[] {
  const reasons: string[] = [];
  if (!input.aiEnabled) reasons.push('AI tắt');
  if (input.assets.some((asset) => asset.state && asset.state !== 'ready')) {
    reasons.push('asset ≠ Ready');
  }
  if (input.assets.some((asset) => asset.rights_status === 'block')) {
    reasons.push('rights');
  }
  return reasons;
}

export function isStudioTab(value: string | null | undefined): value is VideoStudioTabId {
  return VIDEO_STUDIO_TABS.some((tab) => tab.id === value);
}

function formatInt(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function textOf(value: unknown): string {
  return value == null ? '' : String(value).trim();
}
