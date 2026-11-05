'use client';

import { parseSourceTags } from '@/lib/kpi-hub-dictionary-utils';

type Props = {
  source?: string;
  sources?: string[];
  max?: number;
  tone?: 'table' | 'drawer';
};

function chipTone(tag: string, index: number): string {
  const key = tag.toLowerCase();
  if (key.includes('meta') || key.includes('ads')) return 'meta';
  if (key.includes('crm')) return 'crm';
  if (key.includes('share')) return 'share';
  if (key.includes('erp')) return 'erp';
  return index === 0 ? 'meta' : 'crm';
}

export function KpiHubSourceChips({ source = '', sources, max = 3, tone = 'table' }: Props) {
  const tags = sources?.length ? sources : parseSourceTags(source);
  if (!tags.length) return <span className="muted">—</span>;

  const visible = tags.slice(0, max);
  const rest = tags.length - visible.length;

  return (
    <div className={`kpi-hub-source-chips${tone === 'drawer' ? ' kpi-hub-source-chips--drawer' : ''}`}>
      {visible.map((tag, i) => (
        <span
          key={tag}
          className={`kpi-hub-source-chip${tone === 'drawer' ? ` kpi-hub-source-chip--${chipTone(tag, i)}` : ''}`}
        >
          {tag}
        </span>
      ))}
      {rest > 0 ? <span className="kpi-hub-source-chip kpi-hub-source-chip--more">+{rest}</span> : null}
    </div>
  );
}
