'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { StudioRenderRow } from '@/lib/crm/cp-video-studio.util';

export function CpStudioQueue({
  rows,
  scope,
  onCancel,
  cancellingId,
}: {
  rows: StudioRenderRow[];
  scope: string;
  onCancel: (jobId: string) => void;
  cancellingId: string | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="cp-studio-pro__queue">
      <header>
        <button type="button" className="cp-studio-pro__queue-toggle" onClick={() => setOpen((v) => !v)}>
          <b>Hàng đợi render ({rows.length})</b>
          <span aria-hidden>{open ? '▾' : '▸'}</span>
        </button>
        <Link className="cp-studio-pro__link" href={`/crm/creative-os/video/ops?scope=${scope}`}>
          Ops
        </Link>
      </header>

      {open ? (
        rows.length ? (
          <div className="cp-studio-pro__queue-table" role="table">
            <div className="cp-studio-pro__queue-row cp-studio-pro__queue-row--head" role="row">
              <span role="columnheader">Tên video</span>
              <span role="columnheader">Tiến độ</span>
              <span role="columnheader">Trạng thái</span>
              <span role="columnheader">Thời gian ước tính</span>
              <span role="columnheader">Thao tác</span>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="cp-studio-pro__queue-row" role="row">
                <div className="cp-studio-pro__queue-video" role="cell">
                  <span className="cp-studio-pro__queue-thumb" aria-hidden />
                  <span>
                    <b>{row.title}</b>
                    <small>{row.specs}</small>
                    <small>{row.jobLabel}</small>
                  </span>
                </div>
                <div className="cp-studio-pro__queue-progress" role="cell">
                  {row.progress != null ? (
                    <>
                      <progress max={100} value={row.progress} />
                      <span>{row.progress}%</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div role="cell">
                  <span className={`cp-studio-pro__status cp-studio-pro__status--${row.statusKind}`}>
                    {row.statusLabel}
                  </span>
                </div>
                <div role="cell">{row.etaLabel ?? '—'}</div>
                <div role="cell">
                  {row.cancellable ? (
                    <button
                      type="button"
                      className="cp-studio-pro__icon-btn"
                      aria-label={`Hủy job ${row.jobLabel}`}
                      disabled={cancellingId === row.id}
                      onClick={() => onCancel(row.id)}
                    >
                      {cancellingId === row.id ? '…' : '×'}
                    </button>
                  ) : (
                    <span className="cp-studio-pro__meta">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="cp-studio-pro__meta">
            Chưa có job. Bấm Tạo video khi brief + asset sẵn sàng.
          </p>
        )
      ) : null}
    </section>
  );
}
