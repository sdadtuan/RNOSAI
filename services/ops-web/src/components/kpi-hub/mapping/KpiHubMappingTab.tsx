'use client';

import Link from 'next/link';
import { KPI_HUB_MAPPING_CPL } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

export function SourceBindingTable() {
  const { bindings } = KPI_HUB_MAPPING_CPL;
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>Nguồn</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {bindings.map((b) => (
            <tr key={b.system}>
              <td>{b.system}</td>
              <td>{b.role}</td>
              <td>
                <KpiHubStatusBadge kind="source" status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MappingDetailCard({
  title,
  source,
  aggregation,
  preview,
}: {
  title: string;
  source: string;
  aggregation: string;
  preview: string;
}) {
  return (
    <article className="kpi-hub-card kpi-hub-mapping-card">
      <h3>{title}</h3>
      <p className="muted">{source}</p>
      <code>{aggregation}</code>
      <span className="kpi-hub-mapping-card__preview">Preview: {preview}</span>
    </article>
  );
}

export function MappingRulesRail() {
  const { rail } = KPI_HUB_MAPPING_CPL;
  return (
    <aside className="kpi-hub-rail">
      <section className="kpi-hub-card">
        <h3>Chiến lược join</h3>
        <p>{rail.strategy}</p>
        <p className="kpi-hub-table__mono">{rail.joinKey}</p>
      </section>
      <section className="kpi-hub-card">
        <h3>UTM & mapping table</h3>
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={rail.utmEnabled} />
          Bật UTM mapping
        </label>
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={rail.mappingTable} />
          Dùng bảng mapping
        </label>
      </section>
      <section className="kpi-hub-card">
        <h3>Lineage & chất lượng</h3>
        <p>
          Quality score: <strong>{rail.qualityPct}%</strong>
        </p>
        <p className="kpi-hub-warning-text">{rail.unmappedCount} campaign chưa được mapping</p>
        <Link href="/crm/kpi-hub/quality" className="kpi-hub-link-btn">
          Mở Data Quality
        </Link>
      </section>
    </aside>
  );
}

export function KpiHubMappingTab() {
  const { mappings } = KPI_HUB_MAPPING_CPL;
  return (
    <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
      <div className="kpi-hub-tab-panel__main">
        <SourceBindingTable />
        <div className="kpi-hub-mapping-cards">
          {mappings.map((m) => (
            <MappingDetailCard key={m.title} {...m} />
          ))}
        </div>
      </div>
      <MappingRulesRail />
    </div>
  );
}
