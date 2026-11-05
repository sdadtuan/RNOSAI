'use client';

import { CLASSIFICATION_LABELS } from '@/lib/service-kpi-copy';

type Props = {
  classification: string;
};

export function SkpiClassificationBadge({ classification }: Props) {
  const meta = CLASSIFICATION_LABELS[classification] ?? {
    label: classification.replace(/_/g, ' '),
    tone: 'gray' as const,
  };
  return <span className={`kpi-hub-badge kpi-hub-badge--${meta.tone}`}>{meta.label}</span>;
}
