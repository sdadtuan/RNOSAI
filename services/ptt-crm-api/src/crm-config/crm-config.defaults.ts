import {
  SALES_PIPELINE_LABELS_VI,
  SALES_PIPELINE_STAGES,
  STAGE_OWNER_ROLE,
  STAGE_SLA_HOURS,
  TERMINAL_STAGES,
} from '../sales/sales-pipeline.util';
import type { PipelineStageDef } from './crm-config.types';

export const DEFAULT_SALES_PIPELINE_KEY = 'sales';

export function defaultSalesPipelineStages(): Omit<
  PipelineStageDef,
  'id' | 'pipeline_key' | 'updated_at'
>[] {
  return SALES_PIPELINE_STAGES.map((stageKey, index) => ({
    stage_key: stageKey,
    label: SALES_PIPELINE_LABELS_VI[stageKey] ?? stageKey,
    sort_order: index,
    sla_hours: STAGE_SLA_HOURS[stageKey] ?? 0,
    owner_role: STAGE_OWNER_ROLE[stageKey] ?? '',
    is_terminal: TERMINAL_STAGES.has(stageKey),
    active: true,
  }));
}
