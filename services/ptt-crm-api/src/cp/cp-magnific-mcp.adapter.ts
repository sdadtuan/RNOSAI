import { HttpException, Injectable, Optional } from '@nestjs/common';
import type { MagnificAdapterPort } from './cp-jobs.service';
import {
  assertMagnificHttpStatus,
  logMagnificSafe,
  assertMagnificDownloadAllowed,
  magnificDownloadAuthHeaders,
  parseActualCredits,
  parseCredits,
  parseExternalRunId,
  parseOutputUrls,
  readDownloadBody,
  requireMagnificSecret,
} from './cp-magnific-http.util';
import { mapMagnificTool } from './cp-magnific-policy.util';

export const MAGNIFIC_MCP_BASE = 'https://mcp.magnific.com';
export const MAGNIFIC_TOOLS_CACHE_MS = 15 * 60 * 1000;
export const MAGNIFIC_SUBMIT_TIMEOUT_MS = 60_000;
export const MAGNIFIC_VIDEO_WAIT_DEFAULT_MS = 600_000;

export type MagnificFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type MagnificMcpAdapterOptions = {
  getToken: () => Promise<string>;
  fetchImpl?: MagnificFetch;
  now?: () => number;
  log?: (message: string) => void;
  waitTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

@Injectable()
export class CpMagnificMcpAdapter implements MagnificAdapterPort {
  private readonly getToken: () => Promise<string>;
  private readonly fetchImpl: MagnificFetch;
  private readonly now: () => number;
  private readonly log?: (message: string) => void;
  private readonly waitTimeoutMs: number;
  private readonly env: NodeJS.ProcessEnv;
  private toolsCache: { names: string[]; expiresAt: number } | null = null;

  constructor(@Optional() options?: MagnificMcpAdapterOptions) {
    this.getToken = options?.getToken ?? (async () => '');
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.now = options?.now ?? Date.now;
    this.log = options?.log;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? MAGNIFIC_VIDEO_WAIT_DEFAULT_MS;
    this.env = options?.env ?? process.env;
  }

  async getBalance(): Promise<{ credits: number | null }> {
    const token = requireMagnificSecret(await this.getToken());
    const tools = await this.listTools(token);
    const name = mapMagnificTool('account_balance', tools);
    const payload = await this.callTool(token, name, {}, MAGNIFIC_SUBMIT_TIMEOUT_MS);
    return { credits: parseCredits(payload) };
  }

  async generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }> {
    const token = requireMagnificSecret(await this.getToken());
    const tools = await this.listTools(token);
    const name = mapMagnificTool(input.capability, tools);
    const payload = await this.callTool(
      token,
      name,
      input.inputs,
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
    const token = requireMagnificSecret(await this.getToken());
    const tools = await this.listTools(token);
    const name = mapMagnificTool('creations_wait', tools);
    const payload = await this.callTool(
      token,
      name,
      { id: externalRunId, run_id: externalRunId },
      this.waitTimeoutMs,
    );
    return {
      outputUrls: parseOutputUrls(payload),
      actualCredits: parseActualCredits(payload),
    };
  }

  async download(url: string): Promise<{ bytes: Buffer; mime: string }> {
    assertMagnificDownloadAllowed(url, this.env);
    const token = requireMagnificSecret(await this.getToken());
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: magnificDownloadAuthHeaders(url, token, this.env),
    });
    assertMagnificHttpStatus(res.status);
    if (!res.ok) {
      logMagnificSafe(this.log, `Magnific MCP download failed status=${res.status}`, token);
      throw Object.assign(new HttpException({ error: 'magnific_download_failed' }, 502), {
        error: 'magnific_download_failed',
      });
    }
    return readDownloadBody(res);
  }

  private async listTools(token: string): Promise<string[]> {
    const cached = this.toolsCache;
    if (cached && cached.expiresAt > this.now()) return cached.names;
    const payload = await this.rpc(token, 'tools/list', {}, MAGNIFIC_SUBMIT_TIMEOUT_MS);
    const result = payload.result && typeof payload.result === 'object'
      ? payload.result as Record<string, unknown>
      : payload;
    const tools = Array.isArray(result.tools) ? result.tools : [];
    const names = tools
      .map((tool) => {
        if (typeof tool === 'string') return tool;
        if (tool && typeof tool === 'object') {
          return String((tool as Record<string, unknown>).name ?? '');
        }
        return '';
      })
      .filter(Boolean);
    this.toolsCache = { names, expiresAt: this.now() + MAGNIFIC_TOOLS_CACHE_MS };
    return names;
  }

  private async callTool(
    token: string,
    name: string,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    return this.rpc(token, 'tools/call', { name, arguments: args }, timeoutMs);
  }

  private async rpc(
    token: string,
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(MAGNIFIC_MCP_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    assertMagnificHttpStatus(res.status);
    if (!res.ok) {
      logMagnificSafe(this.log, `Magnific MCP ${method} failed status=${res.status}`, token);
      throw Object.assign(new HttpException({ error: 'magnific_upstream_failed' }, 502), {
        error: 'magnific_upstream_failed',
      });
    }
    const payload = (await res.json()) as Record<string, unknown>;
    return payload && typeof payload === 'object' ? payload : {};
  }
}
