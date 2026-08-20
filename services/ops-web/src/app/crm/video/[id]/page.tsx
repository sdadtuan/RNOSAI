'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { staffMe, staffRefresh } from '@/lib/api';
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
import { VIDEO_SOP_API, type VdProjectRow } from '@/lib/video-sop-api';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function CrmVideoSopDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<VdProjectRow | null>(null);
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
      if (!canViewVideoSop(me)) {
        setError('Không có quyền Video SOP');
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
      if (!canViewVideoSop(me)) {
        setError('Không có quyền Video SOP');
        return null;
      }
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access || !isVideoSopEnabled()) return;
      setLoading(true);
      setError('');
      try {
        setProject(await VIDEO_SOP_API.getProject(access, projectId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Video SOP thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, projectId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Video SOP" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Video SOP">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title={project?.title || (projectId ? `Video #${projectId}` : 'Video SOP')}
      subtitle="Tổng quan dự án (SC-02)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: project?.title || `#${projectId}` },
      ]}
    >
      <div className="page-card stack-gap">
        <p
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            border: '1px solid var(--border, #d0d5dd)',
            background: 'rgba(15, 23, 42, 0.04)',
          }}
        >
          S1 — Brief/Gate 1 chưa mở (S3/S5)
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {project ? (
          <dl style={{ margin: 0, display: 'grid', gap: '0.45rem' }}>
            <div>
              <dt className="muted">id</dt>
              <dd style={{ margin: 0 }}>{project.id}</dd>
            </div>
            <div>
              <dt className="muted">stage</dt>
              <dd style={{ margin: 0 }}>{project.stage}</dd>
            </div>
            <div>
              <dt className="muted">cmkt_item_id</dt>
              <dd style={{ margin: 0 }}>{project.cmkt_item_id ?? '—'}</dd>
            </div>
            <div>
              <dt className="muted">lifecycle Content OS</dt>
              <dd style={{ margin: 0 }}>
                <Link
                  href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}
                  className="nav-link"
                >
                  lifecycle #{project.lifecycle_id}
                </Link>
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
