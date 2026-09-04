'use client';

import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  KpiHubQualityFreshness,
  KpiHubQualityIssueDrawer,
  KpiHubQualityRulesTable,
  KpiHubQualityScore,
  KpiHubQualitySummaryCards,
  KpiHubQualityTrend,
} from '@/components/kpi-hub/quality/KpiHubQualityPanels';
import { getAccessToken } from '@/lib/auth';
import { fetchKpiHubQuality, runKpiHubQualityCheck } from '@/lib/kpi-hub-api';
import { KPI_HUB_QUALITY } from '@/lib/kpi-hub-fixtures';
import { normalizeQuality } from '@/lib/kpi-hub-normalize';

type QualityData = ReturnType<typeof normalizeQuality>;

export default function KpiHubQualityPage() {
  const token = getAccessToken() ?? '';
  const [issueOpen, setIssueOpen] = useState(false);
  const [data, setData] = useState<QualityData>(KPI_HUB_QUALITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKpiHubQuality(token)
      .then((raw) => {
        if (!cancelled) setData(normalizeQuality(raw));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được Data Quality');
          setData(KPI_HUB_QUALITY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleRunCheck() {
    if (!token) return;
    setRunning(true);
    try {
      const raw = await runKpiHubQualityCheck(token);
      setData(normalizeQuality(raw));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chạy kiểm tra thất bại');
    } finally {
      setRunning(false);
    }
  }

  return (
    <KpiHubPageGate section="crm_kpi_quality">
      <KpiHubShell
        title="Data Quality"
        subtitle="Giám sát chất lượng dữ liệu KPI Hub"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Data Quality' }]}
        actions={
          <>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              Xuất báo cáo
            </button>
            <button
              type="button"
              className="kpi-hub-btn kpi-hub-btn--primary"
              disabled={running}
              onClick={handleRunCheck}
            >
              {running ? 'Đang chạy…' : 'Chạy kiểm tra'}
            </button>
          </>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <div className={`kpi-hub-page-with-drawer${issueOpen ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <div className="kpi-hub-quality-top">
              <KpiHubQualityScore score={data.score} loading={loading} />
              <KpiHubQualitySummaryCards data={data} loading={loading} />
            </div>
            <div className="kpi-hub-dash-row kpi-hub-dash-row--2">
              <KpiHubQualityTrend trend={data.trend} />
              <KpiHubQualityFreshness freshness={data.freshness} />
            </div>
            <KpiHubQualityRulesTable rules={data.rules} onSelectIssue={() => setIssueOpen(true)} />
          </div>
          <KpiHubQualityIssueDrawer issue={data.issue} open={issueOpen} onClose={() => setIssueOpen(false)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
