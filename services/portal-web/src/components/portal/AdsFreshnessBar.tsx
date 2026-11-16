import { adsUpdatedLabel } from '@/lib/portal/ads-live-refresh';

type AdsFreshnessBarProps = {
  updatedAt: Date | null;
  refreshing?: boolean;
  className?: string;
};

export function AdsFreshnessBar({ updatedAt, refreshing = false, className }: AdsFreshnessBarProps) {
  const classes = ['ads-freshness-bar', className].filter(Boolean).join(' ');
  return (
    <p className={classes} data-testid="ads-freshness" aria-live="polite">
      <span className="ads-freshness-bar__label">{adsUpdatedLabel(updatedAt)}</span>
      <span
        className={`ads-freshness-bar__indicator${refreshing ? ' is-on' : ''}`}
        aria-hidden={!refreshing}
        aria-label={refreshing ? 'Đang cập nhật' : undefined}
        role={refreshing ? 'status' : undefined}
      />
    </p>
  );
}
