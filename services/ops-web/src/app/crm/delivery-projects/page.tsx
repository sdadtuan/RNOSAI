'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DeliveryCapacityPanel } from '@/components/delivery/DeliveryCapacityPanel';
import { DeliveryCatalogTable } from '@/components/delivery/DeliveryCatalogTable';
import { DeliveryEmptyPanel } from '@/components/delivery/DeliveryEmptyPanel';
import { DeliveryGantt } from '@/components/delivery/DeliveryGantt';
import { DeliveryHealthDonut } from '@/components/delivery/DeliveryHealthDonut';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { DeliveryQualityPanel } from '@/components/delivery/DeliveryQualityPanel';
import { DeliveryRiskPanel } from '@/components/delivery/DeliveryRiskPanel';
import { DeliveryTiles } from '@/components/delivery/DeliveryTiles';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  fetchDeliveryCapacity,
  fetchDeliveryProjects,
  fetchDeliveryQuality,
  fetchDeliveryRisks,
  type CapacityTeamRow,
  type DeliveryProjectRow,
  type DeliveryQualitySnapshotRow,
  type DeliveryRiskRow,
} from '@/lib/delivery-projects-api';
import { buildPortfolioSummary } from '@/lib/delivery-portfolio-summary';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

type CapabilityFilter = 'all' | 'lead_ingest' | 'delivery' | 'both';

const CAP_FILTERS: Array<{ id: CapabilityFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'lead_ingest', label: 'Nhận lead' },
  { id: 'delivery', label: 'Giao hàng' },
  { id: 'both', label: 'Cả hai' },
];

export default function DeliveryProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capability = (searchParams.get('capability') as CapabilityFilter) || 'all';
  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';

  const [rows, setRows] = useState<DeliveryProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [risks, setRisks] = useState<DeliveryRiskRow[]>([]);
  const [capacityTeams, setCapacityTeams] = useState<CapacityTeamRow[]>([]);
  const [qualityItems, setQualityItems] = useState<DeliveryQualitySnapshotRow[]>([]);

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchDeliveryProjects(token, {
        capability: capability === 'all' ? undefined : capability,
        q: q || undefined,
        status: status || undefined,
      });
      setRows(out.items);
      const [riskOut, capOut, qualOut] = await Promise.all([
        fetchDeliveryRisks(token).catch(() => ({ items: [] as DeliveryRiskRow[] })),
        fetchDeliveryCapacity(token, 2).catch(() => ({ teams: [] as CapacityTeamRow[], range: { start: '', end: '' } })),
        fetchDeliveryQuality(token, period).catch(() => ({ items: [] as DeliveryQualitySnapshotRow[] })),
      ]);
      setRisks(riskOut.items);
      setCapacityTeams(capOut.teams);
      setQualityItems(qualOut.items);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        token = out.access_token;
        const data = await fetchDeliveryProjects(token, {
          capability: capability === 'all' ? undefined : capability,
          q: q || undefined,
          status: status || undefined,
        });
        setRows(data.items);
        const [riskOut, capOut, qualOut] = await Promise.all([
          fetchDeliveryRisks(token).catch(() => ({ items: [] as DeliveryRiskRow[] })),
          fetchDeliveryCapacity(token, 2).catch(() => ({ teams: [] as CapacityTeamRow[], range: { start: '', end: '' } })),
          fetchDeliveryQuality(token, period).catch(() => ({ items: [] as DeliveryQualitySnapshotRow[] })),
        ]);
        setRisks(riskOut.items);
        setCapacityTeams(capOut.teams);
        setQualityItems(qualOut.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải danh mục thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [capability, period, q, router, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => buildPortfolioSummary(rows), [rows]);

  function setCapability(next: CapabilityFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('capability');
    else params.set('capability', next);
    router.push(`/crm/delivery-projects?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/crm/delivery-projects');
  }

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="Project Delivery"
        subtitle="Danh mục dự án, tiến độ, ngân sách, nguồn lực và rủi ro bàn giao."
        breadcrumb={[{ label: 'KPI Hub', href: '/crm/kpi-hub/executive' }, { label: 'Project Delivery' }]}
        actions={
          <>
            <input
              type="month"
              className="delivery-filter-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Kỳ tháng"
            />
            <select className="delivery-filter-input" disabled title="Wave B">
              <option>Tất cả khách</option>
            </select>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled title="Wave C">
              Xuất báo cáo
            </button>
            <Link href="/crm/delivery-projects/new" className="kpi-hub-btn kpi-hub-btn--primary">
              + Tạo dự án
            </Link>
          </>
        }
      >
        <div className="delivery-page">
          <div className="delivery-filter-bar">
            <span className="delivery-filter-label">Năng lực</span>
            {CAP_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`delivery-chip${capability === f.id ? ' delivery-chip--active' : ''}`}
                onClick={() => setCapability(f.id)}
              >
                {f.label}
              </button>
            ))}
            <button type="button" className="delivery-chip delivery-chip--ghost" onClick={clearFilters}>
              Xóa bộ lọc
            </button>
          </div>

          {loading ? <p className="muted">Đang tải…</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <DeliveryTiles summary={summary} />

          <div className="delivery-split">
            <DeliveryGantt rows={rows} />
            <DeliveryHealthDonut
              rows={rows}
              onViewRisk={() => {
                setShowRiskPanel(true);
                router.push('/crm/delivery-projects/risks');
              }}
            />
          </div>

          <div className="delivery-split">
            <div className="delivery-panel" data-testid="delivery-budget-chart">
              <h3 className="delivery-panel__title">Ngân sách</h3>
              {rows.some((r) => r.contract_budget != null) ? (
                <div className="delivery-budget-chart-bars">
                  {rows
                    .filter((r) => r.contract_budget != null)
                    .slice(0, 6)
                    .map((r) => (
                      <div key={r.id} className="delivery-budget-chart-row">
                        <span className="delivery-budget-chart-row__label">{r.code ?? r.name.slice(0, 12)}</span>
                        <div className="delivery-budget-chart-row__track">
                          <div
                            className="delivery-budget-chart-row__bar delivery-budget-chart-row__bar--contract"
                            style={{ width: '100%' }}
                            title={`Hợp đồng ${r.contract_budget}`}
                          />
                          <div
                            className="delivery-budget-chart-row__bar delivery-budget-chart-row__bar--forecast"
                            style={{
                              width: `${Math.min(100, (Number(r.forecast_cost ?? 0) / Math.max(Number(r.contract_budget), 1)) * 100)}%`,
                            }}
                            title={`Forecast ${r.forecast_cost ?? '—'}`}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <DeliveryEmptyPanel title="Chưa có ngân sách" message="Thêm ngân sách trong wizard bước 4." />
              )}
            </div>
            <div className="delivery-panel" data-testid="delivery-risks">
              <div className="delivery-panel__head">
                <h3 className="delivery-panel__title">Rủi ro</h3>
                <Link href="/crm/delivery-projects/risks" className="delivery-link">
                  Xem Risk Register
                </Link>
              </div>
              {showRiskPanel || risks.length > 0 ? (
                <DeliveryRiskPanel items={risks} compact />
              ) : (
                <DeliveryEmptyPanel
                  title="Risk Register"
                  message="Bấm Xem Risk Register trên donut hoặc liên kết bên trên."
                />
              )}
            </div>
          </div>

          <DeliveryCatalogTable rows={rows} />

          <div className="delivery-split">
            <div className="delivery-panel" data-testid="delivery-capacity">
              <div className="delivery-panel__head">
                <h3 className="delivery-panel__title">Capacity</h3>
                <Link href="/crm/delivery-projects/capacity" className="delivery-link">
                  Xem Capacity Planning
                </Link>
              </div>
              <DeliveryCapacityPanel teams={capacityTeams.slice(0, 2)} />
            </div>
            <div className="delivery-panel" data-testid="delivery-quality">
              <div className="delivery-panel__head">
                <h3 className="delivery-panel__title">Quality</h3>
                <Link href="/crm/delivery-projects/quality" className="delivery-link">
                  Xem Delivery Quality
                </Link>
              </div>
              <DeliveryQualityPanel items={qualityItems.slice(0, 5)} />
            </div>
          </div>
        </div>
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
