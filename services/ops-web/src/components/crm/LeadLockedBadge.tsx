'use client';

/** Badge for a locked lead: Sai số, or Ẩn lead. */
export function LeadLockedBadge({
  compact,
  kind,
}: {
  compact?: boolean;
  kind?: 'hidden' | 'wrong_number' | '' | null;
}) {
  const hidden = kind === 'hidden';
  const label = hidden ? 'Lead đã ẩn' : 'Lead đã khóa (Sai số)';
  return (
    <span
      className="lead-locked-badge"
      data-testid="lead-locked-badge"
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '0.1rem 0.45rem' : '0.2rem 0.55rem',
        borderRadius: 999,
        background: hidden ? '#e7f3ea' : '#fde8e8',
        color: hidden ? '#17692f' : '#b42318',
        fontWeight: 600,
        fontSize: compact ? '0.75rem' : '0.8rem',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
