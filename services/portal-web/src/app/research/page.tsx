'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { HubPageLayout } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalResearchRagSearch } from '@/components/PortalResearchRagSearch';
import { PortalThemeQuarterTable } from '@/components/PortalThemeQuarterTable';
import {
  portalResearchReports,
  portalResearchThemeQuarterAnalytics,
  type PortalResearchReportCard,
  type PortalThemeQuarterAnalyticsPayload,
} from '@/lib/api';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { portalResearchErrorVi } from '@/lib/portal-research-errors';

const PORTAL_THEME_ANALYTICS_BANNER =
  'Chỉ insight đã published cùng khách. Đếm theo theme gắn trên insight, bucket theo quý (updated_at).';

export default function PortalResearchListPage() {
  return (
    <PortalPageShell
      breadcrumb={[{ label: 'Client Portal', href: '/dashboard' }, { label: 'Nghiên cứu' }]}
    >
      {({ token }) => <ResearchListContent token={token} />}
    </PortalPageShell>
  );
}

function ResearchListContent({ token }: { token: string }) {
  const [items, setItems] = useState<PortalResearchReportCard[]>([]);
  const [themeData, setThemeData] = useState<PortalThemeQuarterAnalyticsPayload | null>(null);
  const [selectedThemeCode, setSelectedThemeCode] = useState('');
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const yearOptions = useMemo(() => {
    const current = new Date().getUTCFullYear();
    return [current, current - 1, current - 2];
  }, []);

  useEffect(() => {
    if (!isMarketResearchPortalFeEnabled()) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [reports, themes] = await Promise.all([
          portalResearchReports(token),
          portalResearchThemeQuarterAnalytics(token, { year }),
        ]);
        setItems(reports.items ?? []);
        setThemeData(themes);
      } catch (err) {
        setError(portalResearchErrorVi(err instanceof Error ? err.message : ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, year]);

  if (!isMarketResearchPortalFeEnabled()) {
    return (
      <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố">
        <p className="muted">Nghiên cứu thị trường chưa bật.</p>
      </HubPageLayout>
    );
  }

  return (
    <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố — chỉ xem">
      <section className="stack-gap" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Theme theo quý</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
            Năm
            <select
              className="kpi-input"
              value={year}
              disabled={loading}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {PORTAL_THEME_ANALYTICS_BANNER}
        </p>
        {themeData ? (
          <PortalThemeQuarterTable
            rows={themeData.rows}
            year={themeData.year}
            selectedThemeCode={selectedThemeCode}
            onThemeClick={setSelectedThemeCode}
          />
        ) : null}
      </section>
      <PortalResearchRagSearch token={token} prefillThemeCode={selectedThemeCode || undefined} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="muted">Chưa có báo cáo được công bố.</p>
      ) : (
        <ul className="portal-content-list">
          {items.map((item) => (
            <li key={item.version_id} className="portal-content-list__item">
              <Link href={`/research/${item.version_id}`} className="portal-content-list__link">
                Phiên bản {item.version}
              </Link>
              <span className="muted">
                {item.as_of ? `As of ${item.as_of}` : 'As of —'}
                {item.expires_at ? ` · Hết hạn ${item.expires_at}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </HubPageLayout>
  );
}
