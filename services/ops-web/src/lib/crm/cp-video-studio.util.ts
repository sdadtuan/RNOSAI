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

export type StudioAssets = {
  reference_ids: string[];
  logo_id: string | null;
};

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
  brand_colors: string[];
  studio_assets: StudioAssets;
};

const RATIOS = ['9:16', '16:9', '1:1', '4:5'] as const;
const DURATIONS = [15, 30, 60] as const;

export const STUDIO_RATIO_OPTIONS = [
  { id: '9:16', label: '9:16', hint: 'Reels / TikTok' },
  { id: '16:9', label: '16:9', hint: 'YouTube / TV' },
  { id: '1:1', label: '1:1', hint: 'Feed vuông' },
  { id: '4:5', label: '4:5', hint: 'Feed dọc' },
] as const;

export const STUDIO_DURATION_OPTIONS = [15, 30, 60] as const;

export const STUDIO_STYLE_CARDS = [
  { id: 'Cinematic luxury', label: 'Cinematic', hint: 'ánh sáng film' },
  { id: 'Social clean', label: 'Luxury', hint: 'premium social' },
  { id: 'UGC handheld', label: 'Motion Graphic', hint: 'dynamic text' },
] as const;

export const STUDIO_DEFAULT_PROMPT_TAGS = [
  'Bất động sản',
  'Spa & làm đẹp',
  'Tuyển sinh',
  'Sự kiện',
] as const;

export const STUDIO_PLAYBOOK_PROMPT_TAGS: Record<string, readonly string[]> = {
  bds_social_916: ['Bất động sản', 'Căn hộ cao cấp', 'Tour ảo', 'CTA đăng ký'],
  lead_social_916: ['Lead gen', 'Form CRM', 'UGC', 'Hook mạnh'],
  tvc_short_169: ['Brand TVC', 'Tagline', 'Legal disclaimer', 'Cinematic'],
};

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
    brand_colors: studioBrandColorsFrom(config.brand_colors),
    studio_assets: studioAssetsFrom(config),
  };
}

export function studioAssetsFrom(value: unknown): StudioAssets {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const raw = config.studio_assets;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { reference_ids: [], logo_id: null };
  }
  const assets = raw as Record<string, unknown>;
  const reference = Array.isArray(assets.reference_ids)
    ? assets.reference_ids.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const logo = assets.logo_id == null || assets.logo_id === ''
    ? null
    : String(assets.logo_id).trim();
  return { reference_ids: [...new Set(reference)], logo_id: logo || null };
}

export function studioAssetsPayload(assets: StudioAssets): Record<string, unknown> {
  return {
    reference_ids: assets.reference_ids,
    logo_id: assets.logo_id,
  };
}

export function studioAssetIds(assets: StudioAssets): string[] {
  const ids = [...assets.reference_ids];
  if (assets.logo_id) ids.push(assets.logo_id);
  return [...new Set(ids)];
}

export function addReferenceAsset(assets: StudioAssets, assetId: string): StudioAssets {
  const id = assetId.trim();
  if (!id || assets.reference_ids.includes(id) || assets.logo_id === id) return assets;
  return { ...assets, reference_ids: [...assets.reference_ids, id] };
}

export function setLogoAsset(assets: StudioAssets, assetId: string | null): StudioAssets {
  const id = assetId?.trim() || null;
  return {
    ...assets,
    logo_id: id,
    reference_ids: id ? assets.reference_ids.filter((item) => item !== id) : assets.reference_ids,
  };
}

export function removeStudioAsset(assets: StudioAssets, assetId: string): StudioAssets {
  const id = assetId.trim();
  return {
    reference_ids: assets.reference_ids.filter((item) => item !== id),
    logo_id: assets.logo_id === id ? null : assets.logo_id,
  };
}

export function promptSuggestionTags(playbookId: string | null | undefined): string[] {
  if (playbookId && STUDIO_PLAYBOOK_PROMPT_TAGS[playbookId]) {
    return [...STUDIO_PLAYBOOK_PROMPT_TAGS[playbookId]];
  }
  return [...STUDIO_DEFAULT_PROMPT_TAGS];
}

export function appendPromptSuggestion(prompt: string, tag: string): string {
  const trimmed = prompt.trim();
  const snippet = `${tag}: `;
  if (!trimmed) return snippet;
  if (trimmed.includes(tag)) return trimmed;
  return `${trimmed}\n${snippet}`;
}

export function mediaLibraryHref(
  projectId: string | null | undefined,
  scope: string,
  kind?: 'image' | 'video' | 'ingest',
): string {
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (projectId) params.set('project', projectId);
  if (kind === 'ingest') params.set('tab', 'ingest');
  const qs = params.toString();
  return `/crm/creative-os/media${qs ? `?${qs}` : ''}`;
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
    brand_colors: config.brand_colors?.length ? config.brand_colors : null,
    studio_assets: studioAssetsPayload(config.studio_assets ?? studioAssetsFrom({})),
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

export type StudioSceneCard = PreviewSceneSlot & {
  idx: number;
  tStart: number;
  tEnd: number;
};

export type StudioRenderRow = {
  id: string;
  jobLabel: string;
  title: string;
  specs: string;
  progress: number | null;
  statusLabel: string;
  statusKind: 'running' | 'done' | 'failed' | 'queued' | 'cancelled';
  etaLabel: string | null;
  cancellable: boolean;
};

export function previewSceneSlots(
  scenes: Array<{ idx?: number | null; title?: string | null; locked?: boolean | null }>,
  durationSec: number,
): PreviewSceneSlot[] {
  return studioSceneCards(scenes, durationSec).map(({ key, title, hint, locked, placeholder }) => ({
    key,
    title,
    hint,
    locked,
    placeholder,
  }));
}

export function studioSceneCards(
  scenes: Array<{
    idx?: number | null;
    title?: string | null;
    locked?: boolean | null;
    t_start?: number | null;
    t_end?: number | null;
  }>,
  durationSec: number,
): StudioSceneCard[] {
  if (scenes.length) {
    return scenes.slice(0, 6).map((scene, index) => {
      const idx = Number.isFinite(Number(scene.idx)) ? Number(scene.idx) : index;
      const tStart = Number(scene.t_start);
      const tEnd = Number(scene.t_end);
      const start = Number.isFinite(tStart) ? tStart : null;
      const end = Number.isFinite(tEnd) ? tEnd : null;
      return {
        key: `scene-${scene.idx ?? index}`,
        idx,
        title: sceneStripLabel({ ...scene, locked: false }),
        hint: scene.locked ? 'lock' : formatSceneRange(start, end),
        tStart: start ?? 0,
        tEnd: end ?? start ?? 0,
        locked: scene.locked === true,
        placeholder: false,
      };
    });
  }
  const duration = Number(durationSec);
  const end = Number.isFinite(duration) && duration > 0 ? duration : 30;
  const hookEnd = end <= 15 ? 3 : end <= 30 ? 5 : 6;
  const bodyEnd = end <= 15 ? 10 : end <= 30 ? 15 : Math.max(hookEnd + 8, end - 15);
  const ctaStart = end <= 15 ? 10 : end <= 30 ? 15 : bodyEnd;
  return [
    {
      key: 'hook',
      idx: 0,
      title: 'Cảnh 01 · Hook',
      hint: formatSceneRange(0, hookEnd),
      tStart: 0,
      tEnd: hookEnd,
      locked: false,
      placeholder: true,
    },
    {
      key: 'body',
      idx: 1,
      title: 'Cảnh 02 · Benefit',
      hint: formatSceneRange(hookEnd, bodyEnd),
      tStart: hookEnd,
      tEnd: bodyEnd,
      locked: false,
      placeholder: true,
    },
    {
      key: 'utility',
      idx: 2,
      title: 'Cảnh 03 · Utility',
      hint: formatSceneRange(bodyEnd, ctaStart),
      tStart: bodyEnd,
      tEnd: ctaStart,
      locked: false,
      placeholder: true,
    },
    {
      key: 'cta',
      idx: 3,
      title: 'Cảnh 04 · CTA',
      hint: formatSceneRange(ctaStart, end),
      tStart: ctaStart,
      tEnd: end,
      locked: false,
      placeholder: true,
    },
  ];
}

export function timelineMarks(durationSec: number): number[] {
  const duration = Number(durationSec);
  const end = Number.isFinite(duration) && duration > 0 ? duration : 30;
  const step = end <= 15 ? 3 : end <= 30 ? 5 : 10;
  const marks: number[] = [0];
  for (let t = step; t < end; t += step) marks.push(t);
  marks.push(end);
  return marks;
}

export function renderJobCancellable(state: string | null | undefined): boolean {
  const value = String(state ?? '').toLowerCase();
  return value === 'queued' || value === 'running' || value === 'processing' || value === 'draft';
}

export function formatRenderRemaining(
  progress: number | null | undefined,
  durationSec: number,
): string | null {
  const pct = Number(progress);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
  const duration = Number(durationSec);
  const total = Number.isFinite(duration) && duration > 0 ? duration : 30;
  const remaining = Math.max(15, Math.round((total * (100 - pct)) / 100));
  if (remaining >= 60) {
    const mm = Math.floor(remaining / 60);
    const ss = remaining % 60;
    return `Còn ${mm} phút ${ss} giây`;
  }
  return `Còn ${remaining} giây`;
}

export function studioRenderRows(input: {
  jobs: Array<{
    id: string;
    job_id?: string | null;
    state?: string | null;
    stage?: string | null;
    progress?: number | string | null;
  }>;
  draftName: string;
  config: Pick<StudioConfig, 'duration_sec' | 'aspect_ratio' | 'model_id'>;
}): StudioRenderRow[] {
  return input.jobs.map((job) => {
    const progress = Number(job.progress);
    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : null;
    const state = String(job.state ?? '').toLowerCase();
    let statusKind: StudioRenderRow['statusKind'] = 'queued';
    let statusLabel = formatJobStatus(job);
    if (state === 'completed') {
      statusKind = 'done';
      statusLabel = 'Hoàn tất';
    } else if (state === 'failed') {
      statusKind = 'failed';
      statusLabel = 'Thất bại';
    } else if (state === 'cancelled') {
      statusKind = 'cancelled';
      statusLabel = 'Đã hủy';
    } else if (state === 'running' || state === 'processing' || pct != null) {
      statusKind = 'running';
      statusLabel = 'Đang render';
    }
    return {
      id: job.id,
      jobLabel: String(job.job_id ?? job.id),
      title: input.draftName || 'Video draft',
      specs: `${input.config.duration_sec}s · ${input.config.aspect_ratio} · ${formatModelLabel(input.config.model_id)}`,
      progress: pct,
      statusLabel,
      statusKind,
      etaLabel: statusKind === 'running' ? formatRenderRemaining(pct, input.config.duration_sec) : null,
      cancellable: renderJobCancellable(job.state),
    };
  });
}

export function studioBrandPalette(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const row = payload as Record<string, unknown>;
  const palette = row.palette;
  if (!Array.isArray(palette)) return [];
  return palette
    .map((item) => String(item ?? '').trim())
    .filter((item) => /^#[0-9a-f]{3,8}$/i.test(item))
    .slice(0, 4);
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

function studioBrandColorsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => /^#[0-9a-f]{3,8}$/i.test(item))
    .slice(0, 4);
}

function formatSceneRange(start: number | null, end: number | null): string {
  if (start == null && end == null) return '';
  const a = start == null ? 0 : start;
  const b = end == null ? a : end;
  return `${formatClock(a)}–${formatClock(b)}`;
}
