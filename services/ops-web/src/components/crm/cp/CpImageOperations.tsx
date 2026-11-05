'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import {
  getCpImageOperationsBoard,
  type CpImageBoardColumn,
} from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

type CpImageOperationsProps = {
  cpProjectId?: string;
};

export function CpImageOperations({ cpProjectId }: CpImageOperationsProps) {
  const [columns, setColumns] = useState<CpImageBoardColumn[]>([]);
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
      const out = await getCpImageOperationsBoard(token, cpProjectId);
      setColumns(out.columns);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được board'));
    } finally {
      setLoading(false);
    }
  }, [cpProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Vận hành sáng tạo</b></p>
          <h1>Creative Operations Board</h1>
          <p className="cp-muted">Kanban theo lifecycle + <b>stage recipe</b> đang chạy.</p>
          <p className="cp-sot">GET /api/crm/cp/image/operations/board · img_job_stages.stage</p>
        </div>
        <div className="cp-overview__actions">
          <button className="cp-btn cp-btn--primary" type="button">
            ＋ Creative task
          </button>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-kanban">
        {(columns.length > 0
          ? columns
          : [
              { id: 'brief', label: 'Brief ready', count: null, items: [] },
              { id: 'production', label: 'In production', count: null, items: [] },
              { id: 'internal', label: 'Internal review', count: null, items: [] },
              { id: 'client', label: 'Client review', count: null, items: [] },
            ]
        ).map((column) => (
          <section key={column.id} className="cp-img-kanban__col">
            <header className="cp-img-kanban__head">
              <b>{column.label}</b>
              <span>{dash(column.count)}</span>
            </header>
            {column.items.length === 0 ? (
              <p className="cp-muted" style={{ fontSize: 11, padding: 8 }}>
                {column.id === 'client'
                  ? 'Hub: POST /creatives (PRJ-05 map)'
                  : 'Chưa có img_projects active.'}
              </p>
            ) : (
              column.items.map((item) => (
                <article key={item.id} className="cp-img-task">
                  <h4>{item.title}</h4>
                  <p>{item.detail ?? dash(null)}</p>
                  <footer className="cp-img-task__foot">
                    <span className="cp-pill cp-pill--purple">{dash(item.stage ?? item.status)}</span>
                    <span className="cp-muted">{dash(item.intent)}</span>
                  </footer>
                </article>
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
