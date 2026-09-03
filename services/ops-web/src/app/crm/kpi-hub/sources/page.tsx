'use client';

import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubStatusBadge } from '@/components/kpi-hub/KpiHubStatusBadge';
import { KPI_HUB_SOURCES } from '@/lib/kpi-hub-fixtures';

export default function KpiHubSourcesPage() {
  return (
    <KpiHubPageGate section="crm_kpi_hub_sources">
      <KpiHubShell
        title="Nguồn dữ liệu"
        subtitle="Catalog kết nối CRM, Ads, ERP và lookup tables"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Nguồn dữ liệu' }]}
        actions={
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
            Làm mới tất cả
          </button>
        }
      >
        <div className="kpi-hub-table-wrap">
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>Hệ thống</th>
                <th>Tên kết nối</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Đồng bộ lần cuối</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {KPI_HUB_SOURCES.map((src) => (
                <tr key={src.id}>
                  <td>{src.system}</td>
                  <td>{src.name}</td>
                  <td>{src.role}</td>
                  <td>
                    <KpiHubStatusBadge kind="source" status={src.status} />
                  </td>
                  <td>{src.lastSync}</td>
                  <td>
                    <button type="button" className="kpi-hub-link-btn" disabled={src.status === 'UNAVAILABLE'}>
                      Làm mới
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
