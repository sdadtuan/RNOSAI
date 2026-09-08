import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteAuditRepository, QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import { stripPublicQuote } from './quote-public-strip.util';
import {
  generateQuoteShareToken,
  hashQuoteShareToken,
  isTimestampPast,
  shareExpiresAt,
} from './quote-share.util';

export const PUBLIC_ACCEPT_CTA = 'Xác nhận đề xuất';

export type PublicAcceptBody = {
  accepted?: unknown;
  name?: unknown;
  email?: unknown;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function money(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gone(error: 'quote_expired' | 'quote_revoked', quoteCode: string | null): never {
  throw new GoneException({ error, quote_code: quoteCode });
}

@Injectable()
export class QuotePublicService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly audit: QuoteAuditRepository,
  ) {}

  async mintShare(proposalId: number): Promise<{ token: string; expires_at: string; share_id: string }> {
    const proposal = await this.db.query(
      `SELECT id, current_version_id FROM crm_proposals WHERE id = $1 LIMIT 1`,
      [proposalId],
    );
    const row = proposal.rows[0];
    const versionId = String(row?.current_version_id ?? '').trim();
    if (!row || !versionId) {
      throw new NotFoundException({ error: 'version_not_found' });
    }
    const settings = await this.db.query(
      `SELECT share_expiry_days FROM crm_quote_settings LIMIT 1`,
    );
    const days = Number(settings.rows[0]?.share_expiry_days ?? 14);
    const token = generateQuoteShareToken();
    const expires = shareExpiresAt(days);
    const inserted = await this.db.query(
      `INSERT INTO crm_quote_shares (version_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, version_id, token_hash, expires_at, revoked_at`,
      [versionId, hashQuoteShareToken(token), expires.toISOString()],
    );
    const share = inserted.rows[0];
    if (!share) throw new BadRequestException({ error: 'share_insert_failed' });
    return {
      token,
      expires_at: String(share.expires_at ?? expires.toISOString()),
      share_id: String(share.id),
    };
  }

  async getByToken(rawToken: string): Promise<Record<string, unknown>> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    return this.toPublicDto(loaded);
  }

  async accept(rawToken: string, body: PublicAcceptBody): Promise<Record<string, unknown>> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    if (body.accepted !== true) {
      throw new BadRequestException({ error: 'accept_required' });
    }
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (!name) throw new BadRequestException({ error: 'name_required' });
    if (!email || !email.includes('@')) throw new BadRequestException({ error: 'email_required' });

    const proposalId = Number(loaded.proposal_id);
    await this.db.query(
      `UPDATE crm_proposals SET status = $1, updated_at = $2 WHERE id = $3`,
      ['accepted', new Date().toISOString(), proposalId],
    );
    const snap = {
      ...asObject(loaded.snapshot_json),
      accepted_option_key: 'A',
    };
    await this.db.query(
      `UPDATE crm_quote_versions SET state = $1, snapshot_json = $2 WHERE id::text = $3`,
      ['accepted', snap, String(loaded.version_id)],
    );
    await this.db.query(
      `UPDATE crm_quote_line_item SET option_key = $1 WHERE proposal_id = $2`,
      ['A', proposalId],
    );
    await this.audit.insert({
      proposal_id: proposalId,
      version_id: String(loaded.version_id),
      actor_kind: 'client',
      action: 'public.accept',
      resource: 'quote_share',
      snapshot_json: { option_key: 'A', name, email },
    });

    return {
      status: 'accepted',
      option_key: 'A',
      cta: { accept: PUBLIC_ACCEPT_CTA },
    };
  }

  private async loadShare(rawToken: string): Promise<Record<string, unknown>> {
    const token = String(rawToken ?? '').trim();
    if (!token) throw new NotFoundException({ error: 'invalid_token' });
    const result = await this.db.query(
      `SELECT s.id, s.version_id, s.token_hash, s.expires_at, s.revoked_at,
              p.id AS proposal_id, p.quote_code, p.status, p.title, p.objective,
              p.audience, p.campaign_period, p.valid_until AS proposal_valid_until,
              v.n AS version_n, v.state AS version_state, v.snapshot_json,
              v.fee_vnd, v.media_vnd, v.discount_vnd, v.tax_vnd, v.payable_vnd,
              v.nsr_vnd, v.direct_cost_vnd, v.gm_bps, v.valid_until AS version_valid_until
         FROM crm_quote_shares s
         JOIN crm_quote_versions v ON v.id = s.version_id
         JOIN crm_proposals p ON p.id = v.proposal_id
        WHERE s.token_hash = $1
        LIMIT 1`,
      [hashQuoteShareToken(token)],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: 'invalid_token' });
    return row;
  }

  private assertLive(row: Record<string, unknown>): void {
    const quoteCode = row.quote_code == null ? null : String(row.quote_code);
    if (row.revoked_at) gone('quote_revoked', quoteCode);
    if (
      isTimestampPast(row.expires_at == null ? null : String(row.expires_at)) ||
      isTimestampPast(row.proposal_valid_until == null ? null : String(row.proposal_valid_until)) ||
      isTimestampPast(row.version_valid_until == null ? null : String(row.version_valid_until))
    ) {
      gone('quote_expired', quoteCode);
    }
  }

  private async toPublicDto(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const vid = String(row.version_id ?? '');
    const proposalId = Number(row.proposal_id);
    const payments = await this.db.query(
      `SELECT id, version_id, seq, pct_bps, amount_vnd, milestone
         FROM crm_quote_payment_schedules
        WHERE version_id::text = $1
        ORDER BY seq ASC`,
      [vid],
    );
    const lines = await this.db.query(
      `SELECT id, proposal_id, dv_code, scope_notes, client_visible, final_price_vnd
         FROM crm_quote_line_item
        WHERE proposal_id = $1
        ORDER BY id ASC`,
      [proposalId],
    );
    const snapshot = asObject(row.snapshot_json);
    const dto = {
      quote_code: row.quote_code == null ? null : String(row.quote_code),
      title: String(row.title ?? ''),
      objective: String(row.objective ?? ''),
      audience: String(row.audience ?? ''),
      campaign_period: String(row.campaign_period ?? ''),
      valid_until: row.proposal_valid_until ?? row.version_valid_until ?? null,
      version_n: Number(row.version_n ?? 1),
      status: String(row.status ?? ''),
      kpis: Array.isArray(snapshot.kpis) ? snapshot.kpis : [],
      scope: lines.rows
        .filter((line) => line.client_visible !== false && line.client_visible !== 'f')
        .map((line) => ({
          dv_code: String(line.dv_code ?? ''),
          notes: String(line.scope_notes ?? ''),
        })),
      investment: {
        fee_vnd: money(row.fee_vnd),
        media_vnd: money(row.media_vnd),
        discount_vnd: money(row.discount_vnd),
        tax_vnd: money(row.tax_vnd),
        payable_vnd: money(row.payable_vnd),
      },
      payments: payments.rows.map((pay) => ({
        seq: Number(pay.seq ?? 0),
        pct_bps: Number(pay.pct_bps ?? 0),
        amount_vnd: money(pay.amount_vnd),
        milestone: String(pay.milestone ?? ''),
      })),
      option_key: 'A',
      cta: { accept: PUBLIC_ACCEPT_CTA },
    };
    return stripPublicQuote(dto);
  }
}
