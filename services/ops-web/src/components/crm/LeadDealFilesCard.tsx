'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createLeadContract,
  ensureLeadContractFile,
  downloadLeadDealFile,
  approveContractApproval,
  fetchLeadContractReadiness,
  fetchLeadDealFiles,
  fetchPendingContractApprovals,
  rejectContractApproval,
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

function isSubmittedForGdkd(status: string | null | undefined, approvalStatus?: string | null): boolean {
  const contractStatus = String(status ?? '').toLowerCase();
  const approval = String(approvalStatus ?? '').toLowerCase();
  return (
    approval === 'pending' ||
    contractStatus === 'submitted' ||
    contractStatus === 'pending' ||
    contractStatus === 'pending_approval'
  );
}


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

function fileMeta(row: LeadDealFileRow): string {
  const who = row.uploaded_by_name || row.uploaded_by_email;
  return [`Phiên bản v${row.version_n}`, formatDealTime(row.created_at), who].filter(Boolean).join(' · ');
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
  showContractColumn = true,
  allowCreateContract = true,
  onMessage,
  onError,
  onFunnelChange,
  footer,
}: {
  token: string;
  leadId: number;
  showContractColumn?: boolean;
  allowCreateContract?: boolean;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  footer?: ReactNode;
}) {
  const [data, setData] = useState<LeadDealFilesResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [contractInfo, setContractInfo] = useState<{ id: number; status: string } | null>(null);
  const [gdkdApprovalPending, setGdkdApprovalPending] = useState(false);
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
    setGdkdApprovalPending(isSubmittedForGdkd(ready.contract?.status, ready.approval?.status));
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
        setGdkdApprovalPending(isSubmittedForGdkd(ready.contract?.status, ready.approval?.status));
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
    const canUpload = Boolean(bucket?.can_upload) && !gdkdApprovalPending;
    const canDownloadFile = kind === 'quote' || Boolean(bucket?.can_download);
    const showCreateContract = kind === 'contract' && !current && canUpload && allowCreateContract;
    const showUpload = canUpload && (kind !== 'contract' || Boolean(current));
    return (
      <div className="lead-deal-files__col">
        <h3>{title}</h3>
        {current ? (
          <div className="lead-deal-files__entry">
            <a
              className="lead-deal-files__name"
              href={`/api/v1/leads/${leadId}/presales/deal-files/${current.id}/download`}
              aria-disabled={busy || !canDownloadFile}
              onClick={(event) => {
                event.preventDefault();
                if (busy || !canDownloadFile) return;
                void onDownload(current);
              }}
            >
              {current.file_name}
            </a>
            <p className="muted lead-deal-files__meta">{fileMeta(current)}</p>
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
                <a
                  href={`/api/v1/leads/${leadId}/presales/deal-files/${row.id}/download`}
                  onClick={(event) => {
                    event.preventDefault();
                    if (busy || !canDownloadFile) return;
                    void onDownload(row);
                  }}
                >
                  {row.file_name}
                </a>
                <span className="muted"> · {fileMeta(row)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const heading = showContractColumn ? 'File báo giá và hợp đồng' : 'File báo giá';
  return (
    <section className="lead-deal-files" aria-label={heading}>
      <h2 className="lead-deal-files__title">{heading}</h2>
      {localError ? <p className="muted">{localError}</p> : null}
      <div className={showContractColumn ? 'lead-deal-files__grid' : 'lead-deal-files__grid lead-deal-files__grid--quote-only'}>
        {renderColumn('quote', 'File báo giá', data ? 'Chưa có file báo giá. Bấm Tạo báo giá.' : 'Đang tải file báo giá…')}
        {showContractColumn ? renderColumn('contract', 'File hợp đồng', 'Chưa có file hợp đồng.') : null}
      </div>
      {footer}
    </section>
  );
}

export function LeadContractSubmitCard({
  token,
  leadId,
  viewerIsGdkd = false,
  viewerIsSuperAdmin = false,
  placement = 'sidebar',
  onMessage,
  onError,
  onFunnelChange,
  onLeadReload,
}: {
  token: string;
  leadId: number;
  viewerIsGdkd?: boolean;
  viewerIsSuperAdmin?: boolean;
  placement?: 'sidebar' | 'inline';
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onLeadReload?: () => Promise<void> | void;
}) {
  const canDecide = viewerIsGdkd || viewerIsSuperAdmin;
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ id: number; status: string } | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [localError, setLocalError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const reload = useCallback(async () => {
    const [files, ready] = await Promise.all([
      fetchLeadDealFiles(token, leadId),
      fetchLeadContractReadiness(token, leadId).catch(() => null),
    ]);
    const current = files.contract?.current ?? null;
    const info = ready?.contract ? { id: ready.contract.id, status: ready.contract.status } : null;
    let approval = ready?.approval ?? null;
    const submitted = isSubmittedForGdkd(info?.status, approval?.status);
    if (submitted && approval?.status !== 'pending') {
      try {
        const listed = await fetchPendingContractApprovals(token, 80);
        const hit = (listed.approvals ?? []).find(
          (row) => Number(row.lead_id) === Number(leadId) && String(row.status).toLowerCase() === 'pending',
        );
        if (hit) approval = hit;
      } catch {
        /* readiness already loaded */
      }
    }
    const pending = isSubmittedForGdkd(info?.status, approval?.status);
    setContractInfo(info);
    setApprovalPending(pending);
    setApprovalId(approval?.status === 'pending' && approval.id ? approval.id : null);
    setCanSubmit(Boolean(files.contract?.can_upload) && !pending);
    setVisible(Boolean(current) && (Boolean(files.contract?.can_upload) || pending));
    return { current, info, pending, approval };
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
          setApprovalPending(isSubmittedForGdkd(ready.contract.status, ready.approval?.status));
          setApprovalId(ready.approval?.status === 'pending' ? ready.approval.id : null);
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

  async function onApproveContract() {
    if (!approvalId) {
      setLocalError('Chưa tìm thấy yêu cầu duyệt hợp đồng.');
      return;
    }
    setBusy(true);
    setLocalError('');
    try {
      const out = await approveContractApproval(token, approvalId);
      notifyLeadContractChanged();
      const funnel = (out as { funnel?: LeadFunnelSnapshot }).funnel;
      if (funnel) onFunnelChange?.(funnel);
      await onLeadReload?.();
      setApprovalPending(false);
      setVisible(false);
      onMessage?.(`Đã duyệt hợp đồng. Lead sang Triển Khai.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Duyệt hợp đồng thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function onReturnContract() {
    if (!approvalId) {
      setLocalError('Chưa tìm thấy yêu cầu duyệt hợp đồng.');
      return;
    }
    if (rejectNotes.trim().length < 5) {
      setLocalError('Nhập lý do trả lại, ít nhất 5 ký tự');
      return;
    }
    setBusy(true);
    setLocalError('');
    try {
      await rejectContractApproval(token, approvalId, { decision_notes: rejectNotes.trim() });
      notifyLeadContractChanged();
      await onLeadReload?.();
      setRejectOpen(false);
      setRejectNotes('');
      await reload();
      onMessage?.('Đã trả lại AM kèm lý do.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trả lại hợp đồng thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  if (placement === 'sidebar' && approvalPending) return null;
  if (placement === 'inline' && !approvalPending) return null;

  const approveButton = (
    <button
      type="button"
      className="btn btn-primary"
      data-testid="quote-duyet-hop-dong-btn"
      disabled={busy || !approvalId}
      onClick={() => void onApproveContract()}
    >
      Duyệt
    </button>
  );
  const returnButton = !rejectOpen ? (
    <button
      type="button"
      className="btn btn-secondary"
      data-testid="quote-tra-lai-am-hd"
      disabled={busy || !approvalId}
      onClick={() => setRejectOpen(true)}
    >
      Trả lại AM
    </button>
  ) : null;
  const rejectForm = rejectOpen ? (
    <div className="solution-feedback__revise" style={{ marginTop: '0.75rem' }}>
      <label>
        Lý do trả lại
        <textarea
          rows={3}
          value={rejectNotes}
          onChange={(event) => setRejectNotes(event.target.value)}
          aria-label="Lý do trả lại hợp đồng"
          placeholder="Bắt buộc khi trả lại cho AM, ít nhất 5 ký tự"
        />
      </label>
      <div className="solution-feedback__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || rejectNotes.trim().length < 5}
          onClick={() => void onReturnContract()}
        >
          Trả lại AM
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => {
            setRejectOpen(false);
            setRejectNotes('');
          }}
        >
          Huỷ
        </button>
      </div>
    </div>
  ) : null;

  if (placement === 'inline') {
    return (
      <div className="lead-contract-submit-inline" data-testid="lead-contract-submit-card">
        {localError ? <p className="muted">{localError}</p> : null}
        <div className="lead-contract-submit-inline__row">
          <p className="muted lead-contract-submit-inline__status">
            Đã gửi GĐKD duyệt — chờ phê duyệt.
          </p>
          {canDecide ? (
            <div className="lead-contract-submit-inline__actions">
              {approveButton}
              {returnButton}
            </div>
          ) : null}
        </div>
        {canDecide ? rejectForm : null}
      </div>
    );
  }

  return (
    <section className="ahd-card lead-contract-submit-card" data-testid="lead-contract-submit-card">
      <h3 className="ahd-card__title">Gửi GĐKD duyệt</h3>
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
    </section>
  );
}
