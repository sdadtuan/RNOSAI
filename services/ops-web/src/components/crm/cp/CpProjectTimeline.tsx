'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  getCpProject,
  listCpProjectMilestones,
  type CpMilestone,
  type CpProject,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function date(value: string | null): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('vi-VN').format(parsed)
    : value;
}

export function CpProjectTimeline({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<CpProject | null>(null);
  const [milestones, setMilestones] = useState<CpMilestone[]>([]);
  const [loading, setLoading] = useState(true);
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
      const [projectOut, milestoneOut] = await Promise.all([
        getCpProject(token, projectId),
        listCpProjectMilestones(token, projectId),
      ]);
      setProject(projectOut);
      setMilestones(milestoneOut.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được timeline');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Project Timeline</p>
          <h1>{project?.name ?? 'Project Timeline'}</h1>
          <p className="cp-muted">Cột mốc và trạng thái của project.</p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/projects/${projectId}`}>Workspace</Link>
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      <section className="cp-card" aria-busy={loading}>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead><tr><th>Ngày</th><th>Cột mốc</th><th>Owner</th><th>Phụ thuộc</th><th>Status</th></tr></thead>
            <tbody>
              {milestones.length ? milestones.map((milestone) => (
                <tr key={milestone.id}>
                  <td>{date(milestone.due_at)}</td>
                  <td>{milestone.title}</td>
                  <td>{dash(milestone.owner_id)}</td>
                  <td>{dash(milestone.depends_on_id)}</td>
                  <td><span className="cp-pill">{dash(milestone.status)}</span></td>
                </tr>
              )) : <tr><td className="cp-empty" colSpan={5}>{loading ? 'Đang tải…' : dash(null)}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
