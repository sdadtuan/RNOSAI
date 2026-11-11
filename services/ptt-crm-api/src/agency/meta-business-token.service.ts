import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { decryptAccessToken, encryptAccessToken, TokenVaultError, vaultConfigured } from './token-vault.util';
import { MetaBusinessTokenRepository } from './meta-business-token.repository';
import {
  extractGraphErrorCode,
  noteGraphError,
  noteGraphHeaders,
  recordGraphCall,
  shouldPauseGraph,
} from '../portal/portal-graph-usage';
import { portalPageTokenCacheMs, shouldReuseFreshSync } from '../portal/portal-inbox-poller.util';

export type BusinessPage = { id: string; name: string };
export type BusinessCatalog = { pages: BusinessPage[]; ad_accounts: BusinessPage[] };

const GRAPH_PAGES = 'https://graph.facebook.com/v21.0/me/accounts';
const GRAPH_ACCOUNTS = 'https://graph.facebook.com/v21.0/me/adaccounts';

@Injectable()
export class MetaBusinessTokenService {
  private pageTokenCache: { at: number; tokens: Map<string, string> } | null = null;
  private pageTokenFlight: Promise<Map<string, string>> | null = null;
  private catalogCache: { at: number; value: BusinessCatalog } | null = null;
  private lastPageTokenError = '';

  constructor(private readonly repo: MetaBusinessTokenRepository) {}

  getLastPageTokenError(): string {
    return this.lastPageTokenError;
  }

  async status(): Promise<{ configured: boolean; updated_at: string | null }> {
    const row = await this.repo.read();
    return { configured: Boolean(row), updated_at: row ? row.updated_at.toISOString() : null };
  }

  async save(rawToken: string): Promise<{ ok: true; configured: true; updated_at: string }> {
    const token = rawToken.trim();
    if (token.length < 20) throw new BadRequestException({ error: 'invalid_business_token' });
    if (!vaultConfigured()) throw new BadRequestException({ error: 'vault_not_configured' });
    let encrypted: Buffer;
    try {
      encrypted = encryptAccessToken(token);
    } catch (err) {
      if (err instanceof TokenVaultError) throw new BadRequestException({ error: 'vault_not_configured' });
      throw err;
    }
    const updated = await this.repo.save(encrypted);
    this.pageTokenCache = null;
    this.catalogCache = null;
    this.lastPageTokenError = '';
    return { ok: true, configured: true, updated_at: updated.toISOString() };
  }

  async listPages(): Promise<BusinessPage[]> {
    return (await this.catalog()).pages;
  }

  /** Page tokens from the shared Business Manager token. Never returned to the client. */
  async pageTokens(): Promise<Map<string, string>> {
    const ttl = portalPageTokenCacheMs();
    const now = Date.now();
    if (this.pageTokenCache && shouldReuseFreshSync(this.pageTokenCache.at, now, ttl)) {
      return new Map(this.pageTokenCache.tokens);
    }
    if (shouldPauseGraph() && this.pageTokenCache) return new Map(this.pageTokenCache.tokens);
    if (this.pageTokenFlight) return this.pageTokenFlight;
    this.pageTokenFlight = this.loadPageTokens().finally(() => {
      this.pageTokenFlight = null;
    });
    return this.pageTokenFlight;
  }

  private async loadPageTokens(): Promise<Map<string, string>> {
    const stale = this.pageTokenCache ? new Map(this.pageTokenCache.tokens) : new Map<string, string>();
    const out = new Map<string, string>();
    let token: string;
    try {
      token = await this.requireToken();
    } catch {
      return stale;
    }
    if (shouldPauseGraph()) {
      this.lastPageTokenError = this.lastPageTokenError || 'Facebook tam dung goi API vi gan dat gioi han.';
      return stale.size ? stale : out;
    }
    let url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(token)}`;
    for (let hop = 0; hop < 5 && url; hop += 1) {
      let response: Response;
      try {
        recordGraphCall('me_accounts');
        response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      } catch {
        this.lastPageTokenError = 'Khong ket noi duoc Facebook de doc danh sach Page.';
        return stale.size ? stale : out;
      }
      noteGraphHeaders(response.headers);
      const body = (await response.json().catch(() => ({}))) as {
        data?: Array<{ id?: string; access_token?: string }>;
        paging?: { next?: string };
        error?: { message?: string; code?: number };
      };
      if (!response.ok) {
        const code = extractGraphErrorCode(body);
        const message = String(body.error?.message ?? `Facebook tu choi /me/accounts (${response.status})`);
        this.lastPageTokenError = message.slice(0, 160);
        noteGraphError(message, code);
        return stale.size ? stale : out;
      }
      for (const row of body.data ?? []) {
        const id = String(row.id ?? '').trim();
        const pageToken = String(row.access_token ?? '').trim();
        if (/^\d{6,32}$/.test(id) && pageToken) out.set(id, pageToken);
      }
      const next = body.paging?.next ?? '';
      url = next.startsWith('https://graph.facebook.com/') ? next : '';
    }
    this.pageTokenCache = { at: Date.now(), tokens: new Map(out) };
    this.lastPageTokenError = '';
    return out;
  }

  /** Business Manager token for server-side Graph (never log or expose). */
  async getAccessToken(): Promise<string> {
    return this.requireToken();
  }

  async catalog(): Promise<BusinessCatalog> {
    const ttl = portalPageTokenCacheMs();
    if (this.catalogCache && shouldReuseFreshSync(this.catalogCache.at, Date.now(), ttl)) {
      return this.catalogCache.value;
    }
    if (shouldPauseGraph() && this.catalogCache) return this.catalogCache.value;
    const token = await this.requireToken();
    const pages = await this.fetchCollection(token, GRAPH_PAGES, 'id');
    let ad_accounts: BusinessPage[] = [];
    try {
      ad_accounts = await this.fetchCollection(token, GRAPH_ACCOUNTS, 'account_id');
    } catch {
      ad_accounts = [];
    }
    const value = { pages, ad_accounts };
    this.catalogCache = { at: Date.now(), value };
    return value;
  }

  private async requireToken(): Promise<string> {
    const row = await this.repo.read();
    if (!row) throw new BadRequestException({ error: 'business_token_missing' });
    const token = decryptAccessToken(row.token);
    if (!token) throw new BadRequestException({ error: 'business_token_unreadable' });
    return token;
  }

  private async fetchCollection(token: string, endpoint: string, idField: 'id' | 'account_id'): Promise<BusinessPage[]> {
    const rows = new Map<string, string>();
    let url = `${endpoint}?fields=id,account_id,name&limit=100&access_token=${encodeURIComponent(token)}`;
    for (let hop = 0; hop < 10 && url; hop += 1) {
      let response: Response;
      try {
        recordGraphCall(endpoint.includes('adaccounts') ? 'me_adaccounts' : 'me_accounts');
        response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      } catch {
        throw new ServiceUnavailableException({ error: 'business_token_unreachable' });
      }
      noteGraphHeaders(response.headers);
      const body = (await response.json().catch(() => ({}))) as {
        data?: Array<{ id?: string; account_id?: string; name?: string }>;
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (!response.ok) {
        noteGraphError(String(body.error?.message ?? ''), extractGraphErrorCode(body));
        throw new BadRequestException({
          error: 'business_token_rejected',
          message: body.error?.message ?? 'Token Business Manager bị từ chối',
        });
      }
      for (const row of body.data ?? []) {
        const raw = idField === 'account_id' ? row.account_id || row.id : row.id;
        const id = String(raw ?? '').replace(/^act_/i, '').trim();
        if (/^\d{6,32}$/.test(id)) rows.set(id, String(row.name ?? '').trim());
      }
      const next = body.paging?.next ?? '';
      url = next.startsWith('https://graph.facebook.com/') ? next : '';
    }
    return [...rows.entries()].map(([id, name]) => ({ id, name }));
  }
}
