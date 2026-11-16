'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadLeadDealFile,
  fetchLeadDealFiles,
  uploadLeadDealFile,
  type LeadDealFileKind,
  type LeadDealFileRow,
  type LeadDealFilesResponse,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import './lead-deal-files.css';

const FILES_CHANGED = 'lead-deal-files-changed';

function formatDealTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sourceLabel(source: LeadDealFileRow['source']): string {
  return source === 'upload' ? 'tải lên' : 'xuất file';
}

function acceptFor(kind: LeadDealFileKind): string {
  return kind === 'quote' ? '.xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

export function notifyLeadDealFilesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FILES_CHANGED));
  }
}

export function LeadDealFilesCard({
  token,
  leadId,
  onMessage,
  onError,
  onFunnelChange,
}: {
  token: string;
  leadId: number;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
}) {
  const [data, setData] = useState<LeadDealFilesResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const quoteInputRef = useRef<HTMLInputElement | null>(null);
  const contractInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchLeadDealFiles(token, leadId);
    setData(next);
    return next;
  }, [token, leadId]);

  useEffect(() => {
    let cancelled = false;
    setLocalError('');
    void fetchLeadDealFiles(token, leadId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Không tải được danh sách file';
        setLocalError(message);
        onError?.(message);
      });
    function onChanged() {
      void reload().catch(() => undefined);
    }
    window.addEventListener(FILES_CHANGED, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(FILES_CHANGED, onChanged);
    };
  }, [token, leadId, onError, reload]);

  async function onDownload(file: LeadDealFileRow) {
    setBusy(true);
    setLocalError('');
    try {
      await downloadLeadDealFile(token, leadId, file.id, file.file_name, file.mime_type);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được file';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(kind: LeadDealFileKind, file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setLocalError('');
    try {
      const out = await uploadLeadDealFile(token, leadId, kind, file);
      setData(out.files);
      if (out.funnel) onFunnelChange?.(out.funnel);
      notifyLeadDealFilesChanged();
      onMessage?.(
        out.contract_reopened
          ? 'Đã tải lên bản sửa. Hợp đồng đã duyệt được đưa lại vòng duyệt (GĐKD).'
          : 'Đã tải lên bản sửa. File này là bản tải về hiện tại.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải lên được file';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
      if (kind === 'quote' && quoteInputRef.current) quoteInputRef.current.value = '';
      if (kind === 'contract' && contractInputRef.current) contractInputRef.current.value = '';
    }
  }

  function renderColumn(kind: LeadDealFileKind, title: string, empty: string) {
    const bucket = kind === 'quote' ? data?.quote : data?.contract;
    const current = bucket?.current ?? null;
    const older = (bucket?.versions ?? []).filter((row) => row.id !== current?.id);
    const inputRef = kind === 'quote' ? quoteInputRef : contractInputRef;
    return (
      <div className="lead-deal-files__col">
        <h3>{title}</h3>
        {current ? (
          <div className="lead-deal-files__entry">
            <button
              type="button"
              className="lead-deal-files__name"
              disabled={busy || !bucket?.can_download}
              onClick={() => void onDownload(current)}
            >
              {current.file_name}
            </button>
            <p className="muted lead-deal-files__meta">
              {formatDealTime(current.created_at)}
              {current.uploaded_by_name || current.uploaded_by_email
                ? ` · ${current.uploaded_by_name || current.uploaded_by_email}`
                : ''}
              {` · ${sourceLabel(current.source)} · v${current.version_n}`}
            </p>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {bucket?.blocked_reason || empty}
          </p>
        )}
        <div className="lead-deal-files__actions">
          {bucket?.can_upload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={acceptFor(kind)}
                hidden
                onChange={(event) => void onUpload(kind, event.target.files?.[0])}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Tải lên bản sửa
              </button>
            </>
          ) : null}
        </div>
        {older.length ? (
          <ul className="lead-deal-files__history" aria-label={`Lịch sử ${title}`}>
            {older.map((row) => (
              <li key={row.id}>
                <button type="button" disabled={busy || !bucket?.can_download} onClick={() => void onDownload(row)}>
                  {row.file_name} · {formatDealTime(row.created_at)} · {sourceLabel(row.source)} · v{row.version_n}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <section className="lead-deal-files" aria-label="File báo giá và hợp đồng">
      <h2 className="lead-deal-files__title">File báo giá và hợp đồng</h2>
      {localError ? <p className="muted">{localError}</p> : null}
      <div className="lead-deal-files__grid">
        {renderColumn('quote', 'File báo giá', data ? 'Chưa có file báo giá. Tải lên bản sửa nếu cần.' : 'Đang tải file báo giá…')}
        {renderColumn(
          'contract',
          'File hợp đồng',
          'Chưa có file hợp đồng. Tải file hợp đồng sau khi CEO duyệt báo giá, hoặc tải lên bản đã sửa.',
        )}
      </div>
    </section>
  );
}
