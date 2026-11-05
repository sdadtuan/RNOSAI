import { HttpException, Injectable, Optional } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { throwMagnificWaitFailed } from './cp-magnific-http.util';
import { MAGNIFIC_VIDEO_WAIT_DEFAULT_MS } from './cp-magnific-mcp.adapter';

export const COMFY_STATS_TIMEOUT_MS = 5_000;
export const COMFY_HISTORY_GET_TIMEOUT_MS = 15_000;
export const COMFY_WAIT_POLL_MS = 3_000;
export const COMFY_WAIT_DEFAULT_MS = MAGNIFIC_VIDEO_WAIT_DEFAULT_MS;

export type ComfyFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CpComfyAdapterOptions = {
  fetchImpl?: ComfyFetch;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
};

export type ComfyProviderHealth =
  | { comfy: { ok: true; vram_mb: number | null; checked_at: string } }
  | { comfy: { ok: false; reason: 'gpu_building'; checked_at?: string } };

@Injectable()
export class CpComfyAdapter {
  private readonly fetchImpl: ComfyFetch;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private readonly waitTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(@Optional() options?: CpComfyAdapterOptions) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.env = options?.env ?? process.env;
    this.now = options?.now ?? Date.now;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? readWaitMs(this.env);
    this.pollIntervalMs = options?.pollIntervalMs ?? readPollMs(this.env);
  }

  async systemStats(): Promise<{ vram_mb: number | null; ok: boolean }> {
    if (!this.workerEnabled()) return { ok: false, vram_mb: null };
    try {
      const res = await this.gatewayFetch('/system_stats', { method: 'GET' }, COMFY_STATS_TIMEOUT_MS);
      if (!res.ok) return { ok: false, vram_mb: null };
      return { ok: true, vram_mb: parseVramMb(await res.json()) };
    } catch {
      return { ok: false, vram_mb: null };
    }
  }

  async prompt(jobId: string, boundWorkflow: unknown): Promise<{ promptId: string }> {
    this.assertWorkerEnabled();
    const stats = await this.systemStats();
    if (!stats.ok) throwWorkerUnavailable();
    const res = await this.gatewayFetch('/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: boundWorkflow,
        client_id: `ptt-${jobId}`,
      }),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      if (isOomText(text)) throwOom();
      throwWorkerUnavailable();
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      throwWorkerUnavailable();
    }
    const promptId = String(payload.prompt_id ?? '').trim();
    if (!promptId) throwWorkerUnavailable();
    return { promptId };
  }

  async history(promptId: string): Promise<{ outputFiles: string[] }> {
    this.assertWorkerEnabled();
    const deadline = this.now() + this.waitTimeoutMs;
    while (true) {
      const remaining = deadline - this.now();
      if (remaining <= 0) throwMagnificWaitFailed('wait_timeout');
      const res = await this.gatewayFetch(
        `/history/${encodeURIComponent(promptId)}`,
        { method: 'GET' },
        Math.min(COMFY_HISTORY_GET_TIMEOUT_MS, Math.max(1, remaining)),
      );
      if (!res.ok) throwWorkerUnavailable();
      const rec = unwrapHistory(await res.json(), promptId);
      if (isOomHistory(rec)) throwOom();
      if (isFailedHistory(rec)) throwMagnificWaitFailed('vendor_failed');
      const outputFiles = parseOutputFiles(rec);
      if (outputFiles.length) return { outputFiles };
      const sleepMs = Math.min(this.pollIntervalMs, Math.max(0, deadline - this.now()));
      if (sleepMs <= 0) throwMagnificWaitFailed('wait_timeout');
      await delay(sleepMs);
    }
  }

  async interrupt(promptId: string): Promise<void> {
    this.assertWorkerEnabled();
    await this.gatewayFetch('/interrupt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt_id: promptId }),
    });
  }

  async download(fileRef: string): Promise<{ bytes: Buffer; mime: string }> {
    this.assertWorkerEnabled();
    const res = await this.gatewayFetch(viewPathFor(fileRef), { method: 'GET' });
    if (!res.ok) {
      const body = {
        error: 'ASSET_SYNC_FAILED',
        error_class: 'ASSET_SYNC_FAILED',
        reason: 'empty_download',
      };
      throw Object.assign(new HttpException(body, 409), body);
    }
    const mime = String(res.headers.get('content-type') ?? 'application/octet-stream')
      .split(';')[0]
      .trim();
    return { bytes: Buffer.from(await res.arrayBuffer()), mime };
  }

  async providerHealth(): Promise<ComfyProviderHealth> {
    if (!this.workerEnabled()) {
      return { comfy: { ok: false, reason: 'gpu_building' } };
    }
    const checked_at = new Date(this.now()).toISOString();
    const stats = await this.systemStats();
    if (!stats.ok) {
      return { comfy: { ok: false, reason: 'gpu_building', checked_at } };
    }
    return { comfy: { ok: true, vram_mb: stats.vram_mb, checked_at } };
  }

  private workerEnabled(): boolean {
    return readAiOpsFlags(this.env).comfy;
  }

  private assertWorkerEnabled(): void {
    if (!this.workerEnabled()) throwWorkerUnavailable();
  }

  private gatewayBase(): string {
    return String(this.env.COMFYUI_GATEWAY_URL ?? '').trim().replace(/\/+$/, '');
  }

  private async gatewayFetch(
    path: string,
    init: RequestInit,
    timeoutMs = 30_000,
  ): Promise<Response> {
    const base = this.gatewayBase();
    if (!base) throwWorkerUnavailable();
    const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function throwWorkerUnavailable(): never {
  const body = { error: 'WORKER_UNAVAILABLE', gate: 'GT-C01' };
  throw Object.assign(new HttpException(body, 409), body);
}

function throwOom(): never {
  const body = { error: 'OUT_OF_MEMORY' };
  throw Object.assign(new HttpException(body, 409), body);
}

function isOomText(value: unknown): boolean {
  return /out of memory|\boom\b|cuda out of memory/i.test(String(value ?? ''));
}

function isOomHistory(rec: Record<string, unknown>): boolean {
  return isOomText(JSON.stringify(rec.status ?? rec));
}

function isFailedHistory(rec: Record<string, unknown>): boolean {
  if (isOomHistory(rec)) return false;
  const status = rec.status;
  if (!status || typeof status !== 'object' || Array.isArray(status)) return false;
  const recStatus = status as Record<string, unknown>;
  const str = String(recStatus.status_str ?? recStatus.status ?? '').toLowerCase();
  return str === 'error' || str === 'failed';
}

function readWaitMs(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.COMFY_WAIT_MS ?? '');
  if (Number.isFinite(raw) && raw > 0) return raw;
  return COMFY_WAIT_DEFAULT_MS;
}

function readPollMs(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.COMFY_POLL_MS ?? '');
  if (Number.isFinite(raw) && raw > 0) return raw;
  return COMFY_WAIT_POLL_MS;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseVramMb(payload: unknown): number | null {
  const root = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const devices = Array.isArray(root.devices) ? root.devices : [];
  const first = devices[0] && typeof devices[0] === 'object'
    ? devices[0] as Record<string, unknown>
    : {};
  const raw = Number(first.vram_total ?? first.vram_free);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const mb = raw >= 1_000_000 ? raw / (1024 * 1024) : raw;
  return Math.round(mb);
}

function unwrapHistory(payload: unknown, promptId: string): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const rec = payload as Record<string, unknown>;
  const nested = rec[promptId];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return rec;
}

function parseOutputFiles(rec: Record<string, unknown>): string[] {
  const outputs = rec.outputs;
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) return [];
  const files: string[] = [];
  for (const node of Object.values(outputs as Record<string, unknown>)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    for (const key of ['images', 'gifs', 'videos', 'files']) {
      const items = (node as Record<string, unknown>)[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item === 'string' && item.trim()) {
          files.push(item.trim());
          continue;
        }
        if (!item || typeof item !== 'object') continue;
        const filename = String((item as { filename?: unknown }).filename ?? '').trim();
        if (!filename) continue;
        const subfolder = String((item as { subfolder?: unknown }).subfolder ?? '');
        const type = String((item as { type?: unknown }).type ?? 'output') || 'output';
        const qs = new URLSearchParams({ filename, type });
        if (subfolder) qs.set('subfolder', subfolder);
        files.push(qs.toString());
      }
    }
  }
  return files;
}

function viewPathFor(fileRef: string): string {
  const ref = String(fileRef ?? '').trim();
  if (!ref) return '/view';
  if (ref.startsWith('/view')) return ref;
  if (ref.includes('filename=')) return `/view?${ref.replace(/^\?/, '')}`;
  return `/view?filename=${encodeURIComponent(ref)}&type=output`;
}
