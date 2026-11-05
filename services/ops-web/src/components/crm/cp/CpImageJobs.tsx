'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { listCpImageJobs, type CpImageJob } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';
import { CpImageJobModal, formatImageJobCredit } from './CpImageJobModal';

export function CpImageJobs() {
  const [jobs, setJobs] = useState<CpImageJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await listCpImageJobs(token);
      setJobs(out.items);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được jobs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Image Jobs</b></p>
          <h1>Image Job Orchestrator</h1>
          <p className="cp-muted">
            Policy → confirm → <b>Explore → Select → Refine → Upscale → Pack → QC</b>.
          </p>
          <p className="cp-sot">img_jobs · img_job_stages · crm_cp_render_jobs</p>
        </div>
        <div className="cp-overview__actions">
          <button className="cp-btn cp-btn--primary" type="button" onClick={() => setModalOpen(true)}>
            ＋ Tạo Image Job
          </button>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="cp-card">
        <header className="cp-card__head">
          <div>
            <h2>Tất cả Image Jobs</h2>
            <p>Cột Stage = <code>img_job_stages</code>.</p>
          </div>
        </header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Job / SOP</th>
                <th>Intent</th>
                <th>Stage</th>
                <th>Capability thật</th>
                <th>Credit</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cp-muted" style={{ textAlign: 'center', padding: 24 }}>
                    — · Empty state · <code>SELECT * FROM img_jobs</code>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <b>{job.sop_name ?? job.id}</b>
                      {job.sop_code ? (
                        <span className="cp-muted cp-table__sub">{job.sop_code}</span>
                      ) : null}
                    </td>
                    <td>{dash(job.intent)}</td>
                    <td>{dash(job.stage)}</td>
                    <td>{dash(job.capability)}</td>
                    <td>{formatImageJobCredit(job.credits)}</td>
                    <td>{dash(job.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="cp-img-note">
          Draft <code>POST /image/jobs/draft</code> → GT-I04 → explore → select (GT-I11) → refine /
          overlay lockup (GT-I09) → upscale → pack (GT-I10) → QC.
        </p>
      </section>

      <CpImageJobModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => void load()} />
    </div>
  );
}
