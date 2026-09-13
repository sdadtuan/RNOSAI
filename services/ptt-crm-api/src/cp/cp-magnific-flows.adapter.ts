import { HttpException, Injectable, Optional } from '@nestjs/common';
import {
  assertMagnificHttpStatus,
  logMagnificSafe,
  parseFlowDetail,
  parseFlowListItems,
  parseFlowResultMediaUrls,
  parseFlowRunIdentifier,
  parseFlowRunStatus,
  parseMagnificTerminalFailure,
  requireMagnificSecret,
  throwMagnificWaitFailed,
  MAGNIFIC_STATUS_TIMEOUT_MS,
  type MagnificFlowDetail,
  type MagnificFlowListItem,
} from './cp-magnific-http.util';
import {
  MAGNIFIC_SUBMIT_TIMEOUT_MS,
  type MagnificFetch,
} from './cp-magnific-mcp.adapter';

export type MagnificFlowRoutes = {
  base: string;
  list: string;
  get: (sqid: string) => string;
  run: (sqid: string) => string;
  runStatus: (runId: string) => string;
};

export type MagnificFlowsAdapterOptions = {
  getApiKey: () => Promise<string>;
  fetchImpl?: MagnificFetch;
  log?: (message: string) => void;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
};

export function magnificFlowRoutes(env: NodeJS.ProcessEnv = process.env): MagnificFlowRoutes {
  const base = String(
    env.MAGNIFIC_FLOWS_BASE ?? env.MAGNIFIC_REST_BASE ?? 'https://api.magnific.com',
  ).trim().replace(/\/$/, '');
  return {
    base,
    list: `${base}/v1/ai/flows`,
    get: (sqid: string) => `${base}/v1/ai/flows/${encodeURIComponent(sqid)}`,
    run: (sqid: string) => `${base}/v1/ai/flows/${encodeURIComponent(sqid)}/run`,
    runStatus: (runId: string) => `${base}/v1/ai/flows/runs/${encodeURIComponent(runId)}`,
  };
}

@Injectable()
export class CpMagnificFlowsAdapter {
  private readonly getApiKey: () => Promise<string>;
  private readonly fetchImpl: MagnificFetch;
  private readonly log?: (message: string) => void;
  private readonly waitTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => number;
  private readonly env: NodeJS.ProcessEnv;

  constructor(@Optional() options?: MagnificFlowsAdapterOptions) {
    this.getApiKey = options?.getApiKey ?? (async () => '');
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.log = options?.log;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? flowWaitMs(options?.env);
    this.pollIntervalMs = options?.pollIntervalMs ?? flowPollMs(options?.env);
    this.now = options?.now ?? Date.now;
    this.env = options?.env ?? process.env;
  }

  async listFlows(search?: string): Promise<MagnificFlowListItem[]> {
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const query = String(search ?? '').trim();
    const url = query ? `${routes.list}?search=${encodeURIComponent(query)}` : routes.list;
    const payload = await this.json('GET', url, key, undefined, MAGNIFIC_STATUS_TIMEOUT_MS);
    return parseFlowListItems(payload);
  }

  async getFlow(sqid: string): Promise<MagnificFlowDetail> {
    const id = String(sqid ?? '').trim();
    if (!id) {
      throw Object.assign(new HttpException({ error: 'invalid_flow_sqid' }, 400), {
        error: 'invalid_flow_sqid',
      });
    }
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const payload = await this.json('GET', routes.get(id), key, undefined, MAGNIFIC_STATUS_TIMEOUT_MS);
    const detail = parseFlowDetail(payload, id);
    if (!detail) {
      throw Object.assign(new HttpException({ error: 'magnific_flow_not_found' }, 502), {
        error: 'magnific_flow_not_found',
      });
    }
    return detail;
  }

  async runFlow(
    sqid: string,
    inputs: Record<string, unknown>,
    webhook?: string,
  ): Promise<{ workflowRunIdentifier: string }> {
    const id = String(sqid ?? '').trim();
    if (!id) {
      throw Object.assign(new HttpException({ error: 'invalid_flow_sqid' }, 400), {
        error: 'invalid_flow_sqid',
      });
    }
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const body: Record<string, unknown> = { inputs };
    const hook = String(webhook ?? '').trim();
    if (hook) body.webhook = hook;
    const payload = await this.json('POST', routes.run(id), key, body, MAGNIFIC_SUBMIT_TIMEOUT_MS);
    const workflowRunIdentifier = parseFlowRunIdentifier(payload);
    if (!workflowRunIdentifier) {
      throw Object.assign(new HttpException({ error: 'magnific_flow_run_failed' }, 502), {
        error: 'magnific_flow_run_failed',
      });
    }
    return { workflowRunIdentifier };
  }

  async getFlowRun(runId: string): Promise<{
    status: string;
    result?: { videos?: string[]; images?: string[] };
    error_message?: string;
  }> {
    const id = String(runId ?? '').trim();
    if (!id) {
      throw Object.assign(new HttpException({ error: 'invalid_flow_run_id' }, 400), {
        error: 'invalid_flow_run_id',
      });
    }
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const payload = await this.json(
      'GET',
      routes.runStatus(id),
      key,
      undefined,
      MAGNIFIC_STATUS_TIMEOUT_MS,
    );
    const status = parseFlowRunStatus(payload);
    const urls = parseFlowResultMediaUrls(payload);
    const rec = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const result = urls.length
      ? {
        videos: urls.filter((url) => /\.mp4|video/i.test(url)),
        images: urls.filter((url) => !/\.mp4|video/i.test(url)),
      }
      : undefined;
    const errorMessage = String(rec.error_message ?? rec.error ?? '').trim() || undefined;
    return {
      status,
      ...(result ? { result } : {}),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    };
  }

  async waitForRun(runId: string): Promise<{ outputUrls: string[]; status: string }> {
    const id = String(runId ?? '').trim();
    const deadline = this.now() + this.waitTimeoutMs;
    while (true) {
      const remaining = deadline - this.now();
      if (remaining <= 0) throwMagnificWaitFailed('wait_timeout');
      const payload = await this.getFlowRun(id);
      const failure = parseMagnificTerminalFailure({ status: payload.status, error: payload.error_message });
      if (failure) throwMagnificWaitFailed('vendor_failed');
      const urls = [
        ...(payload.result?.videos ?? []),
        ...(payload.result?.images ?? []),
      ].filter((url) => String(url ?? '').trim());
      if (urls.length) {
        return { outputUrls: urls, status: payload.status };
      }
      const status = String(payload.status ?? '').toLowerCase();
      if (['completed', 'complete', 'succeeded', 'success'].includes(status)) {
        throwMagnificWaitFailed('vendor_failed');
      }
      const sleepMs = Math.min(this.pollIntervalMs, Math.max(0, deadline - this.now()));
      if (sleepMs <= 0) throwMagnificWaitFailed('wait_timeout');
      await delay(sleepMs);
    }
  }

  private routes(): MagnificFlowRoutes {
    return magnificFlowRoutes(this.env);
  }

  private async json(
    method: string,
    url: string,
    key: string,
    body: Record<string, unknown> | undefined,
    timeoutMs: number,
  ): Promise<unknown> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        'X-Magnific-Api-Key': key,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    assertMagnificHttpStatus(res.status);
    if (!res.ok) {
      logMagnificSafe(this.log, `Magnific Flows ${method} ${url} failed status=${res.status}`, key);
      throw Object.assign(new HttpException({ error: 'magnific_upstream_failed' }, 502), {
        error: 'magnific_upstream_failed',
      });
    }
    return res.json();
  }
}

function flowWaitMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.MAGNIFIC_FLOW_WAIT_MS ?? '');
  if (Number.isFinite(raw) && raw > 0) return raw;
  const sec = Number(env.MAGNIFIC_VIDEO_WAIT_SEC ?? '');
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  return 600_000;
}

function flowPollMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.MAGNIFIC_FLOW_POLL_MS ?? '');
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 3_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
