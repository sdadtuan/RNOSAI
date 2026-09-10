import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_REVIEW_SLA_HOURS } from '../content-marketing/content-marketing.constants';
import {
  emptyPortfolioCommandCenter,
  PORTFOLIO_SLA_AT_RISK_HOURS,
  type PortfolioCommandCenter,
  type PortfolioRiskQueueItem,
} from './content-os-portfolio.types';

@Injectable()
export class ContentOsPortfolioRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM cmkt_content_items LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  async listScopedLifecycleIds(staffId: number): Promise<number[]> {
    if (!(await this.ensurePgReady())) return [];
    try {
      const params: unknown[] = [];
      const conditions = [`status IN ('active', 'draft')`];
      if (staffId > 0) {
        params.push(staffId);
        conditions.push(`(assigned_am = $${params.length} OR assigned_sp = $${params.length})`);
      }
      const res = await this.db.query(
        `SELECT id FROM crm_service_lifecycle
         WHERE ${conditions.join(' AND ')}
         ORDER BY id ASC`,
        params,
      );
      return res.rows.map((row) => Number(row.id));
    } catch {
      return [];
    }
  }

  async aggregateCommand(lifecycleIds: number[]): Promise<PortfolioCommandCenter> {
    const empty = emptyPortfolioCommandCenter();
    if (!lifecycleIds.length) return empty;
    if (!(await this.ensurePgReady())) return empty;
    try {
      const countsRes = await this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int AS throughput_week,
           COUNT(*) FILTER (
             WHERE status = 'published'
               AND published_at IS NOT NULL
               AND published_at >= NOW() - INTERVAL '7 days'
           )::int AS completed_week,
           COUNT(*) FILTER (WHERE status NOT IN ('published', 'archived'))::int AS wip,
           COUNT(*) FILTER (
             WHERE status IN ('in_review', 'changes_requested')
               AND in_review_at IS NOT NULL
               AND in_review_at < NOW() - ($2::int * INTERVAL '1 hour')
           )::int AS sla_at_risk,
           COUNT(*) FILTER (
             WHERE status IN ('in_review', 'changes_requested')
               AND in_review_at IS NOT NULL
               AND in_review_at < NOW() - ($3::int * INTERVAL '1 hour')
           )::int AS sla_breached,
           COUNT(*) FILTER (
             WHERE status = 'changes_requested'
                OR production_json->>'escalate_human' = 'true'
           )::int AS blocked
         FROM cmkt_content_items
         WHERE lifecycle_id = ANY($1::bigint[])`,
        [lifecycleIds, PORTFOLIO_SLA_AT_RISK_HOURS, CMKT_REVIEW_SLA_HOURS],
      );
      const row = countsRes.rows[0] ?? {};
      const risk_queue = await this.listRiskQueue(lifecycleIds);
      return {
        throughput_week: Number(row.throughput_week ?? 0),
        completed_week: Number(row.completed_week ?? 0),
        wip: Number(row.wip ?? 0),
        sla_at_risk: Number(row.sla_at_risk ?? 0),
        sla_breached: Number(row.sla_breached ?? 0),
        first_pass_pct: null,
        capacity_pct: null,
        blocked: Number(row.blocked ?? 0),
        risk_queue,
      };
    } catch {
      return empty;
    }
  }

  private async listRiskQueue(lifecycleIds: number[]): Promise<PortfolioRiskQueueItem[]> {
    const res = await this.db.query(
      `SELECT
         i.id AS item_id,
         i.lifecycle_id,
         i.title,
         i.status,
         i.in_review_at,
         i.production_json->>'escalate_human' AS escalate_human,
         CASE
           WHEN i.status IN ('in_review', 'changes_requested') AND i.in_review_at IS NOT NULL
           THEN $3::int - EXTRACT(EPOCH FROM (NOW() - i.in_review_at)) / 3600.0
           ELSE NULL
         END AS sla_remaining_h
       FROM cmkt_content_items i
       WHERE i.lifecycle_id = ANY($1::bigint[])
         AND (
           (
             i.status IN ('in_review', 'changes_requested')
             AND i.in_review_at IS NOT NULL
             AND i.in_review_at < NOW() - ($2::int * INTERVAL '1 hour')
           )
           OR i.status = 'changes_requested'
           OR i.production_json->>'escalate_human' = 'true'
         )
       ORDER BY i.in_review_at ASC NULLS LAST, i.id ASC
       LIMIT 50`,
      [lifecycleIds, PORTFOLIO_SLA_AT_RISK_HOURS, CMKT_REVIEW_SLA_HOURS],
    );
    return res.rows.map((row) => this.mapRiskRow(row as Record<string, unknown>));
  }

  private mapRiskRow(row: Record<string, unknown>): PortfolioRiskQueueItem {
    const status = String(row.status ?? '');
    const escalate = String(row.escalate_human ?? '') === 'true';
    const remaining =
      row.sla_remaining_h != null && Number.isFinite(Number(row.sla_remaining_h))
        ? Math.round(Number(row.sla_remaining_h) * 10) / 10
        : null;
    const blocked = status === 'changes_requested' || escalate;
    const slaBreached = remaining != null && remaining < 0;

    let risk_signal = 'SLA_AT_RISK';
    let recommended_action = 'Ưu tiên duyệt trước khi quá SLA';
    if (slaBreached) {
      risk_signal = 'SLA_BREACHED';
      recommended_action = 'Escalate SLA đã quá hạn';
    } else if (blocked) {
      risk_signal = 'BLOCKED';
      recommended_action = 'Gỡ block / escalate production';
    }

    return {
      item_id: Number(row.item_id),
      lifecycle_id: Number(row.lifecycle_id),
      content_code: null,
      title: String(row.title ?? ''),
      client_label: null,
      risk_signal,
      owner_label: null,
      sla_remaining_h: remaining,
      recommended_action,
    };
  }
}
