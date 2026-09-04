import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffKpiHubViewGuard } from '../guards/staff-kpi-hub.guard';
import { kpiHubMemory } from '../kpi-hub.memory-store';
import { KpiHubFactsRepository } from '../facts/kpi-hub-facts.repository';
import { KPI_HUB_DEMO_FACTS } from '../connectors/kpi-hub-connector.port';

@Controller('api/crm/kpi-hub/bi')
@UseGuards(StaffOrInternalKeyGuard, StaffKpiHubViewGuard)
export class KpiHubBiController {
  constructor(private readonly facts: KpiHubFactsRepository) {}

  @Get('dim-kpi')
  dimKpi() {
    return {
      as_of: new Date().toISOString(),
      rows: kpiHubMemory.snapshotDictionary().map((d) => ({
        kpi_id: d.id,
        kpi_code: d.code,
        kpi_name: d.name,
        kpi_group: d.kpi_group,
        direction: d.direction,
        unit: d.unit,
        calc_kind: d.calc_kind,
        status: d.status,
        primary_source: d.primary_source,
        version: d.current_version,
      })),
    };
  }

  @Get('fact-actual')
  async factActual(@Query('from') from?: string, @Query('to') to?: string) {
    const periodStart = from ?? '2026-09-01';
    const codes = Object.keys(KPI_HUB_DEMO_FACTS);
    const factMap = await this.facts.getByCodes(periodStart, codes);
    return {
      as_of: new Date().toISOString(),
      period: { from: periodStart, to: to ?? '2026-09-30' },
      rows: codes.map((code) => {
        const row = factMap.get(code);
        return {
          kpi_code: code,
          period_start: periodStart,
          actual_value: row?.actual_value ?? KPI_HUB_DEMO_FACTS[code] ?? null,
          calculation_status: row?.calculation_status ?? 'SUCCESS',
          is_blank: row?.is_blank ?? false,
        };
      }),
    };
  }
}
