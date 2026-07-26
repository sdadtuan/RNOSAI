import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AgencyRepository } from '../agency/agency.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { ChurnHealthContextRepository } from './churn-health-context.repository';
import { computeChurnHealth } from './churn-health.engine';
import {
  ChurnHealthClientResponse,
  ChurnHealthClientView,
  ChurnHealthDashboardResponse,
  ChurnHealthSnapshot,
  ChurnScoreRequest,
  ChurnScoreResponse,
  CustomerHealthScoreRecord,
} from './churn-health.types';
import { CustomerHealthScoresRepository } from './customer-health-scores.repository';

const RESCORE_COOLDOWN_HOURS = 24;

@Injectable()
export class AiChurnHealthService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly scores: CustomerHealthScoresRepository,
    private readonly context: ChurnHealthContextRepository,
    private readonly agencyRepo: AgencyRepository,
  ) {}

  async scoreChurn(input: ChurnScoreRequest = {}): Promise<ChurnScoreResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'customer_health_scores_not_ready',
        message: 'Apply RNOS-01 DDL before churn scoring',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const force = Boolean(input.force);
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);

    let clientRows: Array<{ id: string; code: string; name: string; owner_am_id: string | null; status: string }> =
      [];

    if (input.client_id?.trim()) {
      const detail = await this.agencyRepo.fetchClient(input.client_id.trim());
      if (!detail) {
        throw new NotFoundException({ error: 'client_not_found', message: 'Agency client not found' });
      }
      clientRows = [
        {
          id: detail.id,
          code: detail.code,
          name: detail.name,
          owner_am_id: detail.owner_am_id,
          status: detail.status,
        },
      ];
    } else {
      const listed = await this.agencyRepo.listClients({
        status: 'active',
        limit,
        offset: 0,
      });
      clientRows = listed.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        owner_am_id: row.owner_am_id,
        status: row.status,
      }));
    }

    const signalMap = this.context.buildSignalsForClients(clientRows.map((row) => row.id));
    let scored = 0;
    let skipped = 0;

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.CHURN_SCORE,
        entityType: 'agency_client',
        entityId: input.client_id?.trim() || 'batch',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'churn-health-v1',
        input: { client_count: clientRows.length, force },
      },
      async () => {
        for (const client of clientRows) {
          if (!force && (await this.scores.wasScoredWithinHours(client.id, RESCORE_COOLDOWN_HOURS))) {
            skipped += 1;
            continue;
          }

          const health = computeChurnHealth({
            client_id: client.id,
            client_name: client.name,
            owner_am_id: client.owner_am_id,
            status: client.status,
            signals: signalMap.get(client.id) ?? {
              contract_days_until_end: null,
              contract_amount_vnd: 0,
              lifecycle_id: null,
              tickets_open: 0,
              tickets_last_7d: 0,
              tickets_prev_7d: 0,
              ticket_spike: false,
              negative_tickets_open: 0,
              payment_overdue_vnd: 0,
              payment_overdue_count: 0,
            },
          });

          await this.scores.insert({
            clientId: client.id,
            score: health.health_score,
            components: this.buildComponents(health, client.id),
          });
          scored += 1;
        }

        return {
          data: {
            scanned: clientRows.length,
            scored,
            skipped,
            agent_run_id: '',
            scored_at: new Date().toISOString(),
          },
          output: { scored, skipped, scanned: clientRows.length },
        };
      },
    );

    const data = wrapped.data;
    data.agent_run_id = wrapped.runId;
    return { data, meta: { request_id: requestId }, errors: [] };
  }

  async getDashboard(
    query: {
      sort?: string;
      order?: string;
      ticketSpike?: boolean;
      limit?: number;
      offset?: number;
    },
    correlationId?: string,
  ): Promise<ChurnHealthDashboardResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'customer_health_scores_not_ready',
        message: 'Apply RNOS-01 DDL before churn health dashboard',
      });
    }

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const sort = query.sort === 'score' ? 'score' : 'churn_risk';
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const ticketSpike = Boolean(query.ticketSpike);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const { rows, total } = await this.scores.listLatestDashboard({
      sort,
      order,
      ticketSpike,
      limit,
      offset,
    });

    const clients = await this.enrichRows(rows);

    return {
      data: {
        clients,
        total,
        filters: { sort, order, ticket_spike: ticketSpike },
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async getClientHealth(clientId: string, correlationId?: string): Promise<ChurnHealthClientResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'customer_health_scores_not_ready',
        message: 'Apply RNOS-01 DDL before client health',
      });
    }

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const row = await this.scores.findLatestByClient(clientId);
    if (!row) {
      return { data: null, meta: { request_id: requestId }, errors: [] };
    }

    const [view] = await this.enrichRows([row]);
    return { data: view ?? null, meta: { request_id: requestId }, errors: [] };
  }

  private buildComponents(health: ChurnHealthSnapshot, clientId: string): Record<string, unknown> {
    return {
      health_band: health.health_band,
      churn_risk_pct: health.churn_risk_pct,
      risk_level: health.risk_level,
      ticket_spike: health.ticket_spike,
      renewal_recommended: health.renewal_recommended,
      renewal_href: health.renewal_recommended ? `/agency/clients/${clientId}?tab=retain` : null,
      factors: health.factors,
      signals: health.signals,
    };
  }

  private async enrichRows(rows: CustomerHealthScoreRecord[]): Promise<ChurnHealthClientView[]> {
    const out: ChurnHealthClientView[] = [];
    for (const row of rows) {
      const detail = await this.agencyRepo.fetchClient(row.client_id);
      const components = row.components_json ?? {};
      const signals =
        (components.signals as ChurnHealthSnapshot['signals']) ??
        ({
          contract_days_until_end: null,
          contract_amount_vnd: 0,
          lifecycle_id: null,
          tickets_open: 0,
          tickets_last_7d: 0,
          tickets_prev_7d: 0,
          ticket_spike: false,
          negative_tickets_open: 0,
          payment_overdue_vnd: 0,
          payment_overdue_count: 0,
        } as ChurnHealthSnapshot['signals']);

      const health: ChurnHealthSnapshot = {
        health_score: Number(row.score),
        health_band: String(components.health_band ?? 'watch') as ChurnHealthSnapshot['health_band'],
        churn_risk_pct: Number(components.churn_risk_pct ?? 100 - Number(row.score)),
        risk_level: String(components.risk_level ?? 'medium') as ChurnHealthSnapshot['risk_level'],
        ticket_spike: Boolean(components.ticket_spike),
        factors: Array.isArray(components.factors) ? (components.factors as ChurnHealthSnapshot['factors']) : [],
        signals,
        renewal_recommended: Boolean(components.renewal_recommended),
      };

      out.push({
        client_id: row.client_id,
        client_code: detail?.code ?? '—',
        client_name: detail?.name ?? 'Client',
        owner_am_id: detail?.owner_am_id ?? null,
        status: detail?.status ?? 'active',
        health,
        score_id: row.id,
        calculated_at: row.calculated_at,
      });
    }
    return out;
  }
}
