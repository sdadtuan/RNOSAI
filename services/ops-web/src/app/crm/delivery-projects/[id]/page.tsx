'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { B2bProjectChannelsPanel } from '@/components/b2b/B2bProjectChannelsPanel';
import { Form, FormCheck, FormField, FormGrid, FormSection } from '@/components/form';
import { FormInput, FormSelect } from '@/components/form/FormControls';
import { DeliveryDetailTabs } from '@/components/delivery/DeliveryDetailTabs';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  fetchB2bProject,
  fetchB2bProjectChannels,
  fetchB2bProjectPages,
  patchB2bProject,
  type B2bProjectChannelRow,
  type B2bProjectDetail,
  type B2bProjectPageRow,
} from '@/lib/b2b-projects-api';
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
  const [pages, setPages] = useState<B2bProjectPageRow[]>([]);
  const [channels, setChannels] = useState<B2bProjectChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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

    const apply = async (access: string) => {
      const row = await fetchDeliveryProject(access, id);
      setProject(row);
      if (!row.b2b_project_id) {
        setB2b(null);
        setPages([]);
        setChannels([]);
        return;
      }
      const [detail, pageRows, channelRows] = await Promise.all([
        fetchB2bProject(access, row.b2b_project_id),
        fetchB2bProjectPages(access, row.b2b_project_id),
        fetchB2bProjectChannels(access, row.b2b_project_id),
      ]);
      setB2b(detail);
      setPages(pageRows);
      setChannels(channelRows);
    };

    try {
      await apply(token);
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
        await apply(token);
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
      <div className="delivery-ingest-stack">
        <div className="page-card">
          <Form asDiv>
            <FormSection title="Cài đặt nhận lead">
              <FormGrid cols={2}>
                <FormField label="Mã webhook">
                  <FormInput value={b2b.code} readOnly />
                </FormField>
                <FormField label="Trạng thái dự án">
                  <FormSelect
                    value={b2b.status}
                    disabled={!canManageB2b || saving}
                    onChange={(e) => void saveIngest({ status: e.target.value as B2bProjectStatus })}
                  >
                    {Object.entries(B2B_PROJECT_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
              </FormGrid>
              <div className="delivery-ingest-flags">
                <FormCheck label="AI call">
                  <input
                    type="checkbox"
                    checked={Boolean(b2b.ai_call_enabled)}
                    disabled={!canManageB2b || saving}
                    onChange={(e) => void saveIngest({ ai_call_enabled: e.target.checked })}
                  />
                </FormCheck>
                <FormCheck label="Nhập lead thủ công">
                  <input
                    type="checkbox"
                    checked={Boolean(b2b.manual_ingest_enabled)}
                    disabled={!canManageB2b || saving}
                    onChange={(e) => void saveIngest({ manual_ingest_enabled: e.target.checked })}
                  />
                </FormCheck>
              </div>
            </FormSection>
          </Form>
        </div>
        {project?.b2b_project_id ? (
          <B2bProjectChannelsPanel
            projectId={project.b2b_project_id}
            projectCode={b2b.code}
            pages={pages}
            channels={channels}
            canManage={canManageB2b}
            notice={notice}
            onMessage={setNotice}
            onError={setError}
            onSaved={() => void load()}
          />
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
