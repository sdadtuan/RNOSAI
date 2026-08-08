'use client';

interface Props {
  playbookLabel?: string | null;
  governanceNotes?: string[];
  qualityScore?: number | null;
  minScore?: number;
  gateOk?: boolean;
  gateRequired?: boolean;
  gateMessage?: string;
}

export function AiGovernanceBanner({
  playbookLabel,
  governanceNotes = [],
  qualityScore,
  minScore = 70,
  gateOk = true,
  gateRequired = false,
  gateMessage,
}: Props) {
  if (!playbookLabel && governanceNotes.length === 0 && !gateRequired) return null;

  const scoreLabel =
    qualityScore == null ? 'chưa có' : String(qualityScore);
  const gateColor = gateOk ? 'rgba(57, 139, 67, 0.08)' : 'rgba(255, 200, 0, 0.08)';
  const gateBorder = gateOk ? 'rgba(57, 139, 67, 0.35)' : '#c90';

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.45rem',
        padding: '0.65rem 0.75rem',
        borderRadius: 8,
        border: `1px solid ${gateBorder}`,
        background: gateColor,
        fontSize: '0.85rem',
      }}
    >
      <strong style={{ fontSize: '0.9rem' }}>
        Governance{playbookLabel ? ` · ${playbookLabel}` : ''}
      </strong>
      {gateRequired ? (
        <p style={{ margin: 0 }}>
          Campaign Quality Score: {scoreLabel}/{minScore}{' '}
          {gateOk ? '✓ đạt Launch QA gate' : '— chưa đạt Launch QA gate'}
        </p>
      ) : null}
      {!gateOk && gateMessage ? (
        <p className="muted" style={{ margin: 0 }}>
          {gateMessage}
        </p>
      ) : null}
      {governanceNotes.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {governanceNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
