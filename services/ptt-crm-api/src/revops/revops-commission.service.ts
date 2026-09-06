import { ForbiddenException, Injectable } from '@nestjs/common';
import { calcCommissionVnd } from './commission/revops-commission.util';
import {
  REVOPS_COMMISSION_KPI_WEIGHTS,
  buildCommissionProjections,
} from './commission/revops-commission-hub.util';
import { hasRevopsCommissionCap } from './revops-scope.util';
import { REVOPS_TENANT_ID, RevopsW3Repository, isMissingRelation } from './revops-w3.repository';
import type {
  RevopsCommissionHubDto,
  RevopsCommissionPlanDto,
  RevopsCommissionSummaryDto,
  RevopsCommissionTransactionDto,
  RevopsCreateCommissionPlanBody,
  RevopsCreateCommissionTransactionBody,
  RevopsCreatePayoutBatchBody,
  RevopsPayoutBatchDto,
} from './revops.types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapPlan(row: Record<string, unknown>, tiers: Record<string, unknown>[]): RevopsCommissionPlanDto {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    version: num(row.version),
    effectiveFrom: String(row.effective_from ?? '').slice(0, 10),
    effectiveTo: row.effective_to ? String(row.effective_to).slice(0, 10) : null,
    revenueBasis: String(row.revenue_basis ?? ''),
    roleCode: String(row.role_code ?? ''),
    status: String(row.status ?? ''),
    tiers: tiers.map((t) => ({
      id: String(t.id ?? ''),
      minAttainmentPct: num(t.min_attainment_pct),
      maxAttainmentPct: t.max_attainment_pct == null ? null : num(t.max_attainment_pct),
      ratePct: num(t.rate_pct),
    })),
  };
}

function mapTransaction(row: Record<string, unknown>): RevopsCommissionTransactionDto {
  return {
    id: String(row.id ?? ''),
    dealRef: String(row.deal_ref ?? ''),
    staffId: num(row.staff_id),
    eligibleVnd: num(row.eligible_vnd),
    ratePct: num(row.rate_pct),
    splitPct: num(row.split_pct),
    commissionVnd: num(row.commission_vnd),
    status: String(row.status ?? ''),
    payoutBatchId: row.payout_batch_id ? String(row.payout_batch_id) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapBatch(row: Record<string, unknown>): RevopsPayoutBatchDto {
  return {
    id: String(row.id ?? ''),
    period: String(row.period ?? ''),
    status: String(row.status ?? ''),
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

@Injectable()
export class RevopsCommissionService {
  constructor(private readonly db: RevopsW3Repository) {}

  async getSummary(): Promise<RevopsCommissionSummaryDto> {
    try {
      const result = await this.db.query(
        `SELECT status, COALESCE(SUM(commission_vnd), 0)::bigint AS total
           FROM crm_revops_commission_transactions
          WHERE tenant_id = $1
          GROUP BY status`,
        [REVOPS_TENANT_ID],
      );
      let estimatedVnd = 0;
      let pendingVnd = 0;
      let approvedVnd = 0;
      for (const row of result.rows) {
        const status = String(row.status ?? '');
        const total = num(row.total);
        if (status === 'pending_collection' || status === 'pending_finance') {
          pendingVnd += total;
          estimatedVnd += total;
        } else if (status === 'approved' || status === 'paid') {
          approvedVnd += total;
          estimatedVnd += total;
        } else if (status === 'clawback') {
          estimatedVnd += total;
          pendingVnd += total;
        }
      }
      return { estimatedVnd, approvedVnd, pendingVnd };
    } catch (err) {
      if (isMissingRelation(err)) {
        return { estimatedVnd: null, approvedVnd: null, pendingVnd: null };
      }
      throw err;
    }
  }

  async getHub(): Promise<RevopsCommissionHubDto> {
    const [summary, plansOut, txOut, batchesOut, staffRows] = await Promise.all([
      this.getSummary(),
      this.listPlans(),
      this.listTransactions(100),
      this.listPayoutBatches(),
      this.listStaffRollup(),
    ]);
    const transactions = txOut.items;
    const projections = buildCommissionProjections(
      transactions.map((t) => ({ dealRef: t.dealRef, commissionVnd: t.commissionVnd })),
      summary.estimatedVnd,
    );
    const activePlan =
      plansOut.items.find((p) => p.status === 'published') ??
      plansOut.items.find((p) => p.status === 'draft') ??
      plansOut.items[0] ??
      null;
    return {
      summary,
      weights: { ...REVOPS_COMMISSION_KPI_WEIGHTS },
      projections,
      staffRows,
      transactions: transactions.slice(0, 50),
      payoutBatches: batchesOut.items,
      activePlan,
      fetchedAt: new Date().toISOString(),
    };
  }

  private async listStaffRollup(): Promise<
    Array<{
      staffId: number;
      name: string;
      estimatedVnd: number;
      approvedVnd: number;
      pendingVnd: number;
      transactionCount: number;
    }>
  > {
    try {
      const result = await this.db.query(
        `SELECT t.staff_id,
                COALESCE(cs.name, 'Staff #' || t.staff_id::text) AS name,
                COALESCE(SUM(t.commission_vnd), 0)::bigint AS estimated_vnd,
                COALESCE(SUM(CASE WHEN t.status IN ('approved', 'paid') THEN t.commission_vnd ELSE 0 END), 0)::bigint AS approved_vnd,
                COALESCE(SUM(CASE WHEN t.status IN ('pending_collection', 'pending_finance', 'clawback') THEN t.commission_vnd ELSE 0 END), 0)::bigint AS pending_vnd,
                COUNT(*)::int AS transaction_count
           FROM crm_revops_commission_transactions t
           LEFT JOIN crm_staff cs ON cs.id = t.staff_id
          WHERE t.tenant_id = $1
          GROUP BY t.staff_id, cs.name
          ORDER BY estimated_vnd DESC
          LIMIT 50`,
        [REVOPS_TENANT_ID],
      );
      return result.rows.map((row) => ({
        staffId: num(row.staff_id),
        name: String(row.name ?? ''),
        estimatedVnd: num(row.estimated_vnd),
        approvedVnd: num(row.approved_vnd),
        pendingVnd: num(row.pending_vnd),
        transactionCount: num(row.transaction_count),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  async listPlans(): Promise<{ items: RevopsCommissionPlanDto[] }> {
    try {
      const plans = await this.db.query(
        `SELECT id, name, version, effective_from, effective_to, revenue_basis, role_code, status
           FROM crm_revops_commission_plans
          WHERE tenant_id = $1
          ORDER BY name, version DESC`,
        [REVOPS_TENANT_ID],
      );
      const items: RevopsCommissionPlanDto[] = [];
      for (const row of plans.rows) {
        const tiers = await this.db.query(
          `SELECT id, min_attainment_pct, max_attainment_pct, rate_pct
             FROM crm_revops_commission_tiers
            WHERE plan_id = $1::uuid
            ORDER BY min_attainment_pct`,
          [row.id],
        );
        items.push(mapPlan(row, tiers.rows));
      }
      return { items };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async createPlan(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreateCommissionPlanBody,
  ): Promise<RevopsCommissionPlanDto> {
    this.requireManage(caps);
    const name = String(body.name ?? '').trim();
    if (!name) throw new ForbiddenException({ error: 'name_required' });
    const version = Math.max(1, num(body.version) || 1);
    const effectiveFrom = String(body.effective_from ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      throw new ForbiddenException({ error: 'effective_from_invalid' });
    }
    const revenueBasis = String(body.revenue_basis ?? 'collected');
    const roleCode = String(body.role_code ?? 'ae');
    const tiers = body.tiers ?? [];
    if (!tiers.length) throw new ForbiddenException({ error: 'tiers_required' });

    return this.db.withTransaction!(async (query) => {
      const inserted = await query(
        `INSERT INTO crm_revops_commission_plans (
           tenant_id, name, version, effective_from, effective_to, revenue_basis, role_code, status
         ) VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, 'draft')
         RETURNING id, name, version, effective_from, effective_to, revenue_basis, role_code, status`,
        [
          REVOPS_TENANT_ID,
          name,
          version,
          effectiveFrom,
          body.effective_to?.trim() || null,
          revenueBasis,
          roleCode,
        ],
      );
      const plan = inserted.rows[0];
      const tierRows: Record<string, unknown>[] = [];
      for (const tier of tiers) {
        const t = await query(
          `INSERT INTO crm_revops_commission_tiers (plan_id, min_attainment_pct, max_attainment_pct, rate_pct)
           VALUES ($1::uuid, $2, $3, $4)
           RETURNING id, min_attainment_pct, max_attainment_pct, rate_pct`,
          [plan.id, tier.min_attainment_pct, tier.max_attainment_pct ?? null, tier.rate_pct],
        );
        tierRows.push(t.rows[0]!);
      }
      return mapPlan(plan, tierRows);
    });
  }

  async listTransactions(limit = 100): Promise<{ items: RevopsCommissionTransactionDto[] }> {
    try {
      const result = await this.db.query(
        `SELECT id, deal_ref, staff_id, eligible_vnd, rate_pct, split_pct, commission_vnd, status,
                payout_batch_id, created_at
           FROM crm_revops_commission_transactions
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [REVOPS_TENANT_ID, Math.min(500, Math.max(1, limit))],
      );
      return { items: result.rows.map(mapTransaction) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async recordTransaction(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreateCommissionTransactionBody,
  ): Promise<RevopsCommissionTransactionDto> {
    this.requireManage(caps);
    const dealRef = String(body.deal_ref ?? '').trim();
    const staffId = num(body.staff_id);
    const eligibleVnd = num(body.eligible_vnd);
    const ratePct = num(body.rate_pct);
    const splitPct = body.split_pct == null ? 100 : num(body.split_pct);
    if (!dealRef || staffId <= 0 || eligibleVnd <= 0 || ratePct <= 0) {
      throw new ForbiddenException({ error: 'invalid_transaction' });
    }
    const commissionVnd =
      body.commission_vnd != null ? num(body.commission_vnd) : calcCommissionVnd(eligibleVnd, ratePct, splitPct);
    const status = String(body.status ?? 'pending_collection');

    const inserted = await this.db.query(
      `INSERT INTO crm_revops_commission_transactions (
         tenant_id, deal_ref, staff_id, eligible_vnd, rate_pct, split_pct, commission_vnd, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, deal_ref, staff_id, eligible_vnd, rate_pct, split_pct, commission_vnd, status,
                 payout_batch_id, created_at`,
      [REVOPS_TENANT_ID, dealRef, staffId, eligibleVnd, ratePct, splitPct, commissionVnd, status],
    );
    return mapTransaction(inserted.rows[0]!);
  }

  async listPayoutBatches(): Promise<{ items: RevopsPayoutBatchDto[] }> {
    try {
      const result = await this.db.query(
        `SELECT id, period, status, locked_at, created_at
           FROM crm_revops_payout_batches
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        [REVOPS_TENANT_ID],
      );
      return { items: result.rows.map(mapBatch) };
    } catch (err) {
      if (isMissingRelation(err)) return { items: [] };
      throw err;
    }
  }

  async createPayoutBatch(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreatePayoutBatchBody,
  ): Promise<RevopsPayoutBatchDto> {
    this.requireManage(caps);
    const period = String(body.period ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new ForbiddenException({ error: 'period_invalid' });
    }
    const inserted = await this.db.query(
      `INSERT INTO crm_revops_payout_batches (tenant_id, period, status)
       VALUES ($1, $2, 'draft')
       RETURNING id, period, status, locked_at, created_at`,
      [REVOPS_TENANT_ID, period],
    );
    return mapBatch(inserted.rows[0]!);
  }

  async lockPayoutBatch(
    caps: Array<{ section: string; action: string }>,
    id: string,
  ): Promise<RevopsPayoutBatchDto> {
    this.requireManage(caps);
    const updated = await this.db.query(
      `UPDATE crm_revops_payout_batches
          SET status = 'locked', locked_at = now()
        WHERE tenant_id = $1 AND id = $2::uuid AND status = 'draft'
        RETURNING id, period, status, locked_at, created_at`,
      [REVOPS_TENANT_ID, id],
    );
    if (!updated.rows[0]) throw new ForbiddenException({ error: 'batch_not_found' });
    return mapBatch(updated.rows[0]);
  }

  private requireManage(caps: Array<{ section: string; action: string }>): void {
    if (!hasRevopsCommissionCap(caps, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_revops.commission', action: 'manage' });
    }
  }
}
