'use client';

/** Small red badge for leads locked after Sales confirmed Sai số. */
export function LeadLockedBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      className="lead-locked-badge"
      data-testid="lead-locked-badge"
      title="Lead đã khóa (Sai số)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '0.1rem 0.45rem' : '0.2rem 0.55rem',
        borderRadius: 999,
        background: '#fde8e8',
        color: '#b42318',
        fontWeight: 600,
        fontSize: compact ? '0.75rem' : '0.8rem',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      Lead đã khóa (Sai số)
    </span>
  );
}
