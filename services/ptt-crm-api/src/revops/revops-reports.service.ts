import { BadRequestException, Injectable } from '@nestjs/common';
import { RevopsCommissionService } from './revops-commission.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsRoutingService } from './revops-routing.service';
import { RevopsSlaService } from './revops-sla.service';
import {
  buildCommissionLiability,
  buildReportCsv,
  buildRevenueMix,
  buildRevenueTrend,
  isRevopsReportSlug,
  quarterLabel,
  seedReportLibrary,
  sumClawbackVnd,
  type RevopsReportSlug,
} from './reports/revops-reports.util';
import type {
  RevopsDashboardActor,
  RevopsReportsDto,
  RevopsReportsQuery,
} from './revops.types';

@Injectable()
export class RevopsReportsService {
  constructor(
    private readonly dashboard: RevopsDashboardService,
    private readonly commission: RevopsCommissionService,
    private readonly sla: RevopsSlaService,
    private readonly routing: RevopsRoutingService,
  ) {}

  async get(actor: RevopsDashboardActor, query: RevopsReportsQuery): Promise<RevopsReportsDto> {
    const period = query.period?.trim() || undefined;
    const bu = query.bu?.trim() || 'all';
    const territory = query.territory?.trim() || 'all';

    const [center, hub, slaCenter, territoryCenter] = await Promise.all([
      this.dashboard.get(actor, { period, bu: bu === 'all' ? undefined : bu, scope: query.scope }),
      this.commission.getHub(),
      this.sla.getCenter(),
      this.routing.getCenter(),
    ]);

    const fetchedAt = new Date().toISOString();
    const activePeriod = center.period;
    const revenueTrend = buildRevenueTrend(
      activePeriod,
      center.revenue.actualVnd,
      center.revenue.targetVnd,
    );
    const revenueMix = buildRevenueMix({
      newVnd: hub.projections.newVnd,
      renewalVnd: hub.projections.renewalVnd,
      upsellVnd: hub.projections.upsellVnd,
    });
    const clawbackVnd = sumClawbackVnd(hub.transactions);
    const commissionLiability = buildCommissionLiability({
      estimatedVnd: hub.summary.estimatedVnd,
      approvedVnd: hub.summary.approvedVnd,
      pendingVnd: hub.summary.pendingVnd,
      clawbackVnd: clawbackVnd > 0 ? clawbackVnd : null,
    });

    const territoryOptions = [
      { value: 'all', label: 'Tất cả territory' },
      ...territoryCenter.territories.map((t) => ({ value: t.id, label: t.name })),
    ];

    return {
      filters: {
        period: activePeriod,
        periodLabel: quarterLabel(activePeriod),
        bu,
        territory,
        currency: 'VND',
      },
      territoryOptions,
      cards: {
        revenueVsForecast: {
          periodLabel: quarterLabel(activePeriod),
          points: revenueTrend,
        },
        revenueMix,
        commissionLiability,
      },
      library: seedReportLibrary(fetchedAt),
      slaSnapshot: {
        compliancePct: slaCenter.kpis.compliancePct,
        breaches: slaCenter.kpis.breaches,
        incidentCount: slaCenter.incidents.length,
      },
      atRisk: center.atRisk,
      transactions: hub.transactions.slice(0, 100),
      slaIncidents: slaCenter.incidents.slice(0, 100),
      fetchedAt,
    };
  }

  async exportCsv(
    actor: RevopsDashboardActor,
    slug: string,
    query: RevopsReportsQuery,
  ): Promise<{ filename: string; csv: string }> {
    if (!isRevopsReportSlug(slug)) {
      throw new BadRequestException('Unknown report');
    }
    const data = await this.get(actor, query);
    const csv = buildReportCsv(slug as RevopsReportSlug, {
      period: data.filters.period,
      bu: data.filters.bu,
      territory: data.filters.territory,
      revenueTrend: data.cards.revenueVsForecast.points,
      revenueMix: {
        totalVnd: data.cards.revenueMix.totalVnd,
        rows: data.cards.revenueMix.rows.map((r) => ({
          key: r.key as 'new' | 'renewal' | 'upsell',
          label: r.label,
          vnd: r.vnd,
          pct: r.pct,
        })),
      },
      commission: data.cards.commissionLiability,
      sla: {
        compliancePct: data.slaSnapshot.compliancePct,
        breaches: data.slaSnapshot.breaches,
        incidents: data.slaIncidents.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          dueAt: i.dueAt,
        })),
      },
      atRisk: data.atRisk,
      transactions: data.transactions.map((t) => ({
        id: t.id,
        dealRef: t.dealRef,
        commissionVnd: t.commissionVnd,
        status: t.status,
      })),
    });
    return { filename: `revops-${slug}-${data.filters.period}.csv`, csv };
  }
}
