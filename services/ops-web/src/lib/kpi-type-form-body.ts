import type { KpiTypeFormValues } from './kpi-type-form.util';
import type { CreateKpiTypeBody } from './kpi-types-api';

function numOrUndef(raw: string): number | undefined {
  if (!String(raw).trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function kpiTypeFormToBody(values: KpiTypeFormValues): CreateKpiTypeBody {
  return {
    kpi_group_id: values.kpi_group_id,
    code: values.code.trim(),
    name: values.name.trim(),
    short_name: values.short_name.trim() || undefined,
    description: values.description.trim() || undefined,
    direction: values.direction,
    value_type: values.value_type,
    unit_id: values.unit_id,
    decimal_places: values.decimal_places,
    target_mode: values.target_mode,
    minimum_target: numOrUndef(values.minimum_target) ?? null,
    default_target: Number(values.default_target),
    stretch_target: numOrUndef(values.stretch_target) ?? null,
    lower_limit: numOrUndef(values.lower_limit) ?? null,
    upper_limit: numOrUndef(values.upper_limit) ?? null,
    calculation_mode: values.calculation_mode,
    primary_data_source_id: values.primary_data_source_id || null,
    data_entity: values.data_entity || null,
    aggregation_type: values.aggregation_type || null,
    formula_expression: values.formula_expression.trim() || null,
    formula_display: values.formula_display.trim() || null,
    sync_frequency: values.sync_frequency || null,
    divide_by_zero_fallback: values.divide_by_zero_fallback,
    manual_evidence_required: values.manual_evidence_required,
    scope_type: values.scope_type,
    department_ids: values.department_ids.map(Number).filter((n) => Number.isFinite(n)),
    position_ids: values.position_ids,
    weight_min: numOrUndef(values.weight_min) ?? null,
    weight_max: numOrUndef(values.weight_max) ?? null,
    display_order: Number(values.display_order) || undefined,
    status: values.status,
  };
}
