import { QuoteAuditRepository, sanitizeActivitySnapshot } from './quote-audit.repository';

class AuditMemory {
  rows: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const snapshot = (params[7] ?? {}) as Record<string, unknown>;
      const row = {
        id: `act-${this.rows.length + 1}`,
        tenant_id: params[0],
        proposal_id: params[1],
        version_id: params[2],
        actor_staff_id: params[3],
        actor_kind: params[4],
        action: params[5],
        resource: params[6],
        snapshot_json: snapshot,
        created_at: new Date().toISOString(),
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_activity/i.test(sql)) {
      return { rows: this.rows };
    }
    return { rows: [] };
  }
}

describe('QuoteAuditRepository', () => {
  it('strips otp and token from snapshots on insert', async () => {
    const db = new AuditMemory();
    const audit = new QuoteAuditRepository(db);

    await audit.insert({
      proposal_id: 9,
      action: 'publication.viewed',
      snapshot_json: {
        otp: '123456',
        token: 'raw-share-token',
        token_hash: 'abc',
        gm_bps: 2240,
      },
    });

    expect(db.rows[0].snapshot_json).toEqual({ gm_bps: 2240 });
    expect(JSON.stringify(db.rows)).not.toMatch(/123456|raw-share-token/);
  });

  it('list also redacts leftover otp/token keys', async () => {
    const db = new AuditMemory();
    db.rows.push({
      id: 'act-legacy',
      proposal_id: 1,
      action: 'quote.share',
      snapshot_json: { otp_code: '999111', token: 'leak', share_id: 'sh_9f' },
      created_at: '2026-09-08T02:00:00.000Z',
    });
    const items = await new QuoteAuditRepository(db).list({});

    expect(items[0].snapshot).toEqual({ share_id: 'sh_9f' });
    expect(JSON.stringify(items)).not.toMatch(/999111|leak/);
  });

  it('sanitizeActivitySnapshot never keeps raw secrets', () => {
    expect(
      sanitizeActivitySnapshot({
        otp: '000000',
        access_token: 'jwt',
        refresh_token: 'rt',
        discount_bps: 500,
      }),
    ).toEqual({ discount_bps: 500 });
  });
});
