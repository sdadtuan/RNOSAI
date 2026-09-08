import { readFileSync } from 'fs';
import { join } from 'path';
import { GoneException, UnauthorizedException } from '@nestjs/common';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuoteShareService } from './quote-share.service';
import { hashQuoteShareToken } from './quote-share.util';

const VID = '19d722af-0000-4000-8000-000000000010';

class FakeMailer {
  payloads: Record<string, unknown>[] = [];
  async send(payload: Record<string, unknown>) {
    this.payloads.push(payload);
    return { ok: true };
  }
  lastBody(): string {
    return String(this.payloads.at(-1)?.body ?? '');
  }
  lastOtp(): string {
    const match = this.lastBody().match(/\b(\d{6})\b/);
    if (!match) throw new Error('mailer body has no 6-digit OTP');
    return match[1];
  }
}

class ShareMemory {
  sqls: string[] = [];
  proposals = new Map<number, Record<string, unknown>>();
  versions = new Map<string, Record<string, unknown>>();
  shares: Record<string, unknown>[] = [];
  options: Record<string, unknown>[] = [];
  acceptances: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  lines: Record<string, unknown>[] = [];
  settings: Record<string, unknown> = { share_expiry_days: 14, otp_required: true };
  txCalls = 0;

  seed() {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    this.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000089',
      current_version_id: VID,
      status: 'sent',
      title: 'Growth Proposal Q4/2026',
      valid_until: future.slice(0, 10),
    });
    this.versions.set(VID, {
      id: VID,
      proposal_id: 9,
      n: 2,
      state: 'published',
      snapshot_json: { kpis: [] },
      valid_until: future,
    });
    this.options = [
      { id: 'opt-a', version_id: VID, option_key: 'A', name: 'Core', recommended: false, client_visible: true },
      { id: 'opt-b', version_id: VID, option_key: 'B', name: 'Growth', recommended: true, client_visible: true },
    ];
    this.lines = [{ id: 1, proposal_id: 9, dv_code: 'DV08', option_key: 'A' }];
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    this.txCalls += 1;
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
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
    if (/UPDATE crm_quote_shares/i.test(sql) && /revoked_at/i.test(sql)) {
      for (const share of this.shares) {
        if (String(share.version_id) === String(params[params.length - 1] ?? share.version_id)) {
          share.revoked_at = params[0] ?? new Date().toISOString();
        }
      }
      return { rows: this.shares };
    }
    if (/UPDATE crm_quote_shares/i.test(sql) && /otp_/i.test(sql)) {
      const share = this.shares.find((row) => String(row.id) === String(params[params.length - 1]));
      if (share) {
        if (/otp_hash/i.test(sql)) {
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
            proposal_id: proposal?.id,
            quote_code: proposal?.quote_code,
            status: proposal?.status,
            title: proposal?.title,
            proposal_valid_until: proposal?.valid_until,
            version_id: version?.id,
            version_n: version?.n,
            version_state: version?.state,
            snapshot_json: version?.snapshot_json,
            version_valid_until: version?.valid_until,
          },
        ],
      };
    }
    if (/FROM crm_quote_settings/i.test(sql)) {
      return { rows: [this.settings] };
    }
    if (/FROM crm_quote_options/i.test(sql)) {
      return { rows: this.options.filter((row) => String(row.version_id) === String(params[0] ?? VID)) };
    }
    if (/FROM crm_proposals/i.test(sql) && /WHERE id/i.test(sql)) {
      const row = this.proposals.get(Number(params[0]));
      return { rows: row ? [row] : [] };
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
    if (/UPDATE crm_proposals/i.test(sql)) {
      const id = Number(params[params.length - 1]);
      const current = this.proposals.get(id);
      if (current && typeof params[0] === 'string') current.status = params[0];
      return { rows: current ? [current] : [] };
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
        if (Number(line.proposal_id) === Number(params[1])) line.option_key = params[0];
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

function load() {
  const db = new ShareMemory();
  db.seed();
  const mailer = new FakeMailer();
  const audit = new QuoteAuditRepository(db);
  return { db, mailer, svc: new QuoteShareService(db, audit, mailer) };
}

async function mintAndOtp(svc: QuoteShareService, mailer: FakeMailer, email = 'minhanh@anphat.vn') {
  const minted = await svc.mintShare(9);
  await svc.requestOtp(minted.token, { email });
  return { minted, otp: mailer.lastOtp() };
}

describe('QuoteShareService', () => {
  it('expired token returns 410 without investment or snapshot leak', async () => {
    const { db, svc } = load();
    const minted = await svc.mintShare(9);
    db.shares[0].expires_at = new Date(Date.now() - 1000).toISOString();

    try {
      await svc.getByToken(minted.token);
      throw new Error('expected 410');
    } catch (err) {
      const gone = err as GoneException;
      expect(gone).toBeInstanceOf(GoneException);
      expect(gone.getStatus()).toBe(410);
      const body = gone.getResponse() as Record<string, unknown>;
      expect(body.error).toBe('quote_expired');
      expect(body).not.toHaveProperty('investment');
      expect(body).not.toHaveProperty('options');
      expect(body).not.toHaveProperty('snapshot_json');
      expect(JSON.stringify(body)).not.toContain(minted.token);
    }
  });

  it('wrong OTP returns 401 and does not accept', async () => {
    const { db, svc, mailer } = load();
    const { minted } = await mintAndOtp(svc, mailer);

    try {
      await svc.accept(minted.token, {
        accepted: true,
        option_key: 'B',
        signer_name: 'Nguyễn Minh Anh',
        signer_title: 'CFO',
        signer_email: 'minhanh@anphat.vn',
        otp: '000000',
      });
      throw new Error('expected 401');
    } catch (err) {
      const unauthorized = err as UnauthorizedException;
      expect(unauthorized).toBeInstanceOf(UnauthorizedException);
      expect(unauthorized.getStatus()).toBe(401);
      expect(db.proposals.get(9)?.status).toBe('sent');
      expect(db.acceptances).toHaveLength(0);
    }
  });

  it('activity snapshot never stores raw token or OTP', async () => {
    const { db, svc, mailer } = load();
    const { minted, otp } = await mintAndOtp(svc, mailer);

    await svc.accept(
      minted.token,
      {
        accepted: true,
        option_key: 'B',
        signer_name: 'Nguyễn Minh Anh',
        signer_title: 'CFO',
        signer_email: 'minhanh@anphat.vn',
        otp,
        token: minted.token,
      },
      { ip: '203.0.113.9', userAgent: 'Mozilla/5.0' },
    );

    const dumped = JSON.stringify(db.activity);
    expect(dumped).not.toContain(minted.token);
    expect(dumped).not.toContain(otp);
    expect(db.activity[0].snapshot_json).not.toHaveProperty('otp');
    expect(db.activity[0].snapshot_json).not.toHaveProperty('token');
    expect(hashQuoteShareToken(minted.token)).not.toBe(minted.token);
  });

  it('AC-05 locks option B, writes acceptance, and allows convert', async () => {
    const { db, svc, mailer } = load();
    const { minted, otp } = await mintAndOtp(svc, mailer);

    const out = await svc.accept(
      minted.token,
      {
        accepted: true,
        option_key: 'B',
        signer_name: 'Nguyễn Minh Anh',
        signer_title: 'CFO',
        signer_email: 'minhanh@anphat.vn',
        otp,
      },
      { ip: '203.0.113.9', userAgent: 'Mozilla/5.0 QT' },
    );

    expect(out.status).toBe('accepted');
    expect(out.option_key).toBe('B');
    expect(out.accepted_option_key).toBe('B');
    expect(out.locked).toBe(true);
    expect(out.convert_allowed).toBe(true);
    expect((out.cta as { accept: string }).accept).toBe('Xác nhận đề xuất');
    expect(JSON.stringify(out)).not.toMatch(/ký hợp đồng/i);

    expect(db.proposals.get(9)?.status).toBe('accepted');
    expect(db.versions.get(VID)?.state).toBe('accepted');
    const snap = db.versions.get(VID)?.snapshot_json as Record<string, unknown>;
    expect(snap.accepted_option_key).toBe('B');
    expect(snap.locked).toBe(true);
    expect(db.lines[0].option_key).toBe('B');
    expect(db.acceptances).toHaveLength(1);
    expect(db.acceptances[0]).toMatchObject({
      version_id: VID,
      option_key: 'B',
      signer_name: 'Nguyễn Minh Anh',
      signer_title: 'CFO',
      signer_email: 'minhanh@anphat.vn',
      ip: '203.0.113.9',
      user_agent: 'Mozilla/5.0 QT',
    });
  });
});

describe('quote share HTTP wiring', () => {
  it('public OTP/accept stay unguarded; staff mint/revoke use StaffOrInternalKeyGuard + quote guard', () => {
    const pub = readFileSync(join(__dirname, 'quote-public.controller.ts'), 'utf8');
    const share = readFileSync(join(__dirname, 'quote-share.controller.ts'), 'utf8');
    expect(pub).toMatch(/:token\/otp/);
    expect(pub).toMatch(/:token\/accept/);
    expect(pub).not.toMatch(/StaffQuoteGuard|StaffOrInternalKeyGuard|StaffAuthGuard|StaffProposalsWriteGuard/);
    expect(share).toMatch(/StaffOrInternalKeyGuard/);
    expect(share).toMatch(/StaffQuoteGuard|StaffProposalsWriteGuard/);
    expect(share).toMatch(/share\/revoke/);
    expect(share).not.toMatch(/StaffAuthGuard/);
  });
});
