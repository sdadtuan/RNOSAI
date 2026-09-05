'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createAmTask, type AmTaskKind, type AmTaskPriority } from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

type CreateKind = 'client' | 'task' | 'plan';

type AmCreateMenuProps = {
  canEdit: boolean;
};

const KIND_OPTS: Array<{ value: AmTaskKind; label: string }> = [
  { value: 'task', label: 'Task' },
  { value: 'client_request', label: 'Yêu cầu khách' },
  { value: 'issue', label: 'Issue' },
  { value: 'escalation', label: 'Escalate' },
  { value: 'approval', label: 'Approval' },
  { value: 'milestone', label: 'Milestone' },
];

const PRIORITY_OPTS: Array<{ value: AmTaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function AmCreateMenu({ canEdit }: AmCreateMenuProps) {
  const { token, retry, data } = useAmPage();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [stub, setStub] = useState<CreateKind | null>(null);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const book = data?.my_book ?? [];

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function openStub(kind: CreateKind) {
    if (!canEdit) return;
    setOpen(false);
    setStub(kind);
  }

  const stubTitle =
    stub === 'client' ? 'Tạo khách' : stub === 'task' ? 'Tạo việc' : stub === 'plan' ? 'Tạo Renewal/Plan' : '';

  async function onCreateTask(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    const form = new FormData(ev.currentTarget);
    const agency_client_id = String(form.get('agency_client_id') ?? '').trim();
    const title = String(form.get('title') ?? '').trim();
    const kind = String(form.get('kind') ?? 'task') as AmTaskKind;
    const priority = String(form.get('priority') ?? 'medium') as AmTaskPriority;
    const dueRaw = String(form.get('due_at') ?? '').trim();
    if (!agency_client_id || !title) {
      push('Cần account và tiêu đề', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmTask(token, {
        agency_client_id,
        title,
        kind,
        priority,
        due_at: dueRaw ? new Date(dueRaw).toISOString() : undefined,
      });
      push('Đã tạo việc', 'success');
      setStub(null);
      retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không tạo được việc', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="am-create" ref={wrapRef}>
      <button
        type="button"
        className="am-btn am-btn--primary"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={!canEdit}
        title={canEdit ? 'Tạo mới' : 'Cần quyền crm_am.edit'}
        onClick={() => canEdit && setOpen((v) => !v)}
      >
        + Tạo mới ▾
      </button>
      {open ? (
        <div className="am-create__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => openStub('client')}>
            Khách
          </button>
          <button type="button" role="menuitem" onClick={() => openStub('task')}>
            Việc
          </button>
          <button type="button" role="menuitem" onClick={() => openStub('plan')}>
            Renewal/Plan
          </button>
          <button type="button" role="menuitem" disabled title="Mở ở Wave 4">
            Cơ hội
          </button>
          <button type="button" role="menuitem" disabled title="Mở ở Wave 3">
            Log tương tác
          </button>
        </div>
      ) : null}
      {stub ? (
        <div className="am-drawer-bg" role="presentation">
          <div className="am-drawer" role="dialog" aria-label={stubTitle}>
            <div className="am-drawer__head">
              <strong>{stubTitle}</strong>
              <button type="button" className="am-btn" onClick={() => setStub(null)}>
                Đóng
              </button>
            </div>
            {stub === 'task' ? (
              <form className="am-form" onSubmit={(ev) => void onCreateTask(ev)}>
                <label className="am-field">
                  <span>Loại</span>
                  <select name="kind" defaultValue="task">
                    {KIND_OPTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="am-field">
                  <span>Account *</span>
                  {book.length > 0 ? (
                    <select name="agency_client_id" required defaultValue="">
                      <option value="" disabled>
                        Chọn khách
                      </option>
                      {book.map((row) => (
                        <option key={row.agency_client_id} value={row.agency_client_id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input name="agency_client_id" required placeholder="agency_client_id" />
                  )}
                </label>
                <label className="am-field">
                  <span>Tiêu đề *</span>
                  <input name="title" required maxLength={200} placeholder="Việc cần làm" />
                </label>
                <label className="am-field">
                  <span>Priority</span>
                  <select name="priority" defaultValue="medium">
                    {PRIORITY_OPTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="am-field">
                  <span>Hạn xử lý</span>
                  <input name="due_at" type="datetime-local" />
                </label>
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setStub(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={saving}>
                    {saving ? 'Đang tạo…' : 'Tạo việc'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="am-muted">Drawer tạo mới mở ở Task 7.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
