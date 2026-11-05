import { labelKpiGroupStatus, labelKpiGroupScope, KPI_GROUP_STATUSES } from '@/lib/kpi-group-util';
import type { KpiGroupScopeType, KpiGroupStatus } from '@/lib/kpi-group-util';

type KpiGroupStatusBadgeProps = {
  status: string;
};

export function KpiGroupStatusBadge({ status }: KpiGroupStatusBadgeProps) {
  return <span className={`kpi-group-badge kpi-group-badge--${status.toLowerCase()}`}>{labelKpiGroupStatus(status)}</span>;
}

export { labelKpiGroupStatus, labelKpiGroupScope, KPI_GROUP_STATUSES };
export type { KpiGroupScopeType, KpiGroupStatus };
