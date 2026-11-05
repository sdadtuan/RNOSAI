'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { VideoSopAssetLibrary } from '@/components/video-sop/VideoSopAssetLibrary';
import { VideoSopPageChrome } from '@/components/video-sop/VideoSopPageChrome';
import { resolveLibraryLifecycleId } from '@/components/video-sop/video-sop-asset-library.util';
import { clearSession, getStoredUser, hasCap, type StoredStaffUser } from '@/lib/auth';
import { ensureStaffAccessToken } from '@/lib/crm/staff-session';
import { VD_SOP_LAST_PROJECT_KEY } from '@/lib/crm/video-sop-nav';
import { parseLifecycleIdQuery } from '@/lib/crm/video-sop-routes';
import { VIDEO_SOP_API, type VdLibraryAssetRow, type VdProjectRow } from '@/lib/video-sop-api';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function VideoSopLibraryPage() {
  return (
    <Suspense fallback={<p className="vd-status">Đang tải Asset Library…</p>}>
      <VideoSopLibraryContent />
    </Suspense>
  );
}

function VideoSopLibraryContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id;
  const projectId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const valid = Number.isInteger(projectId) && projectId > 0;
  const queryLifecycleId = parseLifecycleIdQuery(searchParams.get('lifecycle_id'));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<VdProjectRow | null>(null);
  const [items, setItems] = useState<VdLibraryAssetRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'project' | 'lifecycle'>('project');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');

  useEffect(() => {
    if (valid) {
      window.localStorage.setItem(VD_SOP_LAST_PROJECT_KEY, String(projectId));
    }
  }, [projectId, valid]);

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
    if (!valid) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access || !isVideoSopEnabled()) return;
      try {
        setProject(await VIDEO_SOP_API.getProject(access, projectId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải project thất bại');
      }
    })();
  }, [ensureAuth, projectId, valid]);

  const lifecycleId = resolveLibraryLifecycleId(queryLifecycleId, project?.lifecycle_id);

  const loadAssets = useCallback(async () => {
    if (!lifecycleId) return;
    const access = await ensureAuth();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      const out = await VIDEO_SOP_API.searchAssets(access, {
        lifecycleId,
        projectId: scope === 'project' ? projectId : undefined,
        kind: kind || undefined,
        q: qApplied || undefined,
      });
      setItems(out.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tìm asset thất bại');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, lifecycleId, scope, projectId, kind, qApplied]);

  useEffect(() => {
    if (!lifecycleId || !isVideoSopEnabled()) return;
    void loadAssets();
  }, [lifecycleId, loadAssets]);

  if (!valid) {
    return (
      <VideoSopPageChrome title="Asset Library (SC-12)">
        <p className="vd-status vd-status--error">Project id không hợp lệ.</p>
      </VideoSopPageChrome>
    );
  }

  if (!user) {
    return (
      <VideoSopPageChrome title="Asset Library (SC-12)">
        <p className="vd-status">Đang tải…</p>
      </VideoSopPageChrome>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <VideoSopPageChrome title="Asset Library (SC-12)">
        <p className="vd-empty">Module tắt</p>
      </VideoSopPageChrome>
    );
  }

  if (!lifecycleId) {
    return (
      <VideoSopPageChrome title="Asset Library (SC-12)">
        <p className="vd-status vd-status--error">
          Thiếu lifecycle_id — mở từ Content Board / Command Center.
        </p>
      </VideoSopPageChrome>
    );
  }

  return (
    <VideoSopPageChrome
      title="Asset Library (SC-12)"
      subtitle={`Project #${projectId} · lifecycle ${lifecycleId}`}
    >
      <VideoSopAssetLibrary
        projectId={projectId}
        lifecycleId={lifecycleId}
        items={items}
        loading={loading}
        error={error}
        scope={scope}
        kind={kind}
        q={q}
        onScopeChange={setScope}
        onKindChange={setKind}
        onQChange={setQ}
        onSearch={() => setQApplied(q.trim())}
      />
    </VideoSopPageChrome>
  );
}
