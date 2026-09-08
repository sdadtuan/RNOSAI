import { QT_TENANT_ID } from './quote-settings.repository';
import type { QuoteStatus } from './quote.types';

export const QT_EXPIRY_TZ = 'Asia/Ho_Chi_Minh';
export const QT_EXPIRABLE_STATUSES: readonly QuoteStatus[] = ['sent', 'viewed', 'negotiation'];

export type QuoteExpiryQueryPort = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export type QuoteExpiryTickResult = {
  expired: number;
};

export function ictYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QT_EXPIRY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isValidUntilPast(
  validUntil: string | Date | null | undefined,
  now: Date,
): boolean {
  if (validUntil == null || validUntil === '') return false;
  if (validUntil instanceof Date) {
    return Number.isFinite(validUntil.getTime()) && validUntil.getTime() < now.getTime();
  }
  const raw = String(validUntil).trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return ictYmd(now) > raw;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) && ms < now.getTime();
}

function pickValidUntil(row: Record<string, unknown>): string | Date | null {
  const version = row.version_valid_until;
  if (version != null && version !== '') return version as string | Date;
  const proposal = row.proposal_valid_until ?? row.valid_until;
  if (proposal != null && proposal !== '') return proposal as string | Date;
  return null;
}

export async function tickQuoteExpiry(
  now: Date,
  db: QuoteExpiryQueryPort,
): Promise<QuoteExpiryTickResult> {
  const listed = await db.query(
    `SELECT p.id, p.status, p.current_version_id,
            p.valid_until AS proposal_valid_until,
            v.valid_until AS version_valid_until
       FROM crm_proposals p
       LEFT JOIN crm_quote_versions v ON v.id = p.current_version_id
      WHERE p.status = ANY($1::text[])`,
    [QT_EXPIRABLE_STATUSES],
  );

  let expired = 0;
  for (const row of listed.rows) {
    const id = Number(row.id);
    const status = String(row.status ?? '');
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!(QT_EXPIRABLE_STATUSES as readonly string[]).includes(status)) continue;
    if (!isValidUntilPast(pickValidUntil(row), now)) continue;

    const updated = await db.query(
      `UPDATE crm_proposals
          SET status = 'expired', updated_at = NOW()
        WHERE id = $1
          AND status = ANY($2::text[])
        RETURNING id`,
      [id, QT_EXPIRABLE_STATUSES],
    );
    if (!updated.rows.length) continue;
    expired += 1;
    await db.query(
      `INSERT INTO crm_quote_activity (
         tenant_id, proposal_id, version_id, actor_staff_id, actor_kind, action, resource, snapshot_json
       ) VALUES ($1, $2, $3, NULL, 'system', 'quote.expired', 'quote', $4)`,
      [
        QT_TENANT_ID,
        id,
        row.current_version_id == null ? null : String(row.current_version_id),
        { from: status, to: 'expired', tz: QT_EXPIRY_TZ },
      ],
    );
  }

  return { expired };
}
