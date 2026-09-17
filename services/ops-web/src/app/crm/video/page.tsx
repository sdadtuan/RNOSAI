'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VideoSopCommandCenter } from '@/components/video-sop/VideoSopCommandCenter';
import { clearSession, getStoredUser, hasCap, type StoredStaffUser } from '@/lib/auth';
import { ensureStaffAccessToken } from '@/lib/crm/staff-session';
import { parseLifecycleIdQuery } from '@/lib/crm/video-sop-routes';
import { VIDEO_SOP_API, type VdProductionReport, type VdProjectRow } from '@/lib/video-sop-api';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function CrmVideoSopListPage() {
  return (
    <Suspense fallback={<p className="vd-status">Đang tải Video SOP…</p>}>
      <CrmVideoSopListContent />
    </Suspense>
  );
}

function CrmVideoSopListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lifecycleId = parseLifecycleIdQuery(searchParams.get('lifecycle_id'));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<VdProjectRow[]>([]);
  const [report, setReport] = useState<VdProductionReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    const cached = getStoredUser();
    if (cached) setUser(cached);
    const out = await ensureStaffAccessToken();
    if (out.cleared || !out.token || !out.user) {
      router.replace('/login');
      return null;
    }
    setUser(out.user);
    if (!canViewVideoSop(out.user)) {
      setError('Không có quyền Video SOP');
      return null;
    }
    return out.token;
  }, [router]);

  useEffect(() => {
    void (async () => {
      let access: string | null = null;
      try {
        access = await ensureAuth();
      } catch {
        clearSession();
        router.replace('/login');
        return;
      }
      if (!access || !isVideoSopEnabled()) return;
      if (!lifecycleId) {
        setRows([]);
        setReport(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [projects, productionReport] = await Promise.all([
          VIDEO_SOP_API.listProjects(access, lifecycleId),
          VIDEO_SOP_API.getProductionReport(access, lifecycleId).catch(() => null),
        ]);
        setRows(projects);
        setReport(productionReport);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Video SOP thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, router]);

  if (!user) {
    return <p className="vd-status">Đang tải…</p>;
  }

  if (!isVideoSopEnabled()) {
    return <p className="vd-empty">Module tắt</p>;
  }

  if (error === 'Không có quyền Video SOP') {
    return <p className="vd-status vd-status--error">{error}</p>;
  }

  return (
    <VideoSopCommandCenter
      lifecycleId={lifecycleId}
      projects={rows}
      report={report}
      loading={loading}
      error={error}
    />
  );
}
