import { labelKpiTypeStatus } from '@/lib/kpi-type-util';

export function KpiTypeStatusBadge({ status }: { status: string }) {
  return (
    <span className={`kpi-type-badge kpi-type-badge--${status.toLowerCase()}`}>
      {labelKpiTypeStatus(status)}
    </span>
  );
}
