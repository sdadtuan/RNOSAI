import { Injectable, NotFoundException } from '@nestjs/common';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import { KPI_HUB_ERROR_CODES, type HubSourceConnection } from '../kpi-hub.types';

@Injectable()
export class KpiHubSourcesService {
  async list(): Promise<{ items: HubSourceConnection[]; total: number }> {
    return withDbFallback(async () => null, () => ({
      items: kpiHubMemory.sources,
      total: kpiHubMemory.sources.length,
    }));
  }

  async refresh(id: string) {
    const src = kpiHubMemory.sources.find((s) => s.id === id);
    if (!src) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    src.last_success_at = new Date().toISOString();
    src.status = 'FRESH';
    src.last_error = null;
    return {
      ...src,
      message: `Đã làm mới nguồn ${src.name}`,
      refreshed_at: src.last_success_at,
    };
  }

  getBindingsForDictionary(dictionaryId: string) {
    const dict = kpiHubMemory.dictionary.find((d) => d.id === dictionaryId);
    if (!dict) return [];
    if (dict.code === 'MKT_006') {
      return [
        {
          role: 'NUMERATOR',
          connection_id: 'src-meta',
          connection_name: 'Meta Ads Insights',
          entity_name: 'AdInsights',
          agg: 'SUM',
          value_field: 'Spend',
          filters: ['Status = Active', 'Currency = VND'],
          status: 'CONNECTED',
        },
        {
          role: 'DENOMINATOR',
          connection_id: 'src-crm',
          connection_name: 'CRM Leads & Deals',
          entity_name: 'Leads',
          agg: 'DISTINCTCOUNT',
          value_field: 'Lead_ID',
          filters: ['Is_Valid = TRUE', 'Is_Duplicate = FALSE', 'Is_Test = FALSE'],
          status: 'CONNECTED',
        },
        {
          role: 'LOOKUP',
          connection_id: 'src-sharepoint',
          connection_name: 'SharePoint Campaign Mapping',
          entity_name: 'CampaignMapping',
          status: 'DELAYED',
          unmapped_count: 12,
          quality_pct: 96,
        },
      ];
    }
    return [
      {
        role: 'PRIMARY',
        connection_id: 'src-crm',
        connection_name: 'CRM Leads & Deals',
        entity_name: 'Leads',
        status: 'CONNECTED',
      },
    ];
  }
}
