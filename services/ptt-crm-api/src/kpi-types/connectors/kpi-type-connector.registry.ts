import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { KpiTypeDivideByZero, KpiTypeSourceHealth } from '../kpi-types.types';
import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';
import { AdsMetaKpiTypeAdapter } from './ads-meta.adapter';
import { CrmFinanceKpiTypeAdapter } from './crm-finance.adapter';
import { CrmLeadKpiTypeAdapter } from './crm-lead.adapter';
import {
  applyDivideByZero,
  type KpiTypeDataSourceAdapter,
  type KpiTypePreviewPeriod,
  type KpiTypePreviewResult,
} from './kpi-type-connector.port';
import { UnavailableKpiTypeAdapter } from './unavailable.adapter';

@Injectable()
export class KpiTypeConnectorRegistry implements OnModuleDestroy {
  private pool: Pool | null = null;
  private adapters: Map<string, KpiTypeDataSourceAdapter> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private get map(): Map<string, KpiTypeDataSourceAdapter> {
    if (!this.adapters) {
      this.adapters = new Map<string, KpiTypeDataSourceAdapter>([
        ['crm_lead', new CrmLeadKpiTypeAdapter(this.db)],
        ['ads_meta', new AdsMetaKpiTypeAdapter(this.db)],
        ['crm_finance', new CrmFinanceKpiTypeAdapter(this.db)],
        ['unavailable', new UnavailableKpiTypeAdapter()],
      ]);
    }
    return this.adapters;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.adapters = null;
  }

  adapterForKey(adapterKey: string): KpiTypeDataSourceAdapter {
    return this.map.get(adapterKey) ?? this.map.get('unavailable')!;
  }

  adapterForEntity(entity: string): KpiTypeDataSourceAdapter {
    if (entity === 'Lead') return this.adapterForKey('crm_lead');
    if (entity === 'AdSpend') return this.adapterForKey('ads_meta');
    if (entity === 'AttributedRevenue') return this.adapterForKey('crm_finance');
    return this.adapterForKey('unavailable');
  }

  async preview(
    ast: KpiFormulaAst,
    period: KpiTypePreviewPeriod,
    fallback: KpiTypeDivideByZero = 'ERROR',
  ): Promise<KpiTypePreviewResult> {
    if (ast.aggregation === 'RATE' && ast.rate) {
      const num = await this.preview(ast.rate.numerator, period, fallback);
      const den = await this.preview(ast.rate.denominator, period, fallback);
      if (num.health === 'CONNECTION_ERROR' || den.health === 'CONNECTION_ERROR') {
        return {
          value: null,
          records_scanned: null,
          health: 'CONNECTION_ERROR',
          error: num.error ?? den.error ?? 'CONNECTION_ERROR',
        };
      }
      if (num.health === 'UNAVAILABLE' || den.health === 'UNAVAILABLE') {
        return { value: null, records_scanned: null, health: 'UNAVAILABLE', error: 'SOURCE_UNAVAILABLE' };
      }
      if (num.value == null || den.value == null) {
        return {
          value: null,
          records_scanned: (num.records_scanned ?? 0) + (den.records_scanned ?? 0),
          health: num.health === 'STALE' || den.health === 'STALE' ? 'STALE' : 'HEALTHY',
        };
      }
      const divided = applyDivideByZero(num.value, den.value, fallback);
      return {
        value: divided.value,
        records_scanned: (num.records_scanned ?? 0) + (den.records_scanned ?? 0),
        health: num.health === 'STALE' || den.health === 'STALE' ? 'STALE' : 'HEALTHY',
        error: divided.error,
      };
    }
    return this.adapterForEntity(ast.entity).preview(ast, period);
  }

  async checkHealth(adapterKey: string): Promise<KpiTypeSourceHealth> {
    return this.adapterForKey(adapterKey).checkHealth();
  }
}
