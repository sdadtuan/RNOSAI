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

export function formatModelLabel(id: string): string {
  if (id === 'stub') return 'Stub · demo (AI thật chưa bật)';
  if (id === 'stub-pro') return 'Stub Pro · pricing 2026-09';
  return id;
}

export const STUDIO_STYLE_PRESETS = [
  'Cinematic luxury',
  'Social clean',
  'UGC handheld',
  'Documentary',
] as const;

export const STUDIO_MUSIC_PRESETS = [
  { id: '', label: 'Không nhạc nền' },
  { id: 'soft-piano', label: 'Piano nhẹ' },
  { id: 'upbeat-social', label: 'Social upbeat' },
  { id: 'ambient-luxury', label: 'Ambient luxury' },
] as const;

export const STUDIO_VOICE_PRESETS = [
  { locale: 'vi-VN', voice: 'nu-am', label: 'vi-VN · Nữ ấm' },
  { locale: 'vi-VN', voice: 'nam-tram', label: 'vi-VN · Nam trầm' },
  { locale: 'en-US', voice: 'neutral', label: 'en-US · Neutral' },
] as const;

export function voicePresetValue(locale: string, voice: string): string {
  return `${locale}|${voice}`;
}

export function parseVoicePreset(value: string): { locale: string; voice: string } {
  const [locale, voice] = value.split('|');
  return { locale: locale || 'vi-VN', voice: voice || '' };
}

export type PreviewSceneSlot = {
  key: string;
  title: string;
  hint: string;
  locked: boolean;
  placeholder: boolean;
};

export function previewSceneSlots(
  scenes: Array<{ idx?: number | null; title?: string | null; locked?: boolean | null }>,
  durationSec: number,
): PreviewSceneSlot[] {
  if (scenes.length) {
    return scenes.slice(0, 6).map((scene, index) => ({
      key: `scene-${scene.idx ?? index}`,
      title: sceneStripLabel({ ...scene, locked: false }),
      hint: scene.locked ? 'lock' : '',
      locked: scene.locked === true,
      placeholder: false,
    }));
  }
  const duration = Number(durationSec);
  const end = Number.isFinite(duration) && duration > 0 ? duration : 30;
  const hookEnd = end <= 15 ? 3 : end <= 30 ? 4 : 6;
  const bodyEnd = end <= 15 ? 10 : end <= 30 ? 18 : Math.max(hookEnd + 8, end - 20);
  return [
    { key: 'hook', title: '1 Hook', hint: `0–${hookEnd}s`, locked: false, placeholder: true },
    { key: 'body', title: '2 Body', hint: `${hookEnd}–${bodyEnd}s`, locked: false, placeholder: true },
    { key: 'cta', title: '3 CTA', hint: `${bodyEnd}–${end}s`, locked: false, placeholder: true },
  ];
}

export type StudioGateItem = {
  id: 'ai' | 'asset' | 'rights';
  ok: boolean;
  label: string;
  hint: string;
};

export function studioGateItems(input: {
  aiEnabled: boolean;
  assets: Array<{ state?: string | null; rights_status?: string | null }>;
}): StudioGateItem[] {
  const blocks = liveRenderBlocks(input);
  return [
    {
      id: 'ai',
      ok: !blocks.includes('AI tắt'),
      label: 'AI production',
      hint: input.aiEnabled ? 'Sẵn sàng reserve' : 'Chưa bật — job chạy stub',
    },
    {
      id: 'asset',
      ok: !blocks.includes('asset ≠ Ready'),
      label: 'Asset Ready',
      hint: 'Logo / VO / B-roll phải Ready',
    },
    {
      id: 'rights',
      ok: !blocks.includes('rights'),
      label: 'Bản quyền',
      hint: 'Không render khi rights = block',
    },
  ];
}

export function modelOptions(
  models: Array<{ id?: string | number | null } | null | undefined> | null | undefined,
): Array<{
  id: string;
  label: string;
}> {
  const items = (models ?? [])
    .map((model) => String(model?.id ?? '').trim())
    .filter(Boolean)
    .map((id) => ({ id, label: formatModelLabel(id) }));
  return items.length ? items : [{ id: 'stub', label: formatModelLabel('stub') }];
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

export type StudioPreviewItem = {
  id: string;
  kind: 'version' | 'asset' | 'render';
  label: string;
  createdAt: string | null;
  assetId: string | null;
  mime: string;
  durationSec: number | null;
  state: string | null;
  playable: boolean;
  versionN: number | null;
};

export const STUDIO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function mergeStudioPreviews(input: {
  versions?: Array<{
    id?: string | null;
    kind?: string | null;
    version_n?: number | string | null;
    created_at?: string | null;
    label?: string | null;
    state?: string | null;
    asset_id?: string | null;
    mime?: string | null;
    duration_ms?: number | string | null;
    duration_sec?: number | string | null;
    playable?: boolean | null;
    approval_status?: string | null;
    output_uri?: string | null;
  }>;
  assets?: Array<{
    id?: string | null;
    filename?: string | null;
    mime?: string | null;
    state?: string | null;
    created_at?: string | null;
  }>;
}): StudioPreviewItem[] {
  const seen = new Set<string>();
  const items: StudioPreviewItem[] = [];

  for (const version of input.versions ?? []) {
    const id = String(version.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const n = Number(version.version_n);
    const mime = String(version.mime ?? '');
    const assetId = version.asset_id ? String(version.asset_id) : null;
    const playable = typeof version.playable === 'boolean'
      ? version.playable
      : Boolean(assetId && (mime || 'video/mp4').startsWith('video/'));
    items.push({
      id,
      kind: version.kind === 'asset' || version.kind === 'render' ? version.kind : 'version',
      label: String(version.label ?? '').trim()
        || (Number.isFinite(n) ? `v${String(n).padStart(2, '0')}` : 'Version'),
      createdAt: version.created_at ?? null,
      assetId,
      mime: mime || 'video/mp4',
      durationSec: previewDurationSec(version),
      state: version.state ?? version.approval_status ?? null,
      playable,
      versionN: Number.isFinite(n) ? n : null,
    });
    if (assetId) seen.add(assetId);
  }

  for (const asset of input.assets ?? []) {
    const id = String(asset.id ?? '').trim();
    const mime = String(asset.mime ?? '');
    if (!id || seen.has(id) || seen.has(`asset:${id}`) || !mime.startsWith('video/')) continue;
    seen.add(id);
    items.push({
      id,
      kind: 'asset',
      label: String(asset.filename ?? '').trim() || 'Asset',
      createdAt: asset.created_at ?? null,
      assetId: id,
      mime,
      durationSec: null,
      state: asset.state ?? null,
      playable: asset.state === 'ready',
      versionN: null,
    });
  }

  return items.sort((a, b) => {
    const na = a.versionN ?? -1;
    const nb = b.versionN ?? -1;
    if (na !== nb) return nb - na;
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

export function defaultPreviewId(items: StudioPreviewItem[]): string | null {
  const playable = items.find((item) => item.playable);
  return playable?.id ?? items[0]?.id ?? null;
}

export function formatPreviewMeta(item: StudioPreviewItem): string {
  if (!item.playable) return 'Chưa có file';
  if (item.durationSec != null && Number.isFinite(item.durationSec) && item.durationSec > 0) {
    return formatClock(item.durationSec);
  }
  return 'Sẵn sàng xem';
}

export function studioViewerCommand(
  key: string,
): 'toggle' | 'back' | 'fwd' | 'mute' | 'fullscreen' | null {
  if (key === ' ' || key === 'k' || key === 'K') return 'toggle';
  if (key === 'ArrowLeft' || key === 'j' || key === 'J') return 'back';
  if (key === 'ArrowRight' || key === 'l' || key === 'L') return 'fwd';
  if (key === 'm' || key === 'M') return 'mute';
  if (key === 'f' || key === 'F') return 'fullscreen';
  return null;
}

export function clampPreviewSeek(current: number, delta: number, duration: number): number {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return Math.min(Math.max(0, current + delta), end);
}

function previewDurationSec(input: {
  duration_ms?: number | string | null;
  duration_sec?: number | string | null;
}): number | null {
  const ms = Number(input.duration_ms);
  if (Number.isFinite(ms) && ms > 0) return ms / 1000;
  const sec = Number(input.duration_sec);
  if (Number.isFinite(sec) && sec > 0) return sec;
  return null;
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
