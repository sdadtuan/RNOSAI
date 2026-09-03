import type { HubPerfStatus } from '@/lib/kpi-hub-status';
import type { KpiHubDictStatus } from '@/lib/kpi-hub-fixtures';

const PERF_LABEL: Record<HubPerfStatus, string> = {
  ACHIEVED: 'Đạt',
  WARNING: 'Cảnh báo',
  CRITICAL: 'Nguy cấp',
  NO_DATA: 'Không có dữ liệu',
  NO_STATUS: '—',
};

const DICT_LABEL: Record<KpiHubDictStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Chờ duyệt',
  ACTIVE: 'Active',
  NEED_REVIEW: 'Need Review',
  DEPRECATED: 'Deprecated',
  ARCHIVED: 'Archived',
};

const SOURCE_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DELAYED: 'Delayed',
  FAILED: 'Failed',
  UNAVAILABLE: 'Unavailable',
};

type KpiHubStatusBadgeProps =
  | { kind: 'perf'; status: HubPerfStatus | string; label?: string }
  | { kind: 'dict'; status: KpiHubDictStatus | string }
  | { kind: 'source'; status: string }
  | { kind: 'freshness'; status: string };

export function KpiHubStatusBadge(props: KpiHubStatusBadgeProps) {
  const status = props.status.toLowerCase().replace(/_/g, '-');
  let label: string;
  if (props.kind === 'perf') {
    label = props.label ?? PERF_LABEL[props.status as HubPerfStatus] ?? String(props.status);
  } else if (props.kind === 'dict') {
    label = DICT_LABEL[props.status as KpiHubDictStatus] ?? String(props.status);
  } else if (props.kind === 'source') {
    label = SOURCE_LABEL[props.status] ?? props.status;
  } else {
    label = props.status;
  }
  return <span className={`kpi-hub-badge kpi-hub-badge--${status}`}>{label}</span>;
}
