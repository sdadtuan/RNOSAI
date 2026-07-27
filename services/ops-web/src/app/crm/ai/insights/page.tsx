'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InsightsInboxTable } from '@/components/ai/InsightsInboxTable';
import { CopilotAdoptionPanel } from '@/components/ai/CopilotAdoptionPanel';
import { PipelineRiskPanel } from '@/components/ai/PipelineRiskPanel';
import { OpsNav } from '@/components/OpsNav';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import {
  fetchAiAcceptanceMetrics,
  fetchAiRecommendationsInbox,
  fetchPipelineRiskAtRisk,
  patchPipelineRiskAssign,
  postPipelineRiskActivity,
  type AiAcceptanceMetrics,
  type AiRecommendationInboxItem,
  type PipelineRiskDealRow,
  type RecommendationStatus,
} from '@/lib/ai-api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { formatPct } from '@/lib/kpi/format';
import { fetchCrmStaffList, staffMe, staffRefresh } from '@/lib/api';
import type { CrmStaffRow } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'accepted', label: 'Đã chấp nhận' },
  { value: 'dismissed', label: 'Đã bỏ' },
  { value: 'pending', label: 'Chờ xử lý' },
];

export default function CrmAiInsightsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [metrics, setMetrics] = useState<AiAcceptanceMetrics | null>(null);
  const [rows, setRows] = useState<AiRecommendationInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [atRiskDeals, setAtRiskDeals] = useState<PipelineRiskDealRow[]>([]);
  const [atRiskTotal, setAtRiskTotal] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_kpi_records', 'view')) {
        setError('Không có quyền xem AI insights');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const loadPage = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const [metricsOut, inboxOut, riskOut, staffOut] = await Promise.all([
          fetchAiAcceptanceMetrics(access, { days }),
          fetchAiRecommendationsInbox(access, {
            days,
            status: (status || undefined) as RecommendationStatus | undefined,
            limit: 100,
          }),
          fetchPipelineRiskAtRisk(access, { limit: 50 }).catch(() => ({
            data: { deals: [], total: 0, last_scan_at: null },
            meta: { request_id: '' },
            errors: [] as [],
          })),
          fetchCrmStaffList(access).catch(() => ({ staff: [], summary: {} })),
        ]);
        setMetrics(metricsOut.data);
        setRows(inboxOut.data.recommendations);
        setTotal(inboxOut.data.total);
        setAtRiskDeals(riskOut.data.deals);
        setAtRiskTotal(riskOut.data.total);
        setLastScanAt(riskOut.data.last_scan_at);
        setStaffOptions(staffOut.staff ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải AI insights thất bại');
      } finally {
        setLoading(false);
      }
    },
    [days, status],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadPage(access);
    })();
  }, [ensureAuth, loadPage]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const tiles = useMemo((): KpiTileProps[] => {
    const rate = metrics?.acceptance_rate_pct;
    const tone =
      rate == null ? 'default' : rate >= 35 ? 'success' : rate >= 20 ? 'warning' : 'critical';
    return [
      {
        label: 'Tỷ lệ chấp nhận AI',
        value: rate == null ? '—' : formatPct(rate),
        hint: `G6 · ${days} ngày · ${metrics?.accepted ?? 0} chấp nhận / ${metrics?.total_resolved ?? 0} quyết định`,
        tone,
      },
      {
        label: 'Đã chấp nhận',
        value: String(metrics?.accepted ?? 0),
        hint: `${metrics?.pending ?? 0} đang chờ`,
        tone: 'success',
      },
      {
        label: 'Đã bỏ',
        value: String(metrics?.dismissed ?? 0),
        hint:
          metrics?.top_dismiss_reasons?.[0]
            ? `Top: ${metrics.top_dismiss_reasons[0].reason} (${metrics.top_dismiss_reasons[0].count})`
            : undefined,
        tone: (metrics?.dismissed ?? 0) > 0 ? 'warning' : 'default',
      },
      {
        label: 'Tổng ghi nhận',
        value: String(total),
        hint: 'Inbox trong khoảng thời gian',
      },
    ];
  }, [metrics, days, total]);

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main className="ai-insights-page" style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <div className="ai-insights-page__head">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>AI Insights · Feedback loop</h2>
          <div className="ai-insights-page__filters">
            <label className="muted">
              Khoảng (ngày)
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 7)}
                className="kpi-input kpi-input--month"
                aria-label="Số ngày"
              />
            </label>
            <label className="muted">
              Trạng thái
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="kpi-select"
                aria-label="Lọc trạng thái"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const access = getAccessToken();
                if (access) void loadPage(access);
              }}
            >
              Làm mới
            </button>
          </div>
        </div>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <KpiTileGrid tiles={tiles} />

        {getAccessToken() ? (
          <CopilotAdoptionPanel token={getAccessToken()!} days={days} />
        ) : null}

        <PipelineRiskPanel
          rows={atRiskDeals}
          total={atRiskTotal}
          lastScanAt={lastScanAt}
          staffOptions={staffOptions}
          onAssignOwner={async (recommendationId, staffId, staffName) => {
            const access = getAccessToken();
            if (!access) return;
            await patchPipelineRiskAssign(access, recommendationId, { staff_id: staffId, staff_name: staffName });
            await loadPage(access);
          }}
          onLogActivity={async (recommendationId, note) => {
            const access = getAccessToken();
            if (!access) return;
            await postPipelineRiskActivity(access, recommendationId, { note });
            await loadPage(access);
          }}
        />

        <section className="ai-insights-page__section">
          <h3 className="kpi-section-title">Inbox gợi ý AI ({total})</h3>
          <InsightsInboxTable rows={rows} />
        </section>
      </div>
    </main>
  );
}
