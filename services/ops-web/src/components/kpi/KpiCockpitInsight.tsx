import Link from 'next/link';
import type { CockpitInsight } from '@/lib/kpi/cockpit-summary';

export function KpiCockpitInsight({ insight }: { insight: CockpitInsight }) {
  return (
    <aside className="kpi-insight">
      <p>{insight.headline}</p>
      <ul className="kpi-insight__actions">
        {insight.actions.map((text) => (
          <li key={text}>
            <label>
              <input type="checkbox" disabled /> {text}
            </label>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/crm/ai/insights" className="nav-link">
          Xem AI Insights
        </Link>
      </p>
    </aside>
  );
}

export default KpiCockpitInsight;
