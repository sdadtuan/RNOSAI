import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PortalNotifyWebhookService } from '../portal/portal-notify-webhook.service';
import {
  QT_QUOTE_QUERY,
  QuoteAuditRepository,
  QuoteQueryFn,
  QuoteQueryPort,
} from './quote-audit.repository';
import {
  PUBLIC_ACCEPT_CTA,
  QUOTE_OTP_MAX_ATTEMPTS,
  QUOTE_OTP_TTL_MS,
  generateQuoteOtp,
  generateQuoteShareToken,
  hashQuoteOtp,
  hashQuoteShareToken,
  isTimestampPast,
  shareExpiresAt,
} from './quote-share.util';
import { canTransition } from './quote-status.util';
import type { QuoteOptionKey, QuoteStatus } from './quote.types';

export type QuoteShareMailer = Pick<PortalNotifyWebhookService, 'send'>;

export type PublicAcceptBody = {
  accepted?: unknown;
  name?: unknown;
  email?: unknown;
  title?: unknown;
  signer_name?: unknown;
  signer_title?: unknown;
  signer_email?: unknown;
  option_key?: unknown;
  otp?: unknown;
  token?: unknown;
};

export type PublicAcceptMeta = {
  ip?: string | null;
  userAgent?: string | null;
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

function gone(error: 'quote_expired' | 'quote_revoked', quoteCode: string | null): never {
  throw new GoneException({ error, quote_code: quoteCode });
}

function asOptionKey(value: unknown): QuoteOptionKey | null {
  const key = String(value ?? '').trim().toUpperCase();
  if (key === 'A' || key === 'B' || key === 'C') return key;
  return null;
}

function clientMeta(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

@Injectable()
export class QuoteShareService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly audit: QuoteAuditRepository,
    @Inject(PortalNotifyWebhookService) private readonly mailer: QuoteShareMailer,
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

  async revokeShare(proposalId: number): Promise<{ revoked: number }> {
    const proposal = await this.db.query(
      `SELECT id, current_version_id FROM crm_proposals WHERE id = $1 LIMIT 1`,
      [proposalId],
    );
    const versionId = String(proposal.rows[0]?.current_version_id ?? '').trim();
    if (!proposal.rows[0] || !versionId) {
      throw new NotFoundException({ error: 'version_not_found' });
    }
    const now = new Date().toISOString();
    const updated = await this.db.query(
      `UPDATE crm_quote_shares
          SET revoked_at = $1
        WHERE version_id::text = $2
          AND revoked_at IS NULL
        RETURNING id`,
      [now, versionId],
    );
    return { revoked: updated.rows.length };
  }

  async getByToken(rawToken: string): Promise<Record<string, unknown>> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    return {
      quote_code: loaded.quote_code == null ? null : String(loaded.quote_code),
      status: String(loaded.status ?? ''),
    };
  }

  async requestOtp(
    rawToken: string,
    body: { email?: unknown },
  ): Promise<{ sent: true; expires_in_sec: number }> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    const email = String(body.email ?? '').trim();
    if (!email || !email.includes('@')) throw new BadRequestException({ error: 'email_required' });
    const otp = generateQuoteOtp();
    const expires = new Date(Date.now() + QUOTE_OTP_TTL_MS);
    await this.db.query(
      `UPDATE crm_quote_shares
          SET otp_hash = $1, otp_expires_at = $2, otp_attempts = $3
        WHERE id::text = $4`,
      [hashQuoteOtp(otp), expires.toISOString(), 0, String(loaded.id)],
    );
    const quoteCode = loaded.quote_code == null ? '' : String(loaded.quote_code);
    await this.mailer.send({
      source: 'quote_share_otp',
      to: email,
      subject: quoteCode
        ? `PTT — Mã xác nhận đề xuất ${quoteCode}`
        : 'PTT — Mã xác nhận đề xuất',
      body:
        `Mã xác nhận đề xuất của bạn là ${otp}.\n` +
        `Mã hết hạn sau 5 phút. Không chia sẻ mã này.`,
    });
    return { sent: true, expires_in_sec: 300 };
  }

  async accept(
    rawToken: string,
    body: PublicAcceptBody,
    meta: PublicAcceptMeta = {},
  ): Promise<Record<string, unknown>> {
    const loaded = await this.loadShare(rawToken);
    this.assertLive(loaded);
    if (body.accepted !== true) {
      throw new BadRequestException({ error: 'accept_required' });
    }
    const name = String(body.signer_name ?? body.name ?? '').trim();
    const title = String(body.signer_title ?? body.title ?? '').trim();
    const email = String(body.signer_email ?? body.email ?? '').trim();
    if (!name) throw new BadRequestException({ error: 'name_required' });
    if (!email || !email.includes('@')) throw new BadRequestException({ error: 'email_required' });
    const optionKey = asOptionKey(body.option_key) ?? 'A';
    await this.assertVisibleOption(String(loaded.version_id), optionKey);
    await this.assertOtp(loaded, body);

    const accepted = {
      status: 'accepted',
      option_key: optionKey,
      accepted_option_key: optionKey,
      locked: true,
      convert_allowed: true,
      cta: { accept: PUBLIC_ACCEPT_CTA },
    };
    const currentStatus = String(loaded.status ?? '') as QuoteStatus;
    if (currentStatus === 'accepted') {
      return accepted;
    }
    if (!canTransition(currentStatus, 'accepted')) {
      throw new ConflictException({ error: 'invalid_status_transition', status: currentStatus });
    }

    const snap = {
      ...asObject(loaded.snapshot_json),
      accepted_option_key: optionKey,
      locked: true,
    };
    const proposalId = Number(loaded.proposal_id);
    await this.inTx(async (query) => {
      await query(`UPDATE crm_proposals SET status = $1, updated_at = $2 WHERE id = $3`, [
        'accepted',
        new Date().toISOString(),
        proposalId,
      ]);
      await query(`UPDATE crm_quote_versions SET state = $1, snapshot_json = $2 WHERE id::text = $3`, [
        'accepted',
        snap,
        String(loaded.version_id),
      ]);
      await query(`UPDATE crm_quote_line_item SET option_key = $1 WHERE proposal_id = $2`, [
        optionKey,
        proposalId,
      ]);
      await query(
        `INSERT INTO crm_quote_acceptances
           (version_id, option_key, signer_name, signer_title, signer_email, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          String(loaded.version_id),
          optionKey,
          name,
          title,
          email,
          clientMeta(meta.ip),
          clientMeta(meta.userAgent),
        ],
      );
      await query(
        `UPDATE crm_quote_shares
            SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0
          WHERE id::text = $1`,
        [String(loaded.id)],
      );
      await this.audit.insert(
        {
          proposal_id: proposalId,
          version_id: String(loaded.version_id),
          actor_kind: 'client',
          action: 'public.accept',
          resource: 'quote_share',
          snapshot_json: { option_key: optionKey, name, email },
        },
        query,
      );
    });

    return accepted;
  }

  private async assertOtp(loaded: Record<string, unknown>, body: PublicAcceptBody): Promise<void> {
    const settings = await this.db.query(
      `SELECT otp_required FROM crm_quote_settings LIMIT 1`,
    );
    const required = settings.rows[0]?.otp_required !== false && settings.rows[0]?.otp_required !== 'f';
    if (!required) return;
    const submitted = String(body.otp ?? '').replace(/\s+/g, '');
    const attempts = Number(loaded.otp_attempts ?? 0);
    if (
      !submitted ||
      !loaded.otp_hash ||
      isTimestampPast(loaded.otp_expires_at == null ? null : String(loaded.otp_expires_at)) ||
      attempts >= QUOTE_OTP_MAX_ATTEMPTS
    ) {
      throw new UnauthorizedException({ error: 'otp_invalid' });
    }
    if (hashQuoteOtp(submitted) !== String(loaded.otp_hash)) {
      await this.db.query(
        `UPDATE crm_quote_shares SET otp_attempts = $1 WHERE id::text = $2`,
        [attempts + 1, String(loaded.id)],
      );
      throw new UnauthorizedException({ error: 'otp_invalid' });
    }
  }

  private async assertVisibleOption(versionId: string, optionKey: QuoteOptionKey): Promise<void> {
    const options = await this.db.query(
      `SELECT option_key, client_visible
         FROM crm_quote_options
        WHERE version_id::text = $1`,
      [versionId],
    );
    if (!options.rows.length) return;
    const match = options.rows.find((row) => String(row.option_key) === optionKey);
    if (!match || match.client_visible === false || match.client_visible === 'f') {
      throw new BadRequestException({ error: 'option_not_available' });
    }
  }

  private inTx<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (!this.db.withTransaction) {
      throw new BadRequestException({ error: 'tx_unavailable' });
    }
    return this.db.withTransaction(fn);
  }

  private async loadShare(rawToken: string): Promise<Record<string, unknown>> {
    const token = String(rawToken ?? '').trim();
    if (!token) throw new NotFoundException({ error: 'invalid_token' });
    const result = await this.db.query(
      `SELECT s.id, s.version_id, s.token_hash, s.expires_at, s.revoked_at,
              s.otp_hash, s.otp_expires_at, s.otp_attempts,
              p.id AS proposal_id, p.quote_code, p.status, p.title,
              p.valid_until AS proposal_valid_until,
              v.n AS version_n, v.state AS version_state, v.snapshot_json,
              v.valid_until AS version_valid_until
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
}
