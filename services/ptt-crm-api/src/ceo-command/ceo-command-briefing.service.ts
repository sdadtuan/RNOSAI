import { Injectable } from '@nestjs/common';
import { AiNlQueryService } from '../ai-intelligence/ai-nl-query.service';
import { ManagerCoachService } from '../ai-intelligence/manager-coach.service';
import { PipelineRiskService } from '../ai-intelligence/pipeline-risk.service';
import { OpsDashboardService } from '../ops/ops-dashboard.service';
import { OpsService } from '../ops/ops.service';
import type { StaffCap } from './ceo-command-caps.util';
import { hasCeoFinanceView, hasOpsView } from './ceo-command-caps.util';
import {
  BRIEFING_INTENTS,
  cardsFromSources,
  withTimeout,
} from './ceo-command-briefing.util';
import type { CeoBriefingCard } from './ceo-command-briefing.util';

type BriefingResult = {
  cards: CeoBriefingCard[];
  reply_vi: string;
  facts_json: Record<string, unknown>;
  degraded: Array<{ source: string; reason: string }>;
};

@Injectable()
export class CeoCommandBriefingService {
  private readonly cache = new Map<string, { exp: number; value: BriefingResult }>();

  constructor(
    private readonly opsDashboard: OpsDashboardService,
    private readonly ops: OpsService,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly nlQuery: AiNlQueryService,
    private readonly managerCoach: ManagerCoachService,
  ) {}

  async compose(intent: string, actor: { staffId: number; caps: StaffCap[] }): Promise<BriefingResult> {
    if (!BRIEFING_INTENTS.has(intent)) {
      throw new Error('invalid_briefing_intent');
    }

    const cacheKey = `${actor.staffId}:${intent}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.exp > Date.now()) return cached.value;

    const degraded: Array<{ source: string; reason: string }> = [];
    const hasFinance = hasCeoFinanceView(actor.caps);
    const hasOps = hasOpsView(actor.caps);

    const needAll = intent === 'briefing_today';
    const needOps = needAll || intent === 'briefing_ops';
    const needPipeline = needAll || intent === 'briefing_pipeline';
    const needSla = needAll || intent === 'briefing_sla';
    const needFinance = intent === 'briefing_finance' || (needAll && hasFinance);
    const needCoach = needAll || intent === 'briefing_coach';

    let opsExec: { alerts_open: number; kpi_dat_pct: number } | null = null;
    let opsAlerts: Array<{ id: number; title?: string }> | undefined;
    let pipeline: Array<{ recommendation_id: string; title: string }> | undefined;
    let sla: { breach: number; warning: number } | null = null;
    let finance: { overdue: number; rev7: number; rev30: number } | null = null;
    let coach: { week_key: string; created_at: string } | null = null;

    if (needOps && hasOps) {
      try {
        const exec = await withTimeout(this.opsDashboard.getExecutiveDashboard(), 2500);
        opsExec = {
          alerts_open: exec.summary.alerts_open,
          kpi_dat_pct: exec.summary.kpi_dat_pct,
        };
      } catch (e) {
        degraded.push({
          source: 'ops_exec',
          reason: String((e as Error)?.message ?? 'failed'),
        });
      }
      try {
        const alerts = await withTimeout(this.ops.listAlerts({ status: 'open', limit: 8 }), 2500);
        opsAlerts = (alerts.items ?? []).map((a) => ({
          id: Number(a.id),
          title: String(a.title ?? a.message ?? ''),
        }));
      } catch (e) {
        degraded.push({
          source: 'ops_alerts',
          reason: String((e as Error)?.message ?? 'failed'),
        });
      }
    } else if (needOps && !hasOps) {
      degraded.push({ source: 'ops_exec', reason: 'missing_ops_cap' });
    }

    if (needPipeline) {
      try {
        const risk = await withTimeout(this.pipelineRisk.listAtRiskDeals(8, 0), 2500);
        pipeline = (risk.data?.deals ?? []).map((d) => ({
          recommendation_id: String(d.recommendation_id),
          title: String(d.title ?? `Deal #${d.deal_id}`),
        }));
      } catch (e) {
        degraded.push({ source: 'pipeline', reason: String((e as Error)?.message ?? 'failed') });
      }
    }

    if (needSla) {
      try {
        const breach = await withTimeout(
          this.nlQuery.runQuery({
            intent_id: 'sla_breach_summary',
            actorId: String(actor.staffId),
          }),
          2500,
        );
        const row = breach.data?.rows?.[0] as Record<string, unknown> | undefined;
        sla = {
          breach: Number(row?.breach ?? 0),
          warning: Number(row?.warning ?? 0),
        };
      } catch (e) {
        degraded.push({ source: 'sla', reason: String((e as Error)?.message ?? 'failed') });
      }
    }

    if (needFinance && hasFinance) {
      try {
        const [rev7, rev30, overdue] = await Promise.all([
          withTimeout(
            this.nlQuery.runQuery({
              intent_id: 'revenue_received_7d',
              actorId: String(actor.staffId),
            }),
            2500,
          ),
          withTimeout(
            this.nlQuery.runQuery({
              intent_id: 'revenue_received_30d',
              actorId: String(actor.staffId),
            }),
            2500,
          ),
          withTimeout(
            this.nlQuery.runQuery({
              intent_id: 'ops_payments_overdue',
              actorId: String(actor.staffId),
            }),
            2500,
          ),
        ]);
        finance = {
          rev7: Number((rev7.data?.rows?.[0] as Record<string, unknown>)?.amount_vnd ?? 0),
          rev30: Number((rev30.data?.rows?.[0] as Record<string, unknown>)?.amount_vnd ?? 0),
          overdue: Number((overdue.data?.rows?.[0] as Record<string, unknown>)?.count ?? 0),
        };
      } catch (e) {
        degraded.push({ source: 'finance', reason: String((e as Error)?.message ?? 'failed') });
      }
    }

    if (needCoach) {
      try {
        const digest = await withTimeout(this.managerCoach.getCurrentDigest(), 2500);
        const row = digest.data;
        if (row?.created_at) {
          const ageMs = Date.now() - new Date(String(row.created_at)).getTime();
          if (ageMs <= 8 * 86400000) {
            coach = {
              week_key: String(row.week_key ?? ''),
              created_at: String(row.created_at),
            };
          }
        }
      } catch (e) {
        degraded.push({ source: 'coach', reason: String((e as Error)?.message ?? 'failed') });
      }
    }

    const composed = cardsFromSources({
      opsExec: needOps ? opsExec : null,
      opsAlerts: needOps ? opsAlerts : undefined,
      pipeline: needPipeline ? pipeline : undefined,
      sla: needSla ? sla : null,
      finance: needFinance ? finance : null,
      coach: needCoach ? coach : null,
      hasFinanceCap: hasFinance,
    });

    const result: BriefingResult = { ...composed, degraded };
    this.cache.set(cacheKey, { exp: Date.now() + 60_000, value: result });
    return result;
  }
}
