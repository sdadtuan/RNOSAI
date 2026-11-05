'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FormCombobox } from '@/components/form/FormCombobox';
import { getStoredUser, getAccessToken } from '@/lib/auth';
import { shouldShowVideoSopNav } from '@/components/ops-nav-video-sop';
import {
  createCpVideo,
  formatCpApiError,
  listCpProjects,
  listCpVideos,
  type CpProjectSummary,
  type CpScope,
  type CpVideoDraft,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { type CpPlaybookSummary } from '@/lib/crm/cp-playbook-api';
import { projectSearchOptions, videoSopHref } from '@/lib/crm/cp-video-list.util';
import { CpPlaybookPicker } from './CpPlaybookPicker';

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpVideoList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [videos, setVideos] = useState<CpVideoDraft[]>([]);
  const [projects, setProjects] = useState<CpProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get('project') ?? '');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<CpPlaybookSummary | null>(null);
  const [error, setError] = useState('');
  const showPlaybookPicker = !loading && !videos.length;

  const projectOptions = useMemo(() => projectSearchOptions(projects), [projects]);
  const sopHref = useMemo(() => {
    const selected = projects.find((row) => row.id === projectId);
    return videoSopHref(selected?.lifecycle_id);
  }, [projectId, projects]);
  const showVideoSop = shouldShowVideoSopNav(getStoredUser());

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [videoOut, projectOut] = await Promise.all([
        listCpVideos(token, scope),
        listCpProjects(token, { scope }),
      ]);
      setVideos(videoOut.items);
      setProjects(projectOut.items);
    } catch (caught) {
      setVideos([]);
      setProjects([]);
      setError(formatCpApiError(caught, 'Không tải được video drafts'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    if (!projectId) {
      setError('Chọn project trước khi mở Studio');
      return;
    }
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError('');
    try {
      const video = await createCpVideo(token, {
        project_id: projectId,
        name: String(form.get('name') ?? '').trim(),
        input_mode: 'prompt',
        config_json: selectedPlaybook
          ? { playbook_id: selectedPlaybook.id, qc_pack: selectedPlaybook.qc_pack }
          : {},
      }, scope);
      const playbookQuery = selectedPlaybook ? `&playbook=${encodeURIComponent(selectedPlaybook.id)}` : '';
      router.push(`/crm/creative-os/video/${video.id}?scope=${scope}${playbookQuery}`);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tạo được video draft'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video AI</p>
          <h1>Video drafts</h1>
          <p className="cp-muted">
            {CP_SUBTITLES.vidStudio}
          </p>
        </div>
        <div className="cp-actions">
          {showVideoSop ? (
            <Link className="cp-btn" href={sopHref}>Mở Video SOP</Link>
          ) : null}
          <Link className="cp-btn" href={`/crm/creative-os/video/templates?scope=${scope}`}>Mẫu video</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/batch?scope=${scope}`}>Tạo hàng loạt</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/ops?scope=${scope}`}>Render Ops</Link>
        </div>
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      {showPlaybookPicker ? (
        <section className="cp-card">
          <CpPlaybookPicker
            selectedId={selectedPlaybook?.id ?? null}
            onSelect={setSelectedPlaybook}
          />
        </section>
      ) : null}
      <section className="cp-card">
        <div className="cp-card__head"><h2>Tạo draft</h2></div>
        <form className="cp-filters" onSubmit={create}>
          <label>
            <span>Project</span>
            <FormCombobox
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
              loading={loading}
              allowCustom={false}
              showCode={false}
              placeholder="Tìm project…"
              emptyMessage="Không có project khớp — tạo ở Dự án"
            />
          </label>
          <label><span>Tên video</span><input name="name" required /></label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={creating || !projectId}>
            {creating ? 'Đang tạo…' : 'Mở Studio'}
          </button>
        </form>
        {!loading && !projects.length ? (
          <p className="cp-muted">
            Chưa có project.{' '}
            <Link className="cp-link" href="/crm/creative-os/projects/new">Tạo project</Link>
          </p>
        ) : null}
      </section>
      <section className="cp-card">
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead><tr><th>Tên</th><th>Mode</th><th>Revision</th><th>Autosaved</th><th /></tr></thead>
            <tbody>
              {videos.length ? videos.map((video) => (
                <tr key={video.id}>
                  <td>{dash(video.name)}</td>
                  <td>{dash(video.input_mode)}</td>
                  <td>{dash(video.revision)}</td>
                  <td>{dash(video.autosaved_at)}</td>
                  <td><Link className="cp-link" href={`/crm/creative-os/video/${video.id}?scope=${scope}`}>Studio</Link></td>
                </tr>
              )) : <tr><td className="cp-empty" colSpan={5}>{loading ? 'Đang tải…' : dash(null)}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
