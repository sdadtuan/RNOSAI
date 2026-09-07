'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createCpVideo,
  formatCpApiError,
  listCpVideos,
  type CpScope,
  type CpVideoDraft,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpVideoList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [videos, setVideos] = useState<CpVideoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setVideos((await listCpVideos(token, scope)).items);
    } catch (caught) {
      setVideos([]);
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
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError('');
    try {
      const video = await createCpVideo(token, {
        project_id: String(form.get('project_id') ?? '').trim(),
        name: String(form.get('name') ?? '').trim(),
        input_mode: 'prompt',
        config_json: {},
      }, scope);
      router.push(`/crm/creative-os/video/${video.id}?scope=${scope}`);
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
          <p className="cp-muted">Mở draft trong Video Studio hoặc tạo draft mới.</p>
        </div>
        <div className="cp-actions">
          <Link className="cp-btn" href={`/crm/creative-os/video/templates?scope=${scope}`}>Mẫu video</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/batch?scope=${scope}`}>Tạo hàng loạt</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/ops?scope=${scope}`}>Render Ops</Link>
        </div>
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      <section className="cp-card">
        <div className="cp-card__head"><h2>Tạo draft</h2></div>
        <form className="cp-filters" onSubmit={create}>
          <label><span>Project ID</span><input name="project_id" required /></label>
          <label><span>Tên video</span><input name="name" required /></label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={creating}>{creating ? 'Đang tạo…' : 'Mở Studio'}</button>
        </form>
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
