import { Injectable, Optional } from '@nestjs/common';
import { AM_TENANT_ID } from './am-audit.repository';
import { AmNotificationsService } from './am-notifications.service';
import { AmRenewalsRepository } from './am-renewals.service';
import { isUuid } from './am-tasks.service';

const ICT = 'Asia/Ho_Chi_Minh';
const WINDOW_OFFSETS = [90, 60, 30, 14, 7, 1] as const;
const NOTIFY_WINDOWS = new Set([14, 7, 1]);

export type AmRenewalWorkerResult = {
  inserted: number;
  skipped: number;
};

@Injectable()
export class AmRenewalWorker {
  constructor(
    private readonly db: AmRenewalsRepository,
    @Optional() private readonly notifications?: AmNotificationsService,
  ) {}

  async run(opts?: { asOf?: string }): Promise<AmRenewalWorkerResult> {
    const asOf = parseAsOf(opts?.asOf);
    const dates = WINDOW_OFFSETS.map((days) => addDaysYmd(asOf, days));
    let rows: Record<string, unknown>[] = [];
    try {
      const result = await this.db.query(
        `SELECT ct.id,
                TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                ct.ends_on,
                ct.status,
                ct.reference_code AS contract_ref,
                c.name AS client_name,
                e.account_owner_staff_id
           FROM crm_contracts ct
           LEFT JOIN clients c
                  ON TRIM(COALESCE(ct.agency_client_id, '')) <> ''
                 AND c.id::text = TRIM(COALESCE(ct.agency_client_id, ''))
           LEFT JOIN crm_am_account_ext e
                  ON e.tenant_id = $2
                 AND e.agency_client_id::text = TRIM(COALESCE(ct.agency_client_id, ''))
          WHERE lower(ct.status) IN ('active', 'renewing')
            AND ct.ends_on IS NOT NULL
            AND ct.ends_on::date = ANY($1::date[])`,
        [dates, AM_TENANT_ID],
      );
      rows = result.rows;
    } catch (err) {
      if (isMissingRelation(err)) return { inserted: 0, skipped: 0 };
      throw err;
    }

    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      const contractId = Number(row.id);
      const agencyClientId = String(row.agency_client_id ?? '').trim();
      if (!Number.isInteger(contractId) || contractId <= 0 || !isUuid(agencyClientId)) {
        skipped += 1;
        continue;
      }
      await this.notifyEnding(row, asOf);
      const open = await this.hasOpenCase(contractId);
      if (open) {
        skipped += 1;
        continue;
      }
      try {
        await this.db.query(
          `INSERT INTO crm_am_renewal_cases (tenant_id, agency_client_id, contract_id, status)
           VALUES ($1, $2::uuid, $3, 'not_started')
           RETURNING id::text AS id`,
          [AM_TENANT_ID, agencyClientId, contractId],
        );
        inserted += 1;
      } catch (err) {
        if (isUniqueViolation(err)) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }
    return { inserted, skipped };
  }

  private async hasOpenCase(contractId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT id::text AS id
         FROM crm_am_renewal_cases
        WHERE tenant_id = $1
          AND contract_id = $2
          AND status NOT IN ('renewed', 'lost')
        LIMIT 1`,
      [AM_TENANT_ID, contractId],
    );
    return result.rows.length > 0;
  }

  private async notifyEnding(row: Record<string, unknown>, asOf: string): Promise<void> {
    if (!this.notifications) return;
    const days = daysUntil(asOf, row.ends_on);
    if (!NOTIFY_WINDOWS.has(days)) return;
    const ownerId = Number(row.account_owner_staff_id);
    if (!Number.isInteger(ownerId) || ownerId <= 0) return;
    const client = String(row.client_name ?? '').trim() || 'hợp đồng';
    const ref = String(row.contract_ref ?? '').trim();
    await this.notifications.notify({
      staff_id: ownerId,
      kind: 'renewal.ending',
      title: ref ? `Gia hạn: ${client} · ${ref}` : `Gia hạn: ${client}`,
      href: '/crm/account-management/renewals',
    });
  }
}

function parseAsOf(raw: string | undefined): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ictYmd();
}

function ictYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function daysUntil(asOf: string, endsOn: unknown): number {
  const ymd = dayStr(endsOn);
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const end = ymd ? Date.parse(`${ymd}T00:00:00Z`) : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  return Math.round((end - start) / 86_400_000);
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}
