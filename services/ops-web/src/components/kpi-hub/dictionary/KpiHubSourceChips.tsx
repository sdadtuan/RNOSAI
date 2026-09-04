'use client';

import { parseSourceTags } from '@/lib/kpi-hub-dictionary-utils';

type Props = {
  source?: string;
  sources?: string[];
  max?: number;
};

export function KpiHubSourceChips({ source = '', sources, max = 3 }: Props) {
  const tags = sources?.length ? sources : parseSourceTags(source);
  if (!tags.length) return <span className="muted">—</span>;

  const visible = tags.slice(0, max);
  const rest = tags.length - visible.length;

  return (
    <div className="kpi-hub-source-chips">
      {visible.map((tag) => (
        <span key={tag} className="kpi-hub-source-chip">
          {tag}
        </span>
      ))}
      {rest > 0 ? <span className="kpi-hub-source-chip kpi-hub-source-chip--more">+{rest}</span> : null}
    </div>
  );
}
