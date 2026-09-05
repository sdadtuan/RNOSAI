'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  acceptAmHandover,
  fetchAmHandovers,
  needsInfoAmHandover,
  rejectAmHandover,
  type AmHandover as AmHandoverRow,
  type AmHandoverChecklist,
} from '@/lib/crm/am-api';
import {
  AM_HANDOVER_CHECKLIST,
  AM_HANDOVER_STEPS,
  amHandoverCanAccept,
  amHandoverReasonError,
  amHandoverStatusCopy,
  amJsonField,
  parseAmHandoverStep,
  type AmHandoverChecklistState,
  type AmHandoverStepId,
} from '@/lib/crm/am-handover.util';
import { useAmPage } from './AmShell';

type ReasonAction = 'reject' | 'needs_info';

function displayPairs(data: Record<string, unknown>, keys: Array<{ key: string; label: string }>) {
  const known = new Set(keys.map((row) => row.key));
  const extras = Object.keys(data).filter((key) => !known.has(key));
  return [
    ...keys.map((row) => ({ ...row, value: amJsonField(data, row.key) })),
    ...extras.map((key) => ({ key, label: key, value: amJsonField(data, key) })),
  ];
}

export function AmHandover({
  handover,
  initialStep = 'commercial',
  onClose,
  onChanged,
}: {
  handover: AmHandoverRow;
  initialStep?: AmHandoverStepId;
  onClose: () => void;
  onChanged: (row: AmHandoverRow) => void;
}) {
  const { token, canEdit } = useAmPage();
  const [step, setStep] = useState<AmHandoverStepId>(initialStep);
  const [checklist, setChecklist] = useState<AmHandoverChecklistState>({});
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canAccept = amHandoverCanAccept(checklist);
  const pending = handover.status === 'pending_am' || handover.status === 'needs_info';

  const commercial = displayPairs(handover.commercial_json, [
    { key: 'value_vnd', label: 'Giá trị' },
    { key: 'term', label: 'Kỳ hạn' },
    { key: 'billing', label: 'Billing' },
    { key: 'starts_on', label: 'Ngày hiệu lực' },
    { key: 'package', label: 'Gói dịch vụ' },
    { key: 'sla', label: 'SLA' },
  ]);
  const scope = displayPairs(handover.scope_json, [
    { key: 'goal', label: 'Mục tiêu kinh doanh' },
    { key: 'kpi', label: 'KPI cam kết' },
    { key: 'in_scope', label: 'Phạm vi bao gồm' },
    { key: 'out_of_scope', label: 'Không bao gồm' },
    { key: 'sales_notes', label: 'Rủi ro/ghi chú từ Sales' },
  ]);
  const stakeholders = displayPairs(handover.stakeholders_json, [
    { key: 'primary', label: 'Stakeholder chính' },
    { key: 'delivery_owner', label: 'Owner Delivery' },
    { key: 'access', label: 'Quyền truy cập' },
  ]);

  async function runAction(action: 'accept' | ReasonAction) {
    if (!token || !canEdit || !pending) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'accept') {
        if (!canAccept) {
          setError('checklist_required');
          return;
        }
        onChanged(await acceptAmHandover(token, handover.id, checklist as AmHandoverChecklist));
        onClose();
        return;
      }
      if (amHandoverReasonError(action, reason)) {
        setError('reason_required');
        return;
      }
      const next =
        action === 'reject'
          ? await rejectAmHandover(token, handover.id, reason.trim())
          : await needsInfoAmHandover(token, handover.id, reason.trim());
      onChanged(next);
      setReasonAction(null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'handover_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="am-drawer-bg" role="presentation" onClick={onClose}>
      <div
        className="am-handover"
        role="dialog"
        aria-labelledby="am-handover-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="am-handover__head">
          <div>
            <p className="am-crumb">Handover Sales → AM</p>
            <h2 id="am-handover-title">Handover khách hàng: {handover.name || handover.code}</h2>
            <p className="am-muted">
              {handover.code} · {amHandoverStatusCopy(handover.status)}
            </p>
          </div>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="am-handover__steps" role="tablist">
          {AM_HANDOVER_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={item.id === step ? 'is-active' : ''}
              aria-selected={item.id === step}
              onClick={() => setStep(item.id)}
            >
              {index + 1}. {item.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="am-banner">
            {error === 'checklist_required'
              ? 'Tick đủ checklist AM trước khi xác nhận.'
              : error === 'reason_required'
                ? 'Từ chối / yêu cầu bổ sung bắt buộc nêu lý do.'
                : error}
          </p>
        ) : null}

        {step === 'commercial' ? (
          <section className="am-widget">
            <h3>Thông tin thương mại</h3>
            <dl className="am-handover__dl">
              {commercial.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {step === 'scope' ? (
          <section className="am-widget">
            <h3>Scope & KPI</h3>
            <dl className="am-handover__dl">
              {scope.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {step === 'stakeholder' ? (
          <section className="am-widget">
            <h3>Stakeholder</h3>
            <dl className="am-handover__dl">
              {stakeholders.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {step === 'confirm' ? (
          <section className="am-widget">
            <h3>Checklist xác nhận AM</h3>
            <div className="am-form">
              {AM_HANDOVER_CHECKLIST.map((item) => (
                <label key={item.key} className="am-field am-field--check">
                  <span>
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[item.key])}
                      disabled={!canEdit || !pending}
                      onChange={(ev) =>
                        setChecklist((prev) => ({ ...prev, [item.key]: ev.target.checked }))
                      }
                    />
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
            {handover.reject_reason ? (
              <p className="am-muted">Lý do gần nhất: {handover.reject_reason}</p>
            ) : null}
          </section>
        ) : null}

        <div className="am-form__actions">
          <button
            type="button"
            className="am-btn"
            disabled={!canEdit || !pending || busy}
            onClick={() => {
              setReason('');
              setReasonAction('needs_info');
            }}
          >
            Yêu cầu bổ sung thông tin
          </button>
          <button
            type="button"
            className="am-btn"
            disabled={!canEdit || !pending || busy}
            onClick={() => {
              setReason('');
              setReasonAction('reject');
            }}
          >
            Từ chối handover
          </button>
          <button
            type="button"
            className="am-btn am-btn--primary"
            disabled={!canEdit || !pending || busy || !canAccept}
            onClick={() => void runAction('accept')}
          >
            Xác nhận nhận bàn giao
          </button>
        </div>

        {reasonAction ? (
          <div className="am-handover__reason">
            <label className="am-field">
              <span>{reasonAction === 'reject' ? 'Lý do từ chối *' : 'Thông tin cần bổ sung *'}</span>
              <textarea
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                rows={3}
              />
            </label>
            <div className="am-form__actions">
              <button type="button" className="am-btn" onClick={() => setReasonAction(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="am-btn am-btn--primary"
                disabled={busy || Boolean(amHandoverReasonError(reasonAction, reason))}
                onClick={() => void runAction(reasonAction)}
              >
                Gửi
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AmOnboardingQueue() {
  const { token, scope } = useAmPage();
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/account-management/onboarding';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const search = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const selectedId = search.get('handover');
  const agencyClientId = search.get('agency_client_id');
  const stepHint = parseAmHandoverStep(search.get('step'));

  const [items, setItems] = useState<AmHandoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<AmHandoverRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const query: { scope?: typeof scope; agency_client_id?: string } = { scope };
      if (agencyClientId) query.agency_client_id = agencyClientId;
      const out = await fetchAmHandovers(token, query);
      setItems(out.items);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : 'Không tải được hàng chờ handover.');
    } finally {
      setLoading(false);
    }
  }, [agencyClientId, scope, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!items.length) {
      setOpen(null);
      return;
    }
    const hit =
      items.find((row) => row.id === selectedId) ??
      (agencyClientId ? items.find((row) => row.agency_client_id === agencyClientId) : undefined);
    setOpen(hit ?? null);
  }, [agencyClientId, items, selectedId]);

  const openRow = (row: AmHandoverRow) => {
    const next = new URLSearchParams(search.toString());
    next.set('handover', row.id);
    next.set('agency_client_id', row.agency_client_id);
    if (!next.get('step')) next.set('step', stepHint);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const closeModal = () => {
    const next = new URLSearchParams(search.toString());
    next.delete('handover');
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
    setOpen(null);
  };

  return (
    <div className="am-page">
      <p className="am-crumb">Account Management / Onboarding</p>
      <div className="am-360__head">
        <div>
          <h1>Hàng chờ handover</h1>
          <p className="am-muted">Sales → AM · 4 bước Thương mại, Scope & KPI, Stakeholder, Xác nhận</p>
        </div>
        <button type="button" className="am-btn" onClick={() => void load()}>
          Tải lại
        </button>
      </div>

      {error ? <p className="am-banner">{error}</p> : null}

      <div className="am-widget">
        <table className="am-table">
          <thead>
            <tr>
              <th>Khách</th>
              <th>Trạng thái</th>
              <th>Lifecycle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="am-muted">
                  Đang tải…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="am-muted">
                  Không có handover chờ AM xác nhận.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="am-link" onClick={() => openRow(row)}>
                      {row.name || row.code}
                    </button>
                    <div className="am-muted">{row.code}</div>
                  </td>
                  <td>{amHandoverStatusCopy(row.status)}</td>
                  <td>{row.am_status}</td>
                  <td>
                    <button type="button" className="am-btn" onClick={() => openRow(row)}>
                      Mở handover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <AmHandover
          handover={open}
          initialStep={stepHint}
          onClose={closeModal}
          onChanged={(row) => {
            setItems((prev) => {
              if (row.status === 'accepted' || row.status === 'rejected') {
                return prev.filter((item) => item.id !== row.id);
              }
              return prev.map((item) => (item.id === row.id ? row : item));
            });
            setOpen(row.status === 'pending_am' || row.status === 'needs_info' ? row : null);
          }}
        />
      ) : null}
    </div>
  );
}
