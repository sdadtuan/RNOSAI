import { Injectable } from '@nestjs/common';
import { AM_TENANT_ID } from './am-audit.repository';
import { AmRenewalsRepository } from './am-renewals.service';
import { isUuid } from './am-tasks.service';

const ICT = 'Asia/Ho_Chi_Minh';
const WINDOW_OFFSETS = [90, 60, 30, 14, 7, 1] as const;

export type AmRenewalWorkerResult = {
  inserted: number;
  skipped: number;
};

@Injectable()
export class AmRenewalWorker {
  constructor(private readonly db: AmRenewalsRepository) {}

  async run(opts?: { asOf?: string }): Promise<AmRenewalWorkerResult> {
    const asOf = parseAsOf(opts?.asOf);
    const dates = WINDOW_OFFSETS.map((days) => addDaysYmd(asOf, days));
    let rows: Record<string, unknown>[] = [];
    try {
      const result = await this.db.query(
        `SELECT ct.id,
                TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                ct.ends_on,
                ct.status
           FROM crm_contracts ct
          WHERE lower(ct.status) IN ('active', 'renewing')
            AND ct.ends_on IS NOT NULL
            AND ct.ends_on::date = ANY($1::date[])`,
        [dates],
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

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}
