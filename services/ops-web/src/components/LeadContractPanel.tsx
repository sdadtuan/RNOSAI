'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveContractApproval,
  createLeadContract,
  downloadLeadContractDocx,
  fetchLeadContractReadiness,
  patchLeadContract,
  rejectContractApproval,
  submitLeadContract,
  type ContractApprovalRow,
  type ContractReadinessCheck,
  type LeadContractRow,
} from '@/lib/api';
import {
  contractCreateReady,
  contractSubmitReady,
  readinessCheckHref,
} from '@/lib/crm/lead-contract-ready';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { isAccountExecutive, isAccountManager, isGdkdContractDesk, isSuperAdmin } from '@/lib/crm/lead-ae-visibility';
import type { LeadContractFlowSummary } from '@/lib/crm/lead-contract-flow';
import { normalizeAgencyClientId } from '@/lib/crm/funnel-snapshot.util';
import { ActionErrorToast } from '@/components/ui/ActionToast';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  refreshToken?: number;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onLoaded?: (summary: LeadContractFlowSummary, checks: ContractReadinessCheck[]) => void;
  onDecided?: () => void;
  readOnly?: boolean;
}

export function LeadContractPanel({
  token,
  leadId,
  user,
  refreshToken = 0,
  onMessage,
  onError,
  onLoaded,
  onDecided,
  readOnly = false,
}: Props) {
  const [checks, setChecks] = useState<ContractReadinessCheck[]>([]);
  const [contract, setContract] = useState<LeadContractRow | null>(null);
  const [approval, setApproval] = useState<ContractApprovalRow | null>(null);
  const [lifecycleId, setLifecycleId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState('');
  const onLoadedRef = useRef(onLoaded);
  const loadedRef = useRef(false);
  const seenLeadRef = useRef(leadId);
  onLoadedRef.current = onLoaded;
  if (seenLeadRef.current !== leadId) {
    seenLeadRef.current = leadId;
    loadedRef.current = false;
  }

  const canEdit =
    !readOnly &&
    (isSuperAdmin(user) ||
      isAccountManager(user) ||
      (isAccountExecutive(user) &&
        Boolean(contract?.created_by) &&
        String(contract?.created_by).trim().toLowerCase() === String(user?.email ?? '').trim().toLowerCase()));
  const canDecide =
    isGdkdContractDesk(user) ||
    isSuperAdmin(user) ||
    hasCap(user, 'crm_gdkd', 'assign') ||
    hasCap(user, 'crm_gdkd', 'review_queue') ||
    hasCap(user, 'crm_leads', 'assign');

  const reload = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    setPanelError('');
    try {
      const data = await fetchLeadContractReadiness(token, leadId);
      setChecks(data.checks);
      setContract(data.contract);
      setApproval(data.approval);
      const lifecycle =
        data.lifecycle_id != null && data.lifecycle_id > 0 ? data.lifecycle_id : null;
      setLifecycleId(lifecycle);
      if (data.contract?.amount_vnd) setAmount(String(data.contract.amount_vnd));
      loadedRef.current = true;
      onLoadedRef.current?.(
        {
          hasContract: Boolean(data.contract),
          contractStatus: data.contract?.status ?? null,
          pendingApproval: data.approval?.status === 'pending',
          lifecycleId: lifecycle,
          lifecycleStage: data.lifecycle_stage ?? null,
          agencyClientId: normalizeAgencyClientId(data.contract?.agency_client_id),
          createdBy: data.contract?.created_by ?? null,
        },
        data.checks ?? [],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải HĐ thất bại';
      setPanelError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  async function onCreateDraft() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const row = await createLeadContract(token, leadId, {
        amount_vnd: amount ? Number(amount) : 0,
      });
      setContract(row);
      onMessage?.('Đã tạo HĐ draft');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo HĐ thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!canEdit || !contract) return;
    setBusy(true);
    try {
      await submitLeadContract(token, leadId, contract.id, { notes: submitNotes.trim() });
      onMessage?.('Đã gửi GDKD duyệt — chờ phê duyệt');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Submit thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    if (!canDecide || !approval) return;
    setBusy(true);
    try {
      const out = await approveContractApproval(token, approval.id);
      onMessage?.(`Đã duyệt và ký Active. Lifecycle #${out.lifecycle_id}. Lead sang Triển Khai.`);
      onDecided?.();
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Duyệt hợp đồng thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!canDecide || !approval) return;
    setBusy(true);
    try {
      await rejectContractApproval(token, approval.id, { decision_notes: rejectNotes.trim() });
      onMessage?.('Đã từ chối hợp đồng');
      setRejectNotes('');
      onDecided?.();
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Từ chối hợp đồng thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAmount() {
    if (!canEdit || !contract) return;
    setBusy(true);
    try {
      const row = await patchLeadContract(token, leadId, contract.id, {
        amount_vnd: amount ? Number(amount) : 0,
      });
      setContract(row);
      onMessage?.('Đã cập nhật HĐ draft');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cập nhật HĐ thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !loadedRef.current) return <p className="muted">Đang tải hợp đồng…</p>;

  const submitReady = contractSubmitReady(checks);
  const createReady = contractCreateReady(checks);
  const pending = approval?.status === 'pending';

  return (
    <section
      id="lead-contract"
      style={{
        marginTop: '1.25rem',
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Hợp đồng → Service Delivery</h3>
      <ActionErrorToast message={panelError} />
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        AM tạo draft → submit → GDKD duyệt → lifecycle Onboard (2 bước phê duyệt)
      </p>
      {!canEdit && !readOnly ? (
        <p className="muted" style={{ fontSize: '0.85rem' }} data-testid="lead-contract-view-only">
          Bạn chỉ xem hợp đồng. AM lập HĐ rồi gửi GDKD duyệt.
        </p>
      ) : null}

      <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
        {checks.map((c) => {
          const href = !c.ok ? readinessCheckHref(c.key, leadId) : null;
          return (
            <li key={c.key} style={{ color: c.ok ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)' }}>
              {c.ok ? '✓' : '○'}{' '}
              {href ? (
                <Link href={href} className="nav-link">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
              {c.message && !c.ok ? ` — ${c.message}` : ''}
            </li>
          );
        })}
      </ul>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        {contract ? (
          <div style={{ fontSize: '0.9rem' }}>
            <strong>{contract.title}</strong>
            <div className="muted">
              #{contract.id} · {contract.status}
              {approval ? ` · approval: ${approval.status}` : ''}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            File hợp đồng lập từ báo giá đã chốt. GĐKD duyệt trên file này.
          </p>
        )}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void downloadLeadContractDocx(token, leadId)
              .catch((err: unknown) => onError?.(err instanceof Error ? err.message : 'Không tải được file hợp đồng'))
              .finally(() => setBusy(false));
          }}
        >
          Tải file hợp đồng
        </button>
      </div>

      {canEdit && !contract && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Giá trị HĐ (VND)</span>
            <input
              id="lead-contract-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !createReady}
            onClick={() => void onCreateDraft()}
          >
            Tạo HĐ draft
          </button>
        </div>
      )}

      {canEdit && contract?.status === 'draft' && !pending && (
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Giá trị HĐ (VND)</span>
            <input
              id="lead-contract-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onSaveAmount()}>
            Lưu draft
          </button>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Ghi chú gửi GDKD</span>
            <textarea
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              rows={2}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button
            id="lead-contract-submit"
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !submitReady}
            onClick={() => void onSubmit()}
          >
            Gửi GDKD duyệt
          </button>
        </div>
      )}

      {pending ? (
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            Đang chờ GDKD duyệt (approval #{approval?.id}).{' '}
            <Link href="/crm/hub?hub_tab=contracts" className="nav-link">
              Hub · HĐ chờ duyệt →
            </Link>
          </p>
          {canDecide ? (
            <>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span className="muted">Lý do từ chối</span>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={2}
                  style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => void onApprove()}
                >
                  Duyệt & ký Active
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy}
                  onClick={() => void onReject()}
                >
                  Từ chối
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {contract?.status === 'active' ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.85rem',
            borderRadius: 8,
            border: '1px solid var(--accent, #16a34a)',
            background: 'rgba(22, 163, 74, 0.08)',
          }}
        >
          <strong>HĐ đã ký Active</strong>
          {lifecycleId ? (
            <p style={{ margin: '0.35rem 0 0' }}>
              Lifecycle #{lifecycleId} ·{' '}
              <Link href={`/crm/service-delivery/${lifecycleId}`} className="nav-link">
                Mở workflow triển khai →
              </Link>
              {contract.agency_client_id?.trim() ? (
                <>
                  {' · '}
                  <Link
                    href={`/agency/clients/${encodeURIComponent(contract.agency_client_id.trim())}`}
                    className="nav-link"
                  >
                    Mở Agency Client →
                  </Link>
                </>
              ) : (
                <>
                  {' · '}
                  <Link href="/agency/clients/new" className="nav-link">
                    Tạo Agency Client →
                  </Link>
                  <span className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                    HĐ promote trước WS2 — tạo client thủ công nếu chưa có link tự động.
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              Đang promote… refresh trang hoặc xem{' '}
              <Link href="/crm/service-delivery" className="nav-link">
                Service Delivery
              </Link>
            </p>
          )}
          {contract.notes?.includes('[needs_merge]') ? (
            <p className="muted" style={{ marginTop: '0.35rem', color: 'var(--warning, #ca8a04)' }}>
              Trùng tên client — Ops review merge trên Agency Client.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
