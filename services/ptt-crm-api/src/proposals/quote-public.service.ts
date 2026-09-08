import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteQueryPort } from './quote-audit.repository';
import { stripPublicQuote } from './quote-public-strip.util';
import { QuoteShareService, type PublicAcceptBody, type PublicAcceptMeta } from './quote-share.service';
import { PUBLIC_ACCEPT_CTA, hashQuoteShareToken, isTimestampPast } from './quote-share.util';

export { PUBLIC_ACCEPT_CTA };
export type { PublicAcceptBody, PublicAcceptMeta };

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
    private readonly shares: QuoteShareService,
  ) {}

  async mintShare(proposalId: number): Promise<{ token: string; expires_at: string; share_id: string }> {
    return this.shares.mintShare(proposalId);
  }

  async accept(
    rawToken: string,
    body: PublicAcceptBody,
    meta: PublicAcceptMeta = {},
  ): Promise<Record<string, unknown>> {
    return this.shares.accept(rawToken, body, meta);
  }

  async getByToken(
    rawToken: string,
    opts?: { section?: string | null },
  ): Promise<Record<string, unknown>> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    await this.recordView(loaded, opts?.section);
    return this.toPublicDto(loaded);
  }

  async renderByVersionId(versionId: string): Promise<Record<string, unknown>> {
    const vid = String(versionId ?? '').trim();
    if (!vid) throw new NotFoundException({ error: 'version_not_found' });
    const version = await this.db.query(
      `SELECT id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
              tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, valid_until
         FROM crm_quote_versions
        WHERE id::text = $1
        LIMIT 1`,
      [vid],
    );
    const v = version.rows[0];
    if (!v) throw new NotFoundException({ error: 'version_not_found' });
    const proposal = await this.db.query(
      `SELECT id, quote_code, status, title, objective, audience, campaign_period, valid_until
         FROM crm_proposals
        WHERE id = $1
        LIMIT 1`,
      [v.proposal_id],
    );
    const p = proposal.rows[0];
    if (!p) throw new NotFoundException({ error: 'quote_not_found' });
    return this.toPublicDto({
      version_id: v.id,
      version_n: v.n,
      version_state: v.state,
      snapshot_json: v.snapshot_json,
      fee_vnd: v.fee_vnd,
      media_vnd: v.media_vnd,
      discount_vnd: v.discount_vnd,
      tax_vnd: v.tax_vnd,
      payable_vnd: v.payable_vnd,
      nsr_vnd: v.nsr_vnd,
      direct_cost_vnd: v.direct_cost_vnd,
      gm_bps: v.gm_bps,
      version_valid_until: v.valid_until,
      proposal_id: p.id,
      quote_code: p.quote_code,
      status: p.status,
      title: p.title,
      objective: p.objective,
      audience: p.audience,
      campaign_period: p.campaign_period,
      proposal_valid_until: p.valid_until,
    });
  }

  private async recordView(row: Record<string, unknown>, section?: string | null): Promise<void> {
    const shareId = String(row.id ?? '').trim();
    if (!shareId) return;
    const settings = await this.db.query(`SELECT view_tracking FROM crm_quote_settings LIMIT 1`);
    if (settings.rows[0]?.view_tracking === false || settings.rows[0]?.view_tracking === 'f') {
      return;
    }
    const sectionKey = String(section ?? '').trim() || null;
    await this.db.query(
      `INSERT INTO crm_quote_view_events (share_id, section_key) VALUES ($1, $2)`,
      [shareId, sectionKey],
    );
  }

  private async otpRequired(): Promise<boolean> {
    const settings = await this.db.query(`SELECT otp_required FROM crm_quote_settings LIMIT 1`);
    return settings.rows[0]?.otp_required !== false && settings.rows[0]?.otp_required !== 'f';
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
    const optionRows = await this.db.query(
      `SELECT id, version_id, option_key, name, recommended, client_visible, payable_vnd
         FROM crm_quote_options
        WHERE version_id::text = $1
        ORDER BY option_key`,
      [vid],
    );
    const snapOptions = Array.isArray(snapshot.options) ? snapshot.options : [];
    const options = optionRows.rows.length
      ? optionRows.rows.map((opt) => ({
          option_key: String(opt.option_key ?? ''),
          name: String(opt.name ?? ''),
          recommended: opt.recommended === true || opt.recommended === 't',
          client_visible: opt.client_visible !== false && opt.client_visible !== 'f',
          payable_vnd: money(opt.payable_vnd),
        }))
      : snapOptions;
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
      options,
      option_key: 'A',
      otp_required: await this.otpRequired(),
      cta: { accept: PUBLIC_ACCEPT_CTA },
    };
    return stripPublicQuote(dto);
  }
}
