import { HttpException, Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import {
  createMagnificOAuthState,
  encryptProviderSecret,
  redactConnectionRow,
  verifyMagnificOAuthState,
} from './cp-magnific-oauth.util';

export const CP_CONNECTIONS_QUERY = 'CP_CONNECTIONS_QUERY';
export const CP_SECRET_ENCRYPT = 'CP_SECRET_ENCRYPT';
export const CP_MAGNIFIC_TOKEN_EXCHANGE = 'CP_MAGNIFIC_TOKEN_EXCHANGE';

const MAGNIFIC_AUTHORIZE_DEFAULT = 'https://mcp.magnific.com/oauth/authorize';
const MAGNIFIC_TOKEN_DEFAULT = 'https://mcp.magnific.com/oauth/token';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CpConnectionsQueryPort = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export type CpSecretEncryptor = (plaintext: string) => string;

export type CpMagnificTokenExchange = (code: string) => Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  account_label?: string;
}>;

export type CpRedactedConnection = ReturnType<typeof redactConnectionRow>;

@Injectable()
export class CpProviderConnectionsRepository
  implements CpConnectionsQueryPort, OnModuleDestroy
{
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpProviderConnectionsService {
  private readonly encryptSecret: CpSecretEncryptor;
  private readonly exchangeCode: CpMagnificTokenExchange;

  constructor(
    @Inject(CP_CONNECTIONS_QUERY) private readonly db: CpConnectionsQueryPort,
    @Optional() @Inject(CP_SECRET_ENCRYPT) encryptSecret?: CpSecretEncryptor,
    @Optional() @Inject(CP_MAGNIFIC_TOKEN_EXCHANGE) exchangeCode?: CpMagnificTokenExchange,
  ) {
    this.encryptSecret = encryptSecret ?? encryptProviderSecret;
    this.exchangeCode = exchangeCode ?? exchangeMagnificAuthorizationCode;
  }

  async list(): Promise<{ items: CpRedactedConnection[] }> {
    const result = await this.db.query(
      `SELECT id, provider, status, account_label, secret_ref, expires_at
         FROM crm_cp_provider_connections
        WHERE tenant_id = $1
        ORDER BY provider, created_at`,
      [CP_TENANT_ID],
    );
    return { items: result.rows.map((row) => redactConnectionRow(row)) };
  }

  async saveRestKey(
    staffId: number,
    input: { api_key?: string },
  ): Promise<CpRedactedConnection> {
    const apiKey = String(input.api_key ?? '').trim();
    if (!apiKey) cpThrow(400, { error: 'api_key_required' });
    const secretRef = this.encryptSecret(apiKey);
    if (secretRef === apiKey) {
      cpThrow(503, { error: 'secret_key_missing' });
    }
    return this.upsertConnection({
      provider: 'magnific_rest',
      status: 'on',
      account_label: 'Magnific REST',
      secretRef,
      expiresAt: null,
      staffId,
    });
  }

  async startMagnificOAuth(staffId: number): Promise<{
    authorize_url: string;
    expires_at: string;
  }> {
    const { clientId, redirectUri, authorizeUrl } = magnificOAuthConfig();
    const { state, expiresAt } = createMagnificOAuthState({ staffId });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    const scope = (process.env.MAGNIFIC_OAUTH_SCOPE ?? '').trim();
    if (scope) params.set('scope', scope);
    return {
      authorize_url: `${authorizeUrl}?${params.toString()}`,
      expires_at: expiresAt.toISOString(),
    };
  }

  async completeMagnificOAuth(
    input: { code?: string; state?: string },
    staffId: number,
  ): Promise<CpRedactedConnection & { redirect_url: string }> {
    const code = String(input.code ?? '').trim();
    const state = String(input.state ?? '').trim();
    if (!code || !state) cpThrow(400, { error: 'oauth_code_state_required' });
    let verified: { staffId: number };
    try {
      verified = verifyMagnificOAuthState(state);
    } catch {
      cpThrow(400, { error: 'invalid_oauth_state' });
    }
    if (verified.staffId !== staffId) {
      cpThrow(403, { error: 'oauth_staff_mismatch' });
    }
    const tokens = await this.exchangeCode(code);
    const access = String(tokens.access_token ?? '').trim();
    if (!access) cpThrow(502, { error: 'magnific_oauth_exchange_failed' });
    const secretRef = this.encryptSecret(JSON.stringify({
      access_token: access,
      refresh_token: String(tokens.refresh_token ?? '').trim() || undefined,
    }));
    const expiresAt = tokens.expires_in && Number.isFinite(tokens.expires_in)
      ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
      : null;
    const connection = await this.upsertConnection({
      provider: 'magnific_mcp',
      status: 'on',
      account_label: tokens.account_label?.trim() || 'Magnific MCP',
      secretRef,
      expiresAt,
      staffId,
    });
    return { ...connection, redirect_url: magnificSettingsRedirect('ok') };
  }

  async disconnect(id: string): Promise<CpRedactedConnection> {
    const connectionId = String(id ?? '').trim();
    if (!UUID_RE.test(connectionId)) cpThrow(400, { error: 'invalid_id' });
    const result = await this.db.query(
      `UPDATE crm_cp_provider_connections
          SET status = 'off',
              secret_ref = NULL,
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING id, provider, status, account_label, secret_ref, expires_at`,
      [CP_TENANT_ID, connectionId],
    );
    const row = result.rows[0];
    if (!row) cpThrow(404, { error: 'connection_not_found' });
    return redactConnectionRow(row);
  }

  private async upsertConnection(input: {
    provider: 'magnific_mcp' | 'magnific_rest';
    status: string;
    account_label: string | null;
    secretRef: string;
    expiresAt: Date | null;
    staffId: number;
  }): Promise<CpRedactedConnection> {
    const existing = await this.db.query(
      `SELECT id
         FROM crm_cp_provider_connections
        WHERE tenant_id = $1 AND provider = $2
        LIMIT 1`,
      [CP_TENANT_ID, input.provider],
    );
    if (existing.rows[0]?.id) {
      const updated = await this.db.query(
        `UPDATE crm_cp_provider_connections
            SET status = $1,
                account_label = $2,
                secret_ref = $3,
                expires_at = $4,
                updated_at = now()
          WHERE tenant_id = $5 AND provider = $6
          RETURNING id, provider, status, account_label, secret_ref, expires_at`,
        [
          input.status,
          input.account_label,
          input.secretRef,
          input.expiresAt,
          CP_TENANT_ID,
          input.provider,
        ],
      );
      return redactConnectionRow(updated.rows[0] ?? {});
    }
    const inserted = await this.db.query(
      `INSERT INTO crm_cp_provider_connections (
         provider, status, account_label, secret_ref, expires_at, created_by_staff_id
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, provider, status, account_label, secret_ref, expires_at`,
      [
        input.provider,
        input.status,
        input.account_label,
        input.secretRef,
        input.expiresAt,
        input.staffId,
      ],
    );
    return redactConnectionRow(inserted.rows[0] ?? {});
  }
}

function magnificOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
} {
  const clientId = (process.env.MAGNIFIC_OAUTH_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.MAGNIFIC_OAUTH_CLIENT_SECRET ?? '').trim();
  const redirectUri = (process.env.MAGNIFIC_OAUTH_REDIRECT_URI ?? '').trim();
  if (!clientId || !clientSecret || !redirectUri) {
    cpThrow(503, { error: 'magnific_oauth_not_configured' });
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: (process.env.MAGNIFIC_OAUTH_AUTHORIZE_URL ?? '').trim() || MAGNIFIC_AUTHORIZE_DEFAULT,
    tokenUrl: (process.env.MAGNIFIC_OAUTH_TOKEN_URL ?? '').trim() || MAGNIFIC_TOKEN_DEFAULT,
  };
}

async function exchangeMagnificAuthorizationCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  account_label?: string;
}> {
  const { clientId, clientSecret, redirectUri, tokenUrl } = magnificOAuthConfig();
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  const access = String(data.access_token ?? '').trim();
  if (!res.ok || !access) {
    cpThrow(502, { error: 'magnific_oauth_exchange_failed' });
  }
  return {
    access_token: access,
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : undefined,
    expires_in: data.expires_in != null ? Number(data.expires_in) : undefined,
    account_label: data.account_label != null ? String(data.account_label) : undefined,
  };
}

export function magnificSettingsRedirect(status: 'ok' | 'error', reason?: string): string {
  const base = (process.env.PTT_OPS_WEB_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  const params = new URLSearchParams({ tab: 'integrations', magnific_oauth: status });
  if (reason) params.set('reason', reason);
  return `${base}/crm/creative-os/settings?${params.toString()}`;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
