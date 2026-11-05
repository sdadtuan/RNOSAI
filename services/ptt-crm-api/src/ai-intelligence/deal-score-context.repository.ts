import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { TERMINAL_STAGES } from '../sales/sales-pipeline.util';
import { DealScoreContext } from './deal-score.types';

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class DealScoreContextRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
  ) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async loadDealScoreContext(dealId: number): Promise<DealScoreContext | null> {
    const result = await this.db.query(
      `SELECT c.id, c.title, c.pipeline_stage, c.stage_entered_at, c.updated_at, c.status,
              COALESCE(c.deal_value_vnd, 0) AS deal_value_vnd,
              COUNT(e.id) FILTER (WHERE e.created_at >= NOW() - INTERVAL '7 days')::int AS n7,
              MAX(e.created_at) AS last_at
       FROM crm_cases c
       LEFT JOIN crm_case_events e ON e.case_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [dealId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const runtime = this.crmConfig.toPipelineRuntime();
    const stage = String(row.pipeline_stage ?? 'moi');
    const stageEnteredAt = parseDate(row.stage_entered_at) ?? parseDate(row.updated_at) ?? new Date();
    const updatedAt = parseDate(row.updated_at) ?? stageEnteredAt;

    return {
      dealId,
      clientId: null,
      title: String(row.title ?? ''),
      pipelineStage: stage,
      isTerminal: runtime.terminalStages.has(stage) || TERMINAL_STAGES.has(stage),
      dealValueVnd: Number(row.deal_value_vnd ?? 0),
      stageEnteredAt,
      updatedAt,
      lastActivityAt: parseDate(row.last_at),
      activityCount7d: Number(row.n7 ?? 0),
      status: String(row.status ?? ''),
    };
  }

  async listOpenDealIds(limit = 200): Promise<number[]> {
    const runtime = this.crmConfig.toPipelineRuntime();
    const terminal = [...runtime.terminalStages, ...TERMINAL_STAGES];
    const capped = Math.min(Math.max(limit, 1), 500);
    const result = await this.db.query(
      `SELECT c.id
       FROM crm_cases c
       WHERE NOT (COALESCE(c.pipeline_stage, 'moi') = ANY($1::text[]))
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT $2`,
      [terminal, capped],
    );
    return result.rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0);
  }
}
