'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ConsultBriefPanel } from '@/components/ConsultBriefPanel';
import { LifecycleOnboardingPanel } from '@/components/LifecycleOnboardingPanel';
import {
  fetchCrmStaffList,
  fetchServiceLifecycleAdvanceInfo,
  fetchServiceLifecycleMarketingPlan,
  fetchServiceLifecycleProgress,
  fetchServiceLifecycleTasks,
  patchServiceLifecycle,
  patchServiceLifecycleTask,
  recordServiceLifecycleClientGate,
  type CrmStaffRow,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { isMarketingLeader, isSuperAdmin } from '@/lib/crm/lead-ae-visibility';

const STAGES = ['lead', 'consult', 'proposal', 'onboard', 'deliver', 'handover', 'retain'] as const;
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  consult: 'Tư vấn',
  proposal: 'Báo giá',
  onboard: 'Onboard',
  deliver: 'Triển khai',
  handover: 'Bàn giao',
  retain: 'Giữ chân',
};
const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const WORK_STATUSES = [
  { value: 'todo', label: 'Chờ làm' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'done', label: 'Xong' },
  { value: 'na', label: 'Không áp dụng' },
] as const;

type PaymentGate = {
  ok?: boolean;
  requires_confirm?: boolean;
  requires_finance_role?: boolean;
  strict_mode?: boolean;
  can_confirm?: boolean;
  outstanding_vnd?: number;
  ar_pending_vnd?: number;
  ar_overdue_vnd?: number;
  messages?: string[];
};

type OnboardGate = {
  ok?: boolean;
  orchestrator_percent?: number;
  checklist_percent?: number;
  messages?: string[];
};

type LaunchQaGate = {
  ok?: boolean;
  warn_only?: boolean;
  launch_ready?: boolean;
  progress_percent?: number;
  progress_completed?: number;
  progress_total?: number;
  requires_confirm?: boolean;
  messages?: string[];
};

type TaskRow = {
  id: number;
  title: string;
  description: string;
  is_done: boolean;
  notes: string;
  assignee?: string | null;
  assignee_staff_id?: number | null;
  priority?: string | null;
  due_date?: string | null;
  work_status?: string;
  work_status_label?: string;
  overdue?: boolean;
  on_time?: boolean | null;
  quote_hours?: number;
  actual_hours?: number;
  actual_hours_log?: Array<{ staff_name?: string; hours?: number; note?: string; at?: string }>;
};

type DeliveryOps = {
  case: { on_time: number; scored: number; pct: number; quote_hours: number; actual_hours: number };
  staff: Array<{
    staff_id: number | null;
    name: string;
    on_time: number;
    scored: number;
    pct: number;
    quote_hours: number;
    actual_hours: number;
  }>;
};

type ClientGateState = {
  key?: string;
  label?: string;
  status?: string;
  note?: string;
  revision_count?: number;
  decided_at?: string | null;
  decided_by_name?: string;
};

type ClientGates = {
  plan?: ClientGateState;
  go_live?: ClientGateState;
  acceptance?: ClientGateState;
  can_record?: boolean;
};

type Props = {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
  initialStage: string;
  onStageChanged?: (stage: string) => void;
  onFinanceRefresh?: () => void;
  onOpenTmmtTab?: () => void;
  onOpenAiPlannerTab?: () => void;
  onOpenFinanceTab?: () => void;
  onOpenLaunchQaTab?: () => void;
};

export function ServiceDeliveryWorkflowPanel({
  token,
  user,
  lifecycleId,
  initialStage,
  onStageChanged,
  onFinanceRefresh,
  onOpenTmmtTab,
  onOpenAiPlannerTab,
  onOpenFinanceTab,
  onOpenLaunchQaTab,
}: Props) {
  const canEdit = hasCap(user, 'crm_board', 'edit');
  const canFinanceConfirm = hasCap(user, 'crm_business_dashboard', 'view');
  const [tab, setTab] = useState(initialStage);
  const [tasks, setTasks] = useState<Record<string, TaskRow[]>>({});
  const [progress, setProgress] = useState<Record<string, { total: number; done: number; pct: number }>>({});
  const [advance, setAdvance] = useState<Record<string, unknown>>({});
  const [tmmtValidation, setTmmtValidation] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [financeConfirm, setFinanceConfirm] = useState(false);
  const [launchQaConfirm, setLaunchQaConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ops, setOps] = useState<DeliveryOps | null>(null);
  const [staffList, setStaffList] = useState<CrmStaffRow[]>([]);
  const [hourDraft, setHourDraft] = useState<Record<number, { hours: string; note: string; actual: string }>>({});
  const [assigneeReason, setAssigneeReason] = useState<Record<number, string>>({});
  const [gateNote, setGateNote] = useState<Record<string, string>>({});
  const canReassign = isMarketingLeader(user) || isSuperAdmin(user);

  useEffect(() => {
    setTab(initialStage);
  }, [initialStage]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskOut, progOut, advOut] = await Promise.all([
        fetchServiceLifecycleTasks(token, lifecycleId),
        fetchServiceLifecycleProgress(token, lifecycleId),
        fetchServiceLifecycleAdvanceInfo(token, lifecycleId),
      ]);
      setTasks(taskOut.tasks as Record<string, TaskRow[]>);
      setOps((taskOut as { ops?: DeliveryOps }).ops ?? null);
      setProgress(progOut.progress);
      setAdvance(advOut);
      if (tab === 'onboard') {
        const mp = await fetchServiceLifecycleMarketingPlan(token, lifecycleId);
        setTmmtValidation(mp.validation);
      } else {
        setTmmtValidation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải workflow thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void (async () => {
      try {
        const out = await fetchCrmStaffList(token);
        setStaffList(out.staff.filter((row) => row.active !== 0));
      } catch {
        /* optional */
      }
    })();
  }, [token]);

  async function toggleTask(task: TaskRow) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const nextDone = !task.is_done;
      await patchServiceLifecycleTask(token, lifecycleId, task.id, {
        is_done: nextDone,
        work_status: nextDone ? 'done' : 'todo',
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật task thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function patchTaskAssignment(
    task: TaskRow,
    patch: Partial<{
      assignee: string | null;
      assignee_staff_id: number | null;
      assignee_reason: string | null;
      priority: string | null;
      due_date: string | null;
      work_status: string;
      hours: number;
      actual_hours_entry: { hours?: number; note?: string };
    }>,
  ) {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      await patchServiceLifecycleTask(token, lifecycleId, task.id, patch);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật task thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function recordGate(gate: 'plan' | 'go_live' | 'acceptance', decision: 'approved' | 'revision_requested') {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await recordServiceLifecycleClientGate(token, lifecycleId, {
        gate,
        decision,
        note: (gateNote[gate] ?? '').trim(),
      });
      setGateNote((prev) => ({ ...prev, [gate]: '' }));
      setMessage(decision === 'approved' ? 'Đã ghi khách duyệt.' : 'Đã ghi yêu cầu sửa.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ghi cửa khách duyệt thất bại');
    } finally {
      setSaving(false);
    }
  }

  const paymentGate = advance.payment_gate as PaymentGate | undefined;
  const onboardGate = advance.onboard_gate as OnboardGate | undefined;
  const launchQaGate = advance.launch_qa_gate as LaunchQaGate | undefined;
  const clientGates = advance.client_gates as ClientGates | undefined;
  const showPlanGoLiveGates = tab === 'deliver';
  const showAcceptanceGate = tab === 'handover';
  const showOnboardGate =
    tab === 'onboard' &&
    String(advance.current_stage ?? '') === 'onboard' &&
    String(advance.next_stage ?? '') === 'deliver' &&
    onboardGate &&
    !onboardGate.ok;
  const showPaymentGate =
    tab === 'handover' &&
    String(advance.current_stage ?? '') === 'handover' &&
    String(advance.next_stage ?? '') === 'retain' &&
    Boolean(paymentGate?.requires_confirm);
  const paymentConfirmAllowed =
    !paymentGate?.strict_mode || paymentGate?.can_confirm !== false || canFinanceConfirm;

  const showLaunchQaGate =
    tab === 'deliver' &&
    String(advance.current_stage ?? '') === 'deliver' &&
    String(advance.next_stage ?? '') === 'handover' &&
    Boolean(launchQaGate?.requires_confirm);

  async function advanceForward() {
    const nxt = String(advance.next_stage ?? '');
    if (!nxt || !canEdit) return;
    if (showPaymentGate && (!financeConfirm || !paymentConfirmAllowed)) return;
    if (showLaunchQaGate && !launchQaConfirm) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchServiceLifecycle(token, lifecycleId, {
        stage: nxt,
        finance_confirm: showPaymentGate && financeConfirm ? true : undefined,
        launch_qa_confirm: showLaunchQaGate && launchQaConfirm ? true : undefined,
      });
      setTab(nxt);
      setFinanceConfirm(false);
      setLaunchQaConfirm(false);
      onStageChanged?.(nxt);
      setMessage(`Đã chuyển → ${STAGE_LABELS[nxt] ?? nxt}`);
      onFinanceRefresh?.();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chuyển stage thất bại');
    } finally {
      setSaving(false);
    }
  }

  const tabTasks = tasks[tab] ?? [];
  const tabProg = progress[tab] ?? { total: 0, done: 0, pct: 100 };
  const showTmmtGate =
    tab === 'onboard' &&
    tmmtValidation &&
    String(advance.current_stage ?? '') === 'onboard' &&
    String(advance.next_stage ?? '') === 'deliver';

  const onCurrentTab = tab === String(advance.current_stage ?? '');
  const canShowAdvanceButton =
    canEdit &&
    onCurrentTab &&
    (Boolean(advance.can_advance_forward) ||
      (showPaymentGate && financeConfirm) ||
      (showLaunchQaGate && launchQaConfirm));

  const workflowCard = (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{STAGE_LABELS[tab] ?? tab}</h3>
        <span className="muted">
          {tabProg.done}/{tabProg.total} task · {tabProg.pct}%
          {ops
            ? ` · % đúng hạn ${ops.case.scored > 0 ? `${ops.case.pct}% (${ops.case.on_time}/${ops.case.scored})` : '—'} · Giờ thực ${ops.case.actual_hours} / báo giá ${ops.case.quote_hours}`
            : ''}
        </span>
      </div>

      {Boolean(advance.block_reason) && onCurrentTab && !showPaymentGate && !showLaunchQaGate ? (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          {String(advance.block_reason)}
        </p>
      ) : null}

      {showTmmtGate && !tmmtValidation.ok ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--accent)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <p className="error" style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Gate TMMT chưa pass</p>
          <ul className="error" style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
            {tmmtValidation.messages.slice(0, 3).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {onOpenTmmtTab ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenTmmtTab}>
              Mở tab TMMT chính thức
            </button>
          ) : null}
          {onOpenAiPlannerTab ? (
            <button type="button" className="btn btn-sm" onClick={onOpenAiPlannerTab}>
              Mở AI Planner →
            </button>
          ) : null}
        </div>
      ) : null}

      {showTmmtGate && tmmtValidation.ok ? (
        <p style={{ color: 'var(--accent)', marginTop: '0.75rem' }}>Gate TMMT ✓ — có thể chuyển Deliver</p>
      ) : null}

      {showLaunchQaGate ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #c90',
            background: 'rgba(255, 200, 0, 0.04)',
          }}
        >
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600, color: '#c90' }}>
            Gate Launch QA — chưa launch_ready
          </p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            {(launchQaGate?.messages ?? [])[0] ??
              `Checklist ${launchQaGate?.progress_completed ?? 0}/${launchQaGate?.progress_total ?? 0} — hoàn thiện trước bàn giao`}
          </p>
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
            Meta preflight (pixel · test · hub map · CAPI) auto-sync — xem{' '}
            <a href="/meta/tracking" className="nav-link">
              Meta Tracking
            </a>
          </p>
          {onOpenLaunchQaTab ? (
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginBottom: '0.5rem' }} onClick={onOpenLaunchQaTab}>
              Mở tab Launch QA
            </button>
          ) : null}
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={launchQaConfirm}
              onChange={(e) => setLaunchQaConfirm(e.target.checked)}
              disabled={!canEdit || saving}
            />
            <span>
              Xác nhận chuyển sang <strong>Bàn giao</strong> dù Launch QA chưa launch_ready (AM/QA chịu trách nhiệm)
            </span>
          </label>
        </div>
      ) : null}

      {showOnboardGate ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--accent)',
            background: 'rgba(37, 99, 235, 0.04)',
          }}
        >
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Gate Onboard — chưa đủ checklist</p>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem' }}>
            Orchestrator {onboardGate?.orchestrator_percent ?? 0}% · Checklist {onboardGate?.checklist_percent ?? 0}%
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
            {(onboardGate?.messages ?? []).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showPaymentGate ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 8,
            border: `1px solid ${paymentGate?.strict_mode ? '#c33' : '#c90'}`,
            background: paymentGate?.strict_mode ? 'rgba(200, 50, 50, 0.04)' : 'rgba(255, 200, 0, 0.04)',
          }}
        >
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600, color: paymentGate?.strict_mode ? '#c33' : '#c90' }}>
            Gate Payment — {paymentGate?.strict_mode ? 'strict mode' : 'còn công nợ HĐ'}
          </p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            {(paymentGate?.messages ?? [])[0] ??
              `Còn ${Number(paymentGate?.outstanding_vnd ?? 0).toLocaleString('vi-VN')} VND chưa thu`}
          </p>
          {Number(paymentGate?.ar_overdue_vnd ?? 0) > 0 ? (
            <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
              AR quá hạn: {Number(paymentGate?.ar_overdue_vnd).toLocaleString('vi-VN')} VND · AR chờ thu:{' '}
              {Number(paymentGate?.ar_pending_vnd ?? 0).toLocaleString('vi-VN')} VND
            </p>
          ) : null}
          {onOpenFinanceTab ? (
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginBottom: '0.5rem' }} onClick={onOpenFinanceTab}>
              Mở tab Tài chính
            </button>
          ) : null}
          <Link href="/crm/financials" className="nav-link" style={{ display: 'inline-block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            Xem AR aging org-wide →
          </Link>
          {paymentConfirmAllowed ? (
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={financeConfirm}
                onChange={(e) => setFinanceConfirm(e.target.checked)}
                disabled={!canEdit || saving}
              />
              <span>
                {paymentGate?.strict_mode
                  ? 'Finance xác nhận chuyển sang Giữ chân dù còn công nợ / AR quá hạn'
                  : 'Xác nhận chuyển sang Giữ chân dù còn công nợ (AM/SP chịu trách nhiệm thu hồi)'}
              </span>
            </label>
          ) : (
            <p className="error" style={{ margin: 0, fontSize: '0.9rem' }}>
              Strict mode — cần quyền Finance (`crm_business_dashboard.view`) để override.
            </p>
          )}
        </div>
      ) : null}

      {showPlanGoLiveGates || showAcceptanceGate ? (
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
          {(showPlanGoLiveGates ? (['plan', 'go_live'] as const) : (['acceptance'] as const)).map((key) => {
            const gate = clientGates?.[key];
            const label = key === 'plan' ? 'Kế hoạch' : key === 'go_live' ? 'Go-live' : 'Nghiệm thu';
            const status = String(gate?.status ?? 'pending');
            const statusLabel =
              status === 'approved' ? 'Khách đã duyệt' : status === 'revision_requested' ? 'Yêu cầu sửa' : 'Chờ duyệt';
            return (
              <div
                key={key}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>
                  Cửa khách duyệt · {label}: {statusLabel}
                  {gate?.revision_count ? ` · sửa ${gate.revision_count} lần` : ''}
                </p>
                {gate?.note ? <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>{gate.note}{gate.decided_by_name ? ` — ${gate.decided_by_name}` : ''}</p> : null}
                {clientGates?.can_record ? (
                  <>
                    <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
                      <span className="muted">Ghi chú</span>
                      <textarea
                        rows={2}
                        value={gateNote[key] ?? ''}
                        onChange={(e) => setGateNote((prev) => ({ ...prev, [key]: e.target.value }))}
                        disabled={saving}
                        style={{ padding: '0.35rem 0.45rem', borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                      <button type="button" className="btn btn-sm btn-primary" disabled={saving || !(gateNote[key] ?? '').trim()} onClick={() => void recordGate(key, 'approved')}>
                        Khách duyệt
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" disabled={saving || !(gateNote[key] ?? '').trim()} onClick={() => void recordGate(key, 'revision_requested')}>
                        Yêu cầu sửa
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.4rem' }}>
        {tabTasks.length === 0 ? <li className="muted">Không có task.</li> : null}
        {tabTasks.map((task) => (
          <li
            key={task.id}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              padding: '0.45rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <input
              type="checkbox"
              checked={task.is_done}
              disabled={!canEdit || saving}
              onChange={() => void toggleTask(task)}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.35rem' }}>
              <div>
                <strong>{task.title}</strong>
                {task.overdue ? (
                  <span className="error" style={{ marginLeft: '0.4rem', fontSize: '0.82rem' }}>Quá hạn</span>
                ) : null}
                {task.description ? (
                  <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                    {task.description}
                  </p>
                ) : null}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                  fontSize: '0.82rem',
                }}
              >
                <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <span className="muted">Trạng thái</span>
                  <select
                    value={task.work_status && ['todo', 'in_progress', 'done', 'na'].includes(task.work_status) ? task.work_status : task.is_done ? 'done' : 'todo'}
                    disabled={!canEdit || saving}
                    style={{ padding: '0.2rem 0.35rem' }}
                    onChange={(e) => {
                      const next = e.target.value;
                      if ((task.work_status ?? (task.is_done ? 'done' : 'todo')) === next) return;
                      void patchTaskAssignment(task, { work_status: next });
                    }}
                  >
                    {WORK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <span className="muted">Nhân sự</span>
                  {canReassign ? (
                    <select
                      value={task.assignee_staff_id != null && task.assignee_staff_id > 0 ? String(task.assignee_staff_id) : ''}
                      disabled={!canEdit || saving}
                      style={{ padding: '0.2rem 0.35rem', minWidth: 140 }}
                      onChange={(e) => {
                        const next = e.target.value ? Number(e.target.value) : null;
                        const reason = (assigneeReason[task.id] ?? '').trim();
                        if (!reason) {
                          setError('Cần lý do khi đổi người.');
                          return;
                        }
                        if (Number(task.assignee_staff_id ?? 0) === Number(next ?? 0)) return;
                        void patchTaskAssignment(task, { assignee_staff_id: next, assignee_reason: reason });
                      }}
                    >
                      <option value="">{task.assignee ? task.assignee : '— Chọn —'}</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{task.assignee || '—'}</span>
                  )}
                </label>
                {canReassign ? (
                  <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <span className="muted">Lý do đổi</span>
                    <input
                      type="text"
                      value={assigneeReason[task.id] ?? ''}
                      placeholder="Bắt buộc khi đổi"
                      disabled={saving}
                      style={{ width: 140, padding: '0.2rem 0.35rem' }}
                      onChange={(e) => setAssigneeReason((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    />
                  </label>
                ) : null}
                <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <span className="muted">Priority</span>
                  <select
                    value={task.priority && TASK_PRIORITIES.includes(task.priority as (typeof TASK_PRIORITIES)[number]) ? task.priority : 'normal'}
                    disabled={!canEdit || saving}
                    style={{ padding: '0.2rem 0.35rem' }}
                    onChange={(e) => {
                      const next = e.target.value;
                      if ((task.priority ?? 'normal') === next) return;
                      void patchTaskAssignment(task, { priority: next });
                    }}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <span className="muted">Due</span>
                  <input
                    type="date"
                    value={task.due_date ?? ''}
                    disabled={!canEdit || saving}
                    style={{ padding: '0.2rem 0.35rem' }}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      if ((task.due_date ?? null) === next) return;
                      void patchTaskAssignment(task, { due_date: next });
                    }}
                  />
                </label>
                <span className="muted">Giờ thực {task.actual_hours ?? 0} / báo giá</span>
                <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={hourDraft[task.id]?.hours ?? (task.quote_hours != null ? String(task.quote_hours) : '')}
                    disabled={!canEdit || saving}
                    title="Giờ báo giá"
                    style={{ width: 64, padding: '0.2rem 0.35rem' }}
                    onChange={(e) =>
                      setHourDraft((prev) => ({
                        ...prev,
                        [task.id]: { hours: e.target.value, note: prev[task.id]?.note ?? '', actual: prev[task.id]?.actual ?? '' },
                      }))
                    }
                    onBlur={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isFinite(next) || next === Number(task.quote_hours ?? 0)) return;
                      void patchTaskAssignment(task, { hours: next });
                    }}
                  />
                </label>
                {canEdit ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="Cộng giờ"
                      value={hourDraft[task.id]?.actual ?? ''}
                      disabled={saving}
                      style={{ width: 72, padding: '0.2rem 0.35rem' }}
                      onChange={(e) =>
                        setHourDraft((prev) => ({
                          ...prev,
                          [task.id]: { hours: prev[task.id]?.hours ?? String(task.quote_hours ?? ''), note: prev[task.id]?.note ?? '', actual: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      placeholder="Ghi chú giờ"
                      value={hourDraft[task.id]?.note ?? ''}
                      disabled={saving}
                      style={{ width: 120, padding: '0.2rem 0.35rem' }}
                      onChange={(e) =>
                        setHourDraft((prev) => ({
                          ...prev,
                          [task.id]: { hours: prev[task.id]?.hours ?? String(task.quote_hours ?? ''), note: e.target.value, actual: prev[task.id]?.actual ?? '' },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={saving}
                      onClick={() => {
                        const hours = Number(hourDraft[task.id]?.actual);
                        if (!Number.isFinite(hours) || hours <= 0) {
                          setError('Nhập giờ thực dương trước khi ghi.');
                          return;
                        }
                        void patchTaskAssignment(task, {
                          actual_hours_entry: { hours, note: hourDraft[task.id]?.note ?? '' },
                        });
                      }}
                    >
                      Ghi giờ
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {ops && ops.staff.length > 0 ? (
        <table style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.35rem' }}>Nhân sự</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.35rem' }}>% đúng hạn</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.35rem' }}>Giờ thực / báo giá</th>
            </tr>
          </thead>
          <tbody>
            {ops.staff.map((row) => (
              <tr key={`${row.staff_id ?? 'x'}-${row.name}`}>
                <td style={{ padding: '0.25rem 0.35rem' }}>{row.name}</td>
                <td style={{ padding: '0.25rem 0.35rem' }}>{row.scored > 0 ? `${row.pct}% (${row.on_time}/${row.scored})` : '—'}</td>
                <td style={{ padding: '0.25rem 0.35rem' }}>{row.actual_hours} / {row.quote_hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {canShowAdvanceButton ? (
        <button type="button" className="btn btn-sm" style={{ marginTop: '0.75rem' }} disabled={saving} onClick={() => void advanceForward()}>
          Chuyển → {STAGE_LABELS[String(advance.next_stage)] ?? String(advance.next_stage)}
        </button>
      ) : null}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {loading ? <p className="muted">Đang tải workflow…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            className={tab === s ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
            onClick={() => setTab(s)}
          >
            {STAGE_LABELS[s] ?? s} ({progress[s]?.done ?? 0}/{progress[s]?.total ?? 0})
          </button>
        ))}
      </div>

      {tab === 'consult' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) min(320px, 38%)', gap: '1rem', alignItems: 'start' }}>
          {workflowCard}
          <ConsultBriefPanel token={token} user={user} lifecycleId={lifecycleId} onPrefilled={() => void reload()} />
        </div>
      ) : (
        <>
          {tab === 'onboard' ? (
            <LifecycleOnboardingPanel token={token} user={user} lifecycleId={lifecycleId} stage={tab} />
          ) : null}
          {workflowCard}
        </>
      )}
    </div>
  );
}
