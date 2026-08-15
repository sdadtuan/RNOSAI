'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HubPageLayout } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import { portalResearchReports, type PortalResearchReportCard } from '@/lib/api';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { portalResearchErrorVi } from '@/lib/portal-research-errors';
import { PortalResearchRagSearch } from '@/components/PortalResearchRagSearch';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMarketResearchPortalFeEnabled()) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await portalResearchReports(token);
        setItems(data.items ?? []);
      } catch (err) {
        setError(portalResearchErrorVi(err instanceof Error ? err.message : ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!isMarketResearchPortalFeEnabled()) {
    return (
      <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố">
        <p className="muted">Nghiên cứu thị trường chưa bật.</p>
      </HubPageLayout>
    );
  }

  return (
    <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố — chỉ xem">
      <PortalResearchRagSearch token={token} />
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
