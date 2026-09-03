'use client';

import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export function GovernanceTab({ row }: { row: KpiHubDictionaryRow }) {
  return (
    <div className="kpi-hub-tab-panel">
      <section className="kpi-hub-card">
        <h2>Governance</h2>
        <dl className="kpi-hub-drawer__dl">
          <div>
            <dt>Trạng thái</dt>
            <dd>{row.status}</dd>
          </div>
          <div>
            <dt>Data Owner</dt>
            <dd>{row.dataOwner}</dd>
          </div>
          <div>
            <dt>Phê duyệt</dt>
            <dd>Yêu cầu trước khi Publish</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
