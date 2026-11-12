import { fmtDate, fmtDateTime, fmtPct } from '@/lib/format';
import type { PerformanceListResponse } from '@/lib/api';

interface PortalAttributionFooterProps {
  performance: PerformanceListResponse | null;
}

function attributionLabel(model: string): string {
  const map: Record<string, string> = {
    last_touch_crm: 'Lần chạm cuối (lead)',
    last_touch: 'Lần chạm cuối',
    first_touch: 'Lần chạm đầu',
    first_touch_crm: 'Lần chạm đầu (lead)',
  };
  return map[model] ?? model.split('_').join(' ');
}

function spendSourceLabel(src: string): string {
  const map: Record<string, string> = {
    meta_api: 'Meta',
    google_api: 'Google',
    zalo_api: 'Zalo',
    manual: 'Nhập tay',
  };
  return map[src] ?? src.split('_').join(' ');
}

export function PortalAttributionFooter({ performance }: PortalAttributionFooterProps) {
  if (!performance?.attribution_model) {
    return null;
  }

  const unmapped = performance.unmapped_spend_pct;
  const freshness = performance.data_freshness;

  return (
    <p className="muted portal-attribution-footer" style={{ margin: '1rem 0 0', fontSize: '0.85rem' }}>
      Gắn chuyển đổi: <strong>{attributionLabel(performance.attribution_model)}</strong>
      {unmapped != null ? (
        <>
          {' · '}
          Chi tiêu chưa gắn: <strong>{fmtPct(unmapped)}</strong>
        </>
      ) : null}
      {performance.spend_source ? (
        <>
          {' · '}
          Nguồn chi tiêu: {spendSourceLabel(performance.spend_source)}
        </>
      ) : null}
      {freshness?.through_date ? (
        <>
          {' · '}
          Dữ liệu đến {fmtDate(freshness.through_date)}
        </>
      ) : null}
      {freshness?.synced_at ? (
        <>
          {' · '}
          Đồng bộ {fmtDateTime(freshness.synced_at)}
        </>
      ) : null}
    </p>
  );
}
