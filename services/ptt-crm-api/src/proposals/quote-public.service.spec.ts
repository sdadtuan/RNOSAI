import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { ConflictException, GoneException } from '@nestjs/common';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuotePublicService } from './quote-public.service';
import { QuoteShareService } from './quote-share.service';
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
  acceptances: Record<string, unknown>[] = [];
  options: Record<string, unknown>[] = [];
  settings: Record<string, unknown> = { share_expiry_days: 14, otp_required: false, view_tracking: true };
  convertCalls = 0;
  txCalls = 0;
  failOnVersionUpdate = false;
  viewEvents: Record<string, unknown>[] = [];

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

  private snapshot() {
    return {
      proposals: new Map(
        [...this.proposals.entries()].map(([id, row]) => [id, { ...row }]),
      ),
      versions: new Map(
        [...this.versions.entries()].map(([id, row]) => [
          id,
          {
            ...row,
            snapshot_json:
              row.snapshot_json && typeof row.snapshot_json === 'object'
                ? { ...(row.snapshot_json as Record<string, unknown>) }
                : row.snapshot_json,
          },
        ]),
      ),
      lines: this.lines.map((row) => ({ ...row })),
      activity: this.activity.map((row) => ({ ...row })),
    };
  }

  private restore(snap: ReturnType<PublicMemory['snapshot']>) {
    this.proposals = snap.proposals;
    this.versions = snap.versions;
    this.lines = snap.lines;
    this.activity = snap.activity;
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    this.txCalls += 1;
    const snap = this.snapshot();
    try {
      return await fn(this.query.bind(this));
    } catch (err) {
      this.restore(snap);
      throw err;
    }
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO crm_csd|INTO crm_cp_projects|service_lifecycle/i.test(sql)) {
      this.convertCalls += 1;
      throw new Error('must_not_spawn_lifecycles');
    }
    if (/INSERT INTO crm_quote_view_events/i.test(sql)) {
      const row = {
        id: `view-${this.viewEvents.length + 1}`,
        share_id: params[0],
        section_key: params[1] ?? null,
        created_at: new Date().toISOString(),
      };
      this.viewEvents.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_shares/i.test(sql)) {
      const row = {
        id: `share-${this.shares.length + 1}`,
        version_id: params[0],
        token_hash: params[1],
        expires_at: params[2],
        revoked_at: null,
        otp_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
      };
      this.shares.push(row);
      return { rows: [row] };
    }
    if (/UPDATE crm_quote_shares/i.test(sql) && /otp_/i.test(sql)) {
      const share = this.shares.find((row) => String(row.id) === String(params[params.length - 1]));
      if (share) {
        if (/otp_hash/i.test(sql) && /otp_expires_at/i.test(sql)) {
          share.otp_hash = params[0];
          share.otp_expires_at = params[1];
          share.otp_attempts = params[2] ?? 0;
        } else if (/otp_attempts/i.test(sql)) {
          share.otp_attempts = params[0];
        }
      }
      return { rows: share ? [share] : [] };
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
    if (/FROM crm_quote_options/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.options.filter((row) => String(row.version_id) === vid) };
    }
    if (/INSERT INTO crm_quote_acceptances/i.test(sql)) {
      const row = {
        id: `acc-${this.acceptances.length + 1}`,
        version_id: params[0],
        option_key: params[1],
        signer_name: params[2],
        signer_title: params[3],
        signer_email: params[4],
        ip: params[5],
        user_agent: params[6],
      };
      this.acceptances.push(row);
      return { rows: [row] };
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
      if (this.failOnVersionUpdate) throw new Error('mid_flight_version_fail');
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
          line.option_key = params[0];
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
  const mailer = { send: async () => ({ ok: true, skipped: true }) };
  const shares = new QuoteShareService(db, audit, mailer as never);
  return new QuotePublicService(db, shares);
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
    expect(dto.otp_required).toBe(false);
    expect(db.viewEvents).toHaveLength(1);
    expect(db.viewEvents[0].share_id).toBe(db.shares[0].id);
    expect(db.viewEvents[0].section_key).toBeNull();
  });

  it('GET public share writes view event section and never leaks cost/margin', async () => {
    const db = new PublicMemory();
    db.seed();
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    const dto = await svc.getByToken(minted.token, { section: '04' });
    expect(db.viewEvents).toEqual([
      expect.objectContaining({ share_id: db.shares[0].id, section_key: '04' }),
    ]);
    expect(JSON.stringify(dto)).not.toMatch(/"cost"|"margin"|"gm_bps"|"nsr"/);
    expect(dto.investment).not.toHaveProperty('gm_bps');
  });

  it('expired public GET does not write view events', async () => {
    const db = new PublicMemory();
    db.seed({ proposal: { valid_until: '2020-01-01' } });
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    await expect(svc.getByToken(minted.token)).rejects.toBeInstanceOf(GoneException);
    expect(db.viewEvents).toHaveLength(0);
  });

  it('GET includes otp_required and only visible options', async () => {
    const db = new PublicMemory();
    db.seed();
    db.settings.otp_required = true;
    db.options = [
      {
        id: 'opt-a',
        version_id: VID,
        option_key: 'A',
        name: 'Core',
        recommended: false,
        client_visible: true,
        payable_vnd: 128_000_000,
      },
      {
        id: 'opt-b',
        version_id: VID,
        option_key: 'B',
        name: 'Growth',
        recommended: true,
        client_visible: true,
        payable_vnd: 150_000_000,
      },
      {
        id: 'opt-c',
        version_id: VID,
        option_key: 'C',
        name: 'Hidden internal',
        recommended: false,
        client_visible: false,
        payable_vnd: 1,
      },
    ];
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);
    const dto = await svc.getByToken(minted.token);
    expect(dto.otp_required).toBe(true);
    const keys = (dto.options as Array<{ option_key: string }>).map((row) => row.option_key);
    expect(keys).toEqual(['A', 'B']);
    expect(JSON.stringify(dto)).not.toMatch(/Hidden internal/);
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
    expect(db.txCalls).toBe(1);
    expect(db.convertCalls).toBe(0);
    expect(db.sqls.join('\n')).not.toMatch(/service_lifecycle|crm_quote_conversions/i);
    expect(JSON.stringify(out)).not.toMatch(/ký hợp đồng/i);
  });

  it('already-accepted accept is idempotent 200 and does not rewrite', async () => {
    const db = new PublicMemory();
    db.seed({
      proposal: { status: 'accepted' },
      version: { state: 'accepted', snapshot_json: { accepted_option_key: 'A', locked: true } },
    });
    db.lines[0].option_key = 'A';
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);
    const sqlBefore = db.sqls.length;
    const activityBefore = db.activity.length;

    const out = await svc.accept(minted.token, {
      accepted: true,
      name: 'Nguyễn Minh Anh',
      email: 'minhanh@anphat.vn',
    });

    expect(out.status).toBe('accepted');
    expect(out.option_key).toBe('A');
    expect(db.proposals.get(9)?.status).toBe('accepted');
    expect(db.txCalls).toBe(0);
    expect(db.activity.length).toBe(activityBefore);
    expect(db.sqls.slice(sqlBefore).join('\n')).not.toMatch(/UPDATE crm_proposals|UPDATE crm_quote_versions|UPDATE crm_quote_line_item/i);
    expect((db.versions.get(VID)?.snapshot_json as { locked?: boolean }).locked).toBe(true);
  });

  it('accept from draft returns 409 and does not lock', async () => {
    const db = new PublicMemory();
    db.seed({ proposal: { status: 'draft' } });
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    try {
      await svc.accept(minted.token, {
        accepted: true,
        name: 'A',
        email: 'a@b.c',
      });
      throw new Error('expected 409');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const conflict = err as ConflictException;
      expect(conflict.getStatus()).toBe(409);
      expect(db.proposals.get(9)?.status).toBe('draft');
      expect(db.txCalls).toBe(0);
      expect(db.activity).toHaveLength(0);
    }
  });

  it('accept lock writes roll back when version snapshot fails mid-flight', async () => {
    const db = new PublicMemory();
    db.seed();
    db.failOnVersionUpdate = true;
    const svc = loadSvc(db);
    const minted = await svc.mintShare(9);

    await expect(
      svc.accept(minted.token, {
        accepted: true,
        name: 'A',
        email: 'a@b.c',
      }),
    ).rejects.toThrow('mid_flight_version_fail');

    expect(db.txCalls).toBe(1);
    expect(db.proposals.get(9)?.status).toBe('sent');
    expect(db.versions.get(VID)?.state).toBe('published');
    expect(db.lines[0].option_key).toBeUndefined();
    expect(db.activity).toHaveLength(0);
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
    expect(src).toMatch(/:token\/otp/);
    expect(src).toMatch(/Get\(':token'\)/);
  });
});
