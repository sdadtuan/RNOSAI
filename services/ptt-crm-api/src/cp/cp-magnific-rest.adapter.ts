import { HttpException, Injectable, Optional } from '@nestjs/common';
import type { MagnificAdapterPort } from './cp-jobs.service';
import {
  assertMagnificHttpStatus,
  logMagnificSafe,
  MAGNIFIC_STATUS_TIMEOUT_MS,
  MAGNIFIC_WAIT_POLL_MS,
  assertMagnificDownloadAllowed,
  magnificDownloadAuthHeaders,
  parseActualCredits,
  parseCredits,
  parseExternalRunId,
  parseMagnificTerminalFailure,
  parseOutputUrls,
  readDownloadBody,
  requireMagnificSecret,
  throwMagnificWaitFailed,
} from './cp-magnific-http.util';
import {
  MAGNIFIC_SUBMIT_TIMEOUT_MS,
  MAGNIFIC_VIDEO_WAIT_DEFAULT_MS,
  type MagnificFetch,
} from './cp-magnific-mcp.adapter';

export type MagnificRestRoutes = {
  base: string;
  balance: string;
  generate: string;
  status: (id: string) => string;
};

export type MagnificRestAdapterOptions = {
  getApiKey: () => Promise<string>;
  fetchImpl?: MagnificFetch;
  log?: (message: string) => void;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
};

export function magnificRestRoutes(env: NodeJS.ProcessEnv = process.env): MagnificRestRoutes {
  const base = String(env.MAGNIFIC_REST_BASE ?? '').trim().replace(/\/$/, '');
  const balancePath = String(env.MAGNIFIC_REST_BALANCE_PATH ?? '/account/balance').trim();
  const generatePath = String(env.MAGNIFIC_REST_GENERATE_PATH ?? '/generations').trim();
  const statusPath = String(env.MAGNIFIC_REST_STATUS_PATH ?? '/generations/{id}').trim();
  return {
    base,
    balance: joinUrl(base, balancePath),
    generate: joinUrl(base, generatePath),
    status: (id: string) => joinUrl(base, statusPath.split('{id}').join(encodeURIComponent(id))),
  };
}

@Injectable()
export class CpMagnificRestAdapter implements MagnificAdapterPort {
  private readonly getApiKey: () => Promise<string>;
  private readonly fetchImpl: MagnificFetch;
  private readonly log?: (message: string) => void;
  private readonly waitTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => number;
  private readonly env: NodeJS.ProcessEnv;

  constructor(@Optional() options?: MagnificRestAdapterOptions) {
    this.getApiKey = options?.getApiKey ?? (async () => '');
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.log = options?.log;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? MAGNIFIC_VIDEO_WAIT_DEFAULT_MS;
    this.pollIntervalMs = options?.pollIntervalMs ?? MAGNIFIC_WAIT_POLL_MS;
    this.now = options?.now ?? Date.now;
    this.env = options?.env ?? process.env;
  }

  async getBalance(): Promise<{ credits: number | null }> {
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const payload = await this.json('GET', routes.balance, key, undefined, MAGNIFIC_SUBMIT_TIMEOUT_MS);
    return { credits: parseCredits(payload) };
  }

  async generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }> {
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const payload = await this.json(
      'POST',
      routes.generate,
      key,
      { capability: input.capability, inputs: input.inputs },
      MAGNIFIC_SUBMIT_TIMEOUT_MS,
    );
    const externalRunId = parseExternalRunId(payload);
    if (!externalRunId) {
      throw Object.assign(new HttpException({ error: 'magnific_generate_failed' }, 502), {
        error: 'magnific_generate_failed',
      });
    }
    return { externalRunId };
  }

  async wait(externalRunId: string): Promise<{ outputUrls: string[]; actualCredits: number | null }> {
    const key = requireMagnificSecret(await this.getApiKey());
    const routes = this.routes();
    const deadline = this.now() + this.waitTimeoutMs;
    while (true) {
      const remaining = deadline - this.now();
      if (remaining <= 0) throwMagnificWaitFailed('wait_timeout');
      const payload = await this.json(
        'GET',
        routes.status(externalRunId),
        key,
        undefined,
        Math.min(MAGNIFIC_STATUS_TIMEOUT_MS, Math.max(1, remaining)),
      );
      if (parseMagnificTerminalFailure(payload)) {
        throwMagnificWaitFailed('vendor_failed');
      }
      const outputUrls = parseOutputUrls(payload);
      if (outputUrls.length) {
        return {
          outputUrls,
          actualCredits: parseActualCredits(payload),
        };
      }
      const sleepMs = Math.min(this.pollIntervalMs, Math.max(0, deadline - this.now()));
      if (sleepMs <= 0) throwMagnificWaitFailed('wait_timeout');
      await delay(sleepMs);
    }
  }

  async download(url: string): Promise<{ bytes: Buffer; mime: string }> {
    assertMagnificDownloadAllowed(url, this.env);
    const key = requireMagnificSecret(await this.getApiKey());
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: magnificDownloadAuthHeaders(url, key, this.env),
    });
    assertMagnificHttpStatus(res.status);
    if (!res.ok) {
      logMagnificSafe(this.log, `Magnific REST download failed status=${res.status}`, key);
      throw Object.assign(new HttpException({ error: 'magnific_download_failed' }, 502), {
        error: 'magnific_download_failed',
      });
    }
    return readDownloadBody(res);
  }

  private routes(): MagnificRestRoutes {
    const routes = magnificRestRoutes(this.env);
    if (!routes.base) {
      throw Object.assign(new HttpException({ error: 'magnific_rest_not_configured' }, 503), {
        error: 'magnific_rest_not_configured',
      });
    }
    return routes;
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
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    assertMagnificHttpStatus(res.status);
    if (!res.ok) {
      logMagnificSafe(this.log, `Magnific REST ${method} ${url} failed status=${res.status}`, key);
      throw Object.assign(new HttpException({ error: 'magnific_upstream_failed' }, 502), {
        error: 'magnific_upstream_failed',
      });
    }
    return res.json();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function joinUrl(base: string, path: string): string {
  const prefix = String(base ?? '').replace(/\/$/, '');
  const suffix = String(path ?? '').replace(/^\//, '');
  if (!prefix) return `/${suffix}`;
  return `${prefix}/${suffix}`;
}
