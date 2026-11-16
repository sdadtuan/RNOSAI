'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLeadContract,
  ensureLeadContractFile,
  downloadLeadDealFile,
  fetchLeadContractReadiness,
  fetchLeadDealFiles,
  submitLeadContract,
  uploadLeadDealFile,
  type LeadDealFileKind,
  type LeadDealFileRow,
  type LeadDealFilesResponse,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import './lead-deal-files.css';

const FILES_CHANGED = 'lead-deal-files-changed';
export const LEAD_CONTRACT_CHANGED_EVENT = 'lead-contract-changed';

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

export function notifyLeadContractChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LEAD_CONTRACT_CHANGED_EVENT));
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
  const [contractInfo, setContractInfo] = useState<{ id: number; status: string } | null>(null);
  const quoteInputRef = useRef<HTMLInputElement | null>(null);
  const contractInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchLeadDealFiles(token, leadId);
    setData(next);
    return next;
  }, [token, leadId]);

  const reloadContract = useCallback(async () => {
    const ready = await fetchLeadContractReadiness(token, leadId);
    setContractInfo(ready.contract ? { id: ready.contract.id, status: ready.contract.status } : null);
    return ready;
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
    void fetchLeadContractReadiness(token, leadId)
      .then((ready) => {
        if (cancelled) return;
        setContractInfo(ready.contract ? { id: ready.contract.id, status: ready.contract.status } : null);
      })
      .catch(() => undefined);
    function onChanged() {
      void reload().catch(() => undefined);
    }
    function onContractChanged() {
      void reloadContract().catch(() => undefined);
    }
    window.addEventListener(FILES_CHANGED, onChanged);
    window.addEventListener(LEAD_CONTRACT_CHANGED_EVENT, onContractChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(FILES_CHANGED, onChanged);
      window.removeEventListener(LEAD_CONTRACT_CHANGED_EVENT, onContractChanged);
    };
  }, [token, leadId, onError, reload, reloadContract]);

  async function ensureContractRecord(): Promise<{ id: number; status: string }> {
    if (contractInfo) return contractInfo;
    try {
      const row = await createLeadContract(token, leadId, {});
      const next = { id: row.id, status: row.status };
      setContractInfo(next);
      return next;
    } catch {
      const ready = await reloadContract();
      if (ready.contract) {
        return { id: ready.contract.id, status: ready.contract.status };
      }
      throw new Error('Tạo hợp đồng thất bại');
    }
  }

  async function onCreateContractFile() {
    setBusy(true);
    setLocalError('');
    try {
      await ensureContractRecord();
      const files = await ensureLeadContractFile(token, leadId);
      setData(files);
      notifyLeadDealFilesChanged();
      notifyLeadContractChanged();
      onMessage?.('Đã tạo file hợp đồng.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tạo hợp đồng thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

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
    const showCreateContract = kind === 'contract' && !current && Boolean(bucket?.can_upload);
    const showUpload = Boolean(bucket?.can_upload) && (kind !== 'contract' || Boolean(current));
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
          {showCreateContract ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="quote-tao-hop-dong"
              disabled={busy}
              onClick={() => void onCreateContractFile()}
            >
              Tạo hợp đồng
            </button>
          ) : null}
          {showUpload ? (
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
        {renderColumn('contract', 'File hợp đồng', 'Chưa có file hợp đồng.')}
      </div>
    </section>
  );
}

export function LeadContractSubmitCard({
  token,
  leadId,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ id: number; status: string } | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [localError, setLocalError] = useState('');

  const reload = useCallback(async () => {
    const [files, ready] = await Promise.all([
      fetchLeadDealFiles(token, leadId),
      fetchLeadContractReadiness(token, leadId).catch(() => null),
    ]);
    const current = files.contract?.current ?? null;
    const info = ready?.contract ? { id: ready.contract.id, status: ready.contract.status } : null;
    const pending = ready?.approval?.status === 'pending';
    setContractInfo(info);
    setApprovalPending(pending);
    setCanSubmit(Boolean(files.contract?.can_upload));
    setVisible(Boolean(current) && Boolean(files.contract?.can_upload));
    return { current, info, pending };
  }, [token, leadId]);

  useEffect(() => {
    let cancelled = false;
    void reload()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => undefined);
    function onChanged() {
      void reload().catch(() => undefined);
    }
    window.addEventListener(FILES_CHANGED, onChanged);
    window.addEventListener(LEAD_CONTRACT_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(FILES_CHANGED, onChanged);
      window.removeEventListener(LEAD_CONTRACT_CHANGED_EVENT, onChanged);
    };
  }, [reload]);

  async function onSubmitContract() {
    setBusy(true);
    setLocalError('');
    try {
      let info = contractInfo;
      if (!info) {
        try {
          const row = await createLeadContract(token, leadId, {});
          info = { id: row.id, status: row.status };
          setContractInfo(info);
        } catch {
          const ready = await fetchLeadContractReadiness(token, leadId);
          if (!ready.contract) throw new Error('Chưa có hợp đồng để gửi duyệt');
          info = { id: ready.contract.id, status: ready.contract.status };
          setContractInfo(info);
          setApprovalPending(ready.approval?.status === 'pending');
        }
      }
      if (approvalPending || (info.status && info.status !== 'draft')) {
        setApprovalPending(true);
        onMessage?.('Đã gửi GĐKD duyệt — chờ phê duyệt.');
        notifyLeadContractChanged();
        return;
      }
      await submitLeadContract(token, leadId, info.id, {});
      setApprovalPending(true);
      setContractInfo({ ...info, status: 'submitted' });
      notifyLeadContractChanged();
      onMessage?.('Đã gửi GĐKD duyệt — chờ phê duyệt.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gửi GĐKD duyệt thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="ahd-card lead-contract-submit-card" data-testid="lead-contract-submit-card">
      <h3 className="ahd-card__title">Gửi GĐKD duyệt</h3>
      {approvalPending ? (
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Đã gửi GĐKD duyệt — chờ phê duyệt.
        </p>
      ) : (
        <>
          {localError ? <p className="muted">{localError}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            id="lead-contract-submit"
            data-testid="quote-gui-gdkd-duyet"
            disabled={busy || !canSubmit}
            onClick={() => void onSubmitContract()}
          >
            Gửi GĐKD duyệt
          </button>
        </>
      )}
    </section>
  );
}

