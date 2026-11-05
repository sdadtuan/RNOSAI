import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { HubFormulaFilter } from '../formula/kpi-hub-formula.parser';
import { CrmLeadsHubAdapter } from './crm-leads.hub-adapter';
import type {
  KpiHubConnectorHealth,
  KpiHubConnectorPort,
  KpiHubQueryPeriod,
  KpiHubQueryResult,
} from './kpi-hub-connector.port';
import { MetaAdsHubAdapter } from './meta-ads.hub-adapter';

class UnavailableHubAdapter implements KpiHubConnectorPort {
  readonly adapterKey = 'unavailable';

  async checkHealth(): Promise<KpiHubConnectorHealth> {
    return 'UNAVAILABLE';
  }

  async query(): Promise<KpiHubQueryResult> {
    return { value: null, records_scanned: null, health: 'UNAVAILABLE', error: 'SOURCE_UNAVAILABLE' };
  }
}

@Injectable()
export class KpiHubConnectorRegistry implements OnModuleDestroy {
  private pool: Pool | null = null;
  private adapters: Map<string, KpiHubConnectorPort> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private get map(): Map<string, KpiHubConnectorPort> {
    if (!this.adapters) {
      this.adapters = new Map<string, KpiHubConnectorPort>([
        ['crm_lead', new CrmLeadsHubAdapter(this.db)],
        ['ads_meta', new MetaAdsHubAdapter(this.db)],
        ['unavailable', new UnavailableHubAdapter()],
      ]);
    }
    return this.adapters;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.adapters = null;
  }

  adapterForKey(key: string): KpiHubConnectorPort {
    return this.map.get(key) ?? this.map.get('unavailable')!;
  }

  adapterForEntity(entity: string): KpiHubConnectorPort {
    if (entity === 'Lead' || entity === 'Leads' || entity === 'Contracts' || entity === 'Deals') {
      return this.adapterForKey('crm_lead');
    }
    if (entity === 'AdInsights' || entity === 'AdSpend') {
      return this.adapterForKey('ads_meta');
    }
    return this.adapterForKey('unavailable');
  }

  async query(
    entity: string,
    agg: string,
    field: string | undefined,
    filters: HubFormulaFilter[],
    period: KpiHubQueryPeriod,
  ): Promise<KpiHubQueryResult> {
    return this.adapterForEntity(entity).query(entity, agg, field, filters, period);
  }

  async checkHealth(key: string): Promise<KpiHubConnectorHealth> {
    return this.adapterForKey(key).checkHealth();
  }
}
