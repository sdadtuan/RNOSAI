import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { GoneException } from '@nestjs/common';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuotePublicService } from './quote-public.service';
import { hashQuoteShareToken } from './quote-share.util';

const VID = '19d722af-0000-4000-8000-000000000010';
const FORBIDDEN = ['cost', 'margin', 'gm_bps', 'nsr'] as const;

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

class PublicMemory {
  sqls: string[] = [];
  proposals = new Map<number, Record<string, unknown>>();
  versions = new Map<string, Record<string, unknown>>();
  shares: Record<string, unknown>[] = [];
  payments: Record<string, unknown>[] = [];
  lines: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  settings: Record<string, unknown> = { share_expiry_days: 14 };
  convertCalls = 0;

  seed(overrides: { proposal?: Record<string, unknown>; version?: Record<string, unknown> } = {}) {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    this.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000089',
      current_version_id: VID,
      status: 'sent',
      title: 'Growth Proposal Q4/2026',
      objective: 'Lead căn hộ cao cấp',
      audience: 'CFO',
      campaign_period: '2026-Q4',
      valid_until: future.slice(0, 10),
      owner_staff_id: 7,
      ...(overrides.proposal ?? {}),
    });
    this.versions.set(VID, {
      id: VID,
      proposal_id: 9,
      n: 2,
      state: 'published',
      snapshot_json: {
        cost: 1,
        margin: 2,
        gm_bps: 2240,
        nsr: 99,
        kpis: [{ label: 'Lead dự kiến', value: '1.000' }],
      },
      fee_vnd: 100_000_000,
      media_vnd: 20_000_000,
      discount_vnd: 0,
      tax_vnd: 8_000_000,
      payable_vnd: 128_000_000,
      nsr_vnd: 100_000_000,
      direct_cost_vnd: 40_000_000,
      gm_bps: 2240,
      valid_until: future,
      ...(overrides.version ?? {}),
    });
    this.payments = [
      { id: 'pay-1', version_id: VID, seq: 1, pct_bps: 5000, amount_vnd: 64_000_000, milestone: 'Kickoff' },
    ];
    this.lines = [
      {
        id: 1,
        proposal_id: 9,
        dv_code: 'DV08',
        scope_notes: 'Meta Ads',
        client_visible: true,
        cost_labor_vnd: 12_000_000,
        final_price_vnd: 80_000_000,
      },
      {
        id: 2,
        proposal_id: 9,
        dv_code: 'DV99',
        scope_notes: 'hidden option',
        client_visible: false,
        cost_labor_vnd: 1,
        final_price_vnd: 1,
      },
    ];
    return { future };
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO crm_csd|INTO crm_cp_projects|service_lifecycle/i.test(sql)) {
      this.convertCalls += 1;
      throw new Error('must_not_spawn_lifecycles');
    }
    if (/INSERT INTO crm_quote_shares/i.test(sql)) {
      const row = {
        id: `share-${this.shares.length + 1}`,
        version_id: params[0],
        token_hash: params[1],
        expires_at: params[2],
        revoked_at: null,
      };
      this.shares.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_shares/i.test(sql)) {
      const hash = String(params[0] ?? '');
      const share = this.shares.find((row) => String(row.token_hash) === hash);
      if (!share) return { rows: [] };
      const version = this.versions.get(String(share.version_id));
      const proposal = version ? this.proposals.get(Number(version.proposal_id)) : undefined;
      return {
        rows: [
          {
            ...share,
            expires_at: share.expires_at,
            revoked_at: share.revoked_at,
            proposal_id: proposal?.id,
            quote_code: proposal?.quote_code,
            status: proposal?.status,
            title: proposal?.title,
            objective: proposal?.objective,
            audience: proposal?.audience,
            campaign_period: proposal?.campaign_period,
            proposal_valid_until: proposal?.valid_until,
            version_id: version?.id,
            version_n: version?.n,
            version_state: version?.state,
            snapshot_json: version?.snapshot_json,
            fee_vnd: version?.fee_vnd,
            media_vnd: version?.media_vnd,
            discount_vnd: version?.discount_vnd,
            tax_vnd: version?.tax_vnd,
            payable_vnd: version?.payable_vnd,
            nsr_vnd: version?.nsr_vnd,
            direct_cost_vnd: version?.direct_cost_vnd,
            gm_bps: version?.gm_bps,
            version_valid_until: version?.valid_until,
          },
        ],
      };
    }
    if (/FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.payments.filter((row) => String(row.version_id) === vid) };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      return { rows: this.lines.filter((row) => Number(row.proposal_id) === pid) };
    }
    if (/FROM crm_quote_settings/i.test(sql)) {
      return { rows: [this.settings] };
    }
    if (/FROM crm_proposals/i.test(sql) && /WHERE id/i.test(sql)) {
      const row = this.proposals.get(Number(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_proposals/i.test(sql) && /status/i.test(sql)) {
      const id = Number(params[params.length - 1] ?? params[0]);
      const current = this.proposals.get(id);
      if (!current) return { rows: [] };
      const next = { ...current, status: params.includes('accepted') ? 'accepted' : params[1] };
      if (typeof params[1] === 'string' && /accepted|sent|draft/.test(String(params[1]))) {
        next.status = params[1];
      }
      this.proposals.set(id, next);
      return { rows: [next] };
    }
    if (/UPDATE crm_quote_versions/i.test(sql)) {
      const vid = String(params[params.length - 1] ?? VID);
      const current = this.versions.get(vid);
      if (!current) return { rows: [] };
      const snap =
        typeof params[1] === 'object' && params[1]
          ? { ...(current.snapshot_json as object), ...(params[1] as object) }
          : current.snapshot_json;
      const next = {
        ...current,
        state: typeof params[0] === 'string' ? params[0] : current.state,
        snapshot_json: snap,
      };
      this.versions.set(vid, next);
      return { rows: [next] };
    }
    if (/UPDATE crm_quote_line_item/i.test(sql)) {
      for (const line of this.lines) {
        if (Number(line.proposal_id) === Number(params[1] ?? params[0])) {
          line.option_key = 'A';
        }
      }
      return { rows: this.lines };
    }
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        proposal_id: params[1],
        version_id: params[2],
        actor_staff_id: params[3],
        actor_kind: params[4],
        action: params[5],
        resource: params[6],
        snapshot_json: params[7] ?? {},
        created_at: new Date().toISOString(),
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

function loadSvc(db: PublicMemory) {
  const audit = new QuoteAuditRepository(db);
  return new QuotePublicService(db, audit);
}

describe('QuotePublicService', () => {
  it('GET public JSON excludes cost, margin, gm_bps, nsr', async () => {
    const db = new PublicMemory();
    db.seed();
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    expect(minted.token.length).toBeGreaterThanOrEqual(32);
    expect(db.shares[0].token_hash).toBe(hashQuoteShareToken(minted.token));
    expect(db.shares[0].token_hash).toBe(sha256(minted.token));
    expect(String(db.shares[0].token_hash)).not.toBe(minted.token);

    const dto = await svc.getByToken(minted.token);
    for (const key of FORBIDDEN) {
      expect(dto).not.toHaveProperty(key);
    }
    expect(JSON.stringify(dto)).not.toMatch(/"cost"|"margin"|"gm_bps"|"nsr"/);
    expect(dto.investment).toBeDefined();
    expect(dto.investment).not.toHaveProperty('gm_bps');
    expect((dto.cta as { accept: string }).accept).toBe('Xác nhận đề xuất');
    expect(JSON.stringify(dto)).not.toMatch(/ký hợp đồng/i);
  });

  it('expired valid_until or expires_at or revoked returns 410 without investment', async () => {
    const db = new PublicMemory();
    db.seed({ proposal: { valid_until: '2020-01-01' } });
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    await expect(svc.getByToken(minted.token)).rejects.toBeInstanceOf(GoneException);
    try {
      await svc.getByToken(minted.token);
    } catch (err) {
      const gone = err as GoneException;
      expect(gone.getStatus()).toBe(410);
      const body = gone.getResponse() as Record<string, unknown>;
      expect(body).not.toHaveProperty('investment');
      expect(body.error).toBe('quote_expired');
    }

    const dbRevoked = new PublicMemory();
    dbRevoked.seed();
    const svcRevoked = loadSvc(dbRevoked);
    const live = await svcRevoked.mintShare(9);
    dbRevoked.shares[0].revoked_at = new Date().toISOString();
    try {
      await svcRevoked.getByToken(live.token);
      throw new Error('expected 410');
    } catch (err) {
      const gone = err as GoneException;
      expect(gone.getStatus()).toBe(410);
      expect((gone.getResponse() as Record<string, unknown>).error).toBe('quote_revoked');
      expect(gone.getResponse()).not.toHaveProperty('investment');
    }
  });

  it('accept checkbox + name/email locks accepted option A and does not convert', async () => {
    const db = new PublicMemory();
    db.seed();
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    const out = await svc.accept(minted.token, {
      accepted: true,
      name: 'Nguyễn Minh Anh',
      email: 'minhanh@anphat.vn',
    });

    expect(out.status).toBe('accepted');
    expect(out.option_key).toBe('A');
    expect(db.proposals.get(9)?.status).toBe('accepted');
    expect(db.convertCalls).toBe(0);
    expect(db.sqls.join('\n')).not.toMatch(/service_lifecycle|crm_quote_conversions/i);
    expect(JSON.stringify(out)).not.toMatch(/ký hợp đồng/i);
  });

  it('accept on expired token is 410 without investment', async () => {
    const db = new PublicMemory();
    db.seed();
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);
    db.shares[0].expires_at = new Date(Date.now() - 1000).toISOString();

    try {
      await svc.accept(minted.token, {
        accepted: true,
        name: 'A',
        email: 'a@b.c',
      });
      throw new Error('expected 410');
    } catch (err) {
      const gone = err as GoneException;
      expect(gone.getStatus()).toBe(410);
      expect(gone.getResponse()).not.toHaveProperty('investment');
    }
  });
});

describe('quote-public.controller wiring', () => {
  it('public controller has no staff guard and accept CTA is Xác nhận đề xuất', () => {
    const src = readFileSync(join(__dirname, 'quote-public.controller.ts'), 'utf8');
    expect(src).toMatch(/@Controller\('api\/public\/proposals'\)/);
    expect(src).not.toMatch(/StaffQuoteGuard|StaffOrInternalKeyGuard|StaffProposalsWriteGuard/);
    expect(src).toMatch(/:token\/accept/);
    expect(src).toMatch(/Get\(':token'\)/);
  });
});
