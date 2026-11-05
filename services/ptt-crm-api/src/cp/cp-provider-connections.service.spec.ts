import { CpProviderConnectionsService } from './cp-provider-connections.service';

const CONNECTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class ConnectionsMemory {
  rows: Record<string, unknown>[] = [];
  inserts: unknown[][] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('INSERT INTO crm_cp_provider_connections')) {
      this.inserts.push(params);
      const row = {
        id: CONNECTION_ID,
        tenant_id: 'PTT',
        provider: params[0],
        status: params[1],
        account_label: params[2] ?? null,
        secret_ref: params[3],
        expires_at: params[4] ?? null,
        created_by_staff_id: params[5],
      };
      this.rows = this.rows.filter((item) => item.provider !== params[0]);
      this.rows.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_provider_connections') && sql.includes("status = 'off'")) {
      const current = this.rows.find((row) => row.id === params[0]);
      if (!current) return { rows: [] };
      current.status = 'off';
      current.secret_ref = null;
      return { rows: [current] };
    }
    if (sql.includes('FROM crm_cp_provider_connections')) {
      const rows = sql.includes('provider =') && params[1]
        ? this.rows.filter((row) => row.provider === params[1])
        : this.rows;
      return { rows: rows.map((row) => ({ ...row })) };
    }
    return { rows: [] };
  }
}

function snapshotJson(value: unknown): string {
  return JSON.stringify(value);
}

describe('CpProviderConnectionsService', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = { ...envBackup, PTT_SECRET_ENCRYPT_KEY: 'a'.repeat(32) };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('persists a rest-key through the encrypt stub and never stores plaintext', async () => {
    const db = new ConnectionsMemory();
    const encrypt = jest.fn().mockReturnValue('enc:stubbed-ref');
    const service = new CpProviderConnectionsService(db, encrypt);

    const saved = await service.saveRestKey(9, { api_key: 'sk-live-plain' });

    expect(encrypt).toHaveBeenCalledWith('sk-live-plain');
    expect(db.rows[0]?.secret_ref).toBe('enc:stubbed-ref');
    expect(db.rows[0]?.provider).toBe('magnific_rest');
    expect(JSON.stringify(db.rows[0])).not.toMatch(/sk-live-plain/);
    expect(saved.has_secret).toBe(true);
    expect(saved).not.toHaveProperty('api_key');
    expect(saved).not.toHaveProperty('secret_ref');
  });

  it('returns 503 secret_key_missing and does not persist plaintext', async () => {
    delete process.env.PTT_SECRET_ENCRYPT_KEY;
    const db = new ConnectionsMemory();
    const service = new CpProviderConnectionsService(db);

    await expect(service.saveRestKey(9, { api_key: 'sk-must-not-write' })).rejects.toMatchObject({
      response: { error: 'secret_key_missing' },
    });
    expect(db.rows).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it('lists connections without token or api_key fields except has_secret (GT-M07)', async () => {
    const db = new ConnectionsMemory();
    db.rows = [{
      id: CONNECTION_ID,
      provider: 'magnific_rest',
      status: 'on',
      account_label: 'PTT',
      secret_ref: 'enc:hidden',
      expires_at: null,
      access_token: 'must-not-leak',
      refresh_token: 'must-not-leak',
      api_key: 'must-not-leak',
    }];
    const service = new CpProviderConnectionsService(db);
    const listed = await service.list();
    const json = snapshotJson(listed);
    const withoutHasSecret = json.replaceAll('has_secret', '');

    expect(listed).toEqual({
      items: [{
        id: CONNECTION_ID,
        provider: 'magnific_rest',
        status: 'on',
        account_label: 'PTT',
        expires_at: null,
        has_secret: true,
      }],
    });
    expect(withoutHasSecret).not.toMatch(/token|api_key/i);
  });

  it('decrypts an active Magnific secret server-side and 409s when disconnected', async () => {
    const { encryptProviderSecret } = require('./cp-magnific-oauth.util') as typeof import('./cp-magnific-oauth.util');
    const db = new ConnectionsMemory();
    const service = new CpProviderConnectionsService(db);
    db.rows = [{
      id: CONNECTION_ID,
      provider: 'magnific_mcp',
      status: 'on',
      account_label: 'PTT',
      secret_ref: encryptProviderSecret(JSON.stringify({ access_token: 'tok_live' })),
      expires_at: null,
    }];

    await expect(service.loadDecryptedSecret('magnific_mcp')).resolves.toBe('tok_live');

    db.rows[0].status = 'off';
    db.rows[0].secret_ref = null;
    await expect(service.loadDecryptedSecret('magnific_mcp')).rejects.toMatchObject({
      status: 409,
      error: 'magnific_disconnected',
      gate: 'GT-M01',
    });
  });
});
