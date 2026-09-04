'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DeliveryDetailTabs } from '@/components/delivery/DeliveryDetailTabs';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchB2bProject, patchB2bProject, type B2bProjectDetail } from '@/lib/b2b-projects-api';
import { fetchDeliveryProject, type DeliveryProjectRow } from '@/lib/delivery-projects-api';
import { hasCapability, normalizeCapabilities } from '@/lib/delivery-projects.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffRefresh } from '@/lib/api';
import { B2B_PROJECT_STATUS_LABELS, type B2bProjectStatus } from '@/lib/b2b-project-util';

export default function DeliveryProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<DeliveryProjectRow | null>(null);
  const [b2b, setB2b] = useState<B2bProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const canManageB2b = Boolean(user && hasCap(user, 'crm_b2b_projects', 'manage'));

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const row = await fetchDeliveryProject(token, id);
      setProject(row);
      if (row.b2b_project_id) {
        const detail = await fetchB2bProject(token, row.b2b_project_id);
        setB2b(detail);
      }
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
        const row = await fetchDeliveryProject(token, id);
        setProject(row);
        if (row.b2b_project_id) {
          const detail = await fetchB2bProject(token, row.b2b_project_id);
          setB2b(detail);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveIngest(patch: { status?: B2bProjectStatus; ai_call_enabled?: boolean; manual_ingest_enabled?: boolean }) {
    if (!project?.b2b_project_id || !canManageB2b) return;
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await patchB2bProject(token, project.b2b_project_id, patch);
      setB2b(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ingest thất bại');
    } finally {
      setSaving(false);
    }
  }

  const ingestPanel =
    b2b && hasCapability(normalizeCapabilities(project?.capabilities ?? []), 'lead_ingest') ? (
      <div className="delivery-ingest-panel">
        <dl className="delivery-dl">
          <dt>Mã webhook</dt>
          <dd>
            <code>{b2b.code}</code>
          </dd>
          <dt>Trạng thái</dt>
          <dd>
            {canManageB2b ? (
              <select
                value={b2b.status}
                disabled={saving}
                onChange={(e) => void saveIngest({ status: e.target.value as B2bProjectStatus })}
              >
                {Object.entries(B2B_PROJECT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              B2B_PROJECT_STATUS_LABELS[b2b.status as B2bProjectStatus] ?? b2b.status
            )}
          </dd>
        </dl>
        <label className="delivery-toggle">
          <input
            type="checkbox"
            checked={Boolean(b2b.ai_call_enabled)}
            disabled={!canManageB2b || saving}
            onChange={(e) => void saveIngest({ ai_call_enabled: e.target.checked })}
          />
          <span>AI call</span>
        </label>
        <label className="delivery-toggle">
          <input
            type="checkbox"
            checked={Boolean(b2b.manual_ingest_enabled)}
            disabled={!canManageB2b || saving}
            onChange={(e) => void saveIngest({ manual_ingest_enabled: e.target.checked })}
          />
          <span>Nhập lead thủ công</span>
        </label>
        {project?.b2b_project_id ? (
          <p className="delivery-hint">
            Cấu hình kênh Page/OA: mở chi tiết B2B cũ qua catalog hoặc API `/api/v1/b2b-projects/{id}`.
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="Chi tiết dự án"
        subtitle={project?.name ?? ''}
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: project?.code ?? project?.ingest_code ?? id },
        ]}
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {project ? <DeliveryDetailTabs project={project} ingestPanel={ingestPanel} /> : null}
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
