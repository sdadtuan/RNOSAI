import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';
import type {
  KpiTypeDataSourceAdapter,
  KpiTypePreviewPeriod,
  KpiTypePreviewResult,
} from './kpi-type-connector.port';

export class UnavailableKpiTypeAdapter implements KpiTypeDataSourceAdapter {
  readonly adapterKey = 'unavailable';

  async preview(
    _ast: KpiFormulaAst,
    _period: KpiTypePreviewPeriod,
  ): Promise<KpiTypePreviewResult> {
    return {
      value: null,
      records_scanned: null,
      health: 'UNAVAILABLE',
      error: 'SOURCE_UNAVAILABLE',
    };
  }

  async checkHealth() {
    return 'UNAVAILABLE' as const;
  }
}
