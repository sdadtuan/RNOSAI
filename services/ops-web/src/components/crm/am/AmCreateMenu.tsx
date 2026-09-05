'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { IndustrySelect } from '@/components/agency/IndustrySelect';
import { OwnerAmSelect } from '@/components/agency/OwnerAmSelect';
import { ApiError, fetchAgencyClients, type AgencyClient } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  createAmAccount,
  createAmPlan,
  createAmTask,
  type AmPlanKind,
  type AmTaskKind,
  type AmTaskPriority,
} from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { AmTimeline } from './AmTimeline';
import { useAmPage, type AmCreateKind } from './AmShell';

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

const PLAN_KIND_OPTS: Array<{ value: AmPlanKind; label: string }> = [
  { value: 'care', label: 'Care' },
  { value: 'qbr', label: 'QBR' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'expand', label: 'Expand' },
];

export function AmCreateMenu({ canEdit }: AmCreateMenuProps) {
  const { token, retry, data, user, createKind, openCreate, closeCreate } = useAmPage();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientTab, setClientTab] = useState<'create' | 'attach'>('create');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [industrySlug, setIndustrySlug] = useState('');
  const [ownerAmId, setOwnerAmId] = useState('');
  const [attachQ, setAttachQ] = useState('');
  const [attachHits, setAttachHits] = useState<AgencyClient[]>([]);
  const [attachPicked, setAttachPicked] = useState('');
  const [attachSearching, setAttachSearching] = useState(false);
  const [planKind, setPlanKind] = useState<AmPlanKind>('care');
  const wrapRef = useRef<HTMLDivElement>(null);
  const book = data?.my_book ?? [];
  const agencyWrite = hasCap(user, 'crm_agency', 'create') || hasCap(user, 'crm_agency', 'write');

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (createKind !== 'client') return;
    setClientTab('create');
    setCode('');
    setName('');
    setIndustrySlug('');
    setOwnerAmId(user.email ?? '');
    setAttachQ('');
    setAttachHits([]);
    setAttachPicked('');
  }, [createKind, user.email]);

  useEffect(() => {
    if (createKind !== 'client' || clientTab !== 'attach') return;
    const q = attachQ.trim();
    if (q.length < 2) {
      setAttachHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setAttachSearching(true);
      void fetchAgencyClients(token, { q })
        .then((out) => {
          if (!cancelled) setAttachHits(out.clients ?? []);
        })
        .catch(() => {
          if (!cancelled) setAttachHits([]);
        })
        .finally(() => {
          if (!cancelled) setAttachSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [attachQ, clientTab, createKind, token]);

  function openStub(kind: AmCreateKind) {
    if (!canEdit) return;
    setOpen(false);
    openCreate(kind);
  }

  const stubTitle =
    createKind === 'client'
      ? 'Tạo khách'
      : createKind === 'task'
        ? 'Tạo việc'
        : createKind === 'plan'
          ? 'Tạo Renewal/Plan'
          : createKind === 'interaction'
            ? 'Log tương tác'
            : '';

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
      closeCreate();
      retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không tạo được việc', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateClient(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    if (!agencyWrite) {
      push('Cần quyền crm_agency.create — mở Agency để tạo khách', 'error');
      return;
    }
    if (!code.trim() || !name.trim() || !industrySlug) {
      push('Cần mã, tên và ngành', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmAccount(token, {
        mode: 'create',
        code: code.trim().toUpperCase(),
        name: name.trim(),
        industry_slug: industrySlug || undefined,
        owner_am_id: ownerAmId.trim() || user.email || undefined,
      });
      push('Đã tạo khách', 'success');
      closeCreate();
      retry();
    } catch (err) {
      if (err instanceof ApiError && err.message === 'agency_write_required') {
        push('Cần quyền tạo Agency client', 'error');
      } else {
        push(err instanceof Error ? err.message : 'Không tạo được khách', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onAttachClient(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    const id = attachPicked.trim();
    if (!id) {
      push('Chọn khách đã có', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmAccount(token, { mode: 'attach', agency_client_id: id });
      push('Đã gắn khách vào AM', 'success');
      closeCreate();
      retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không gắn được khách', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onCreatePlan(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    const form = new FormData(ev.currentTarget);
    const agency_client_id = String(form.get('agency_client_id') ?? '').trim();
    const kind = String(form.get('kind') ?? 'care') as AmPlanKind;
    const period_key = String(form.get('period_key') ?? '').trim();
    const contractRaw = String(form.get('contract_id') ?? '').trim();
    const due_on = String(form.get('due_on') ?? '').trim();
    if (!agency_client_id || !period_key) {
      push('Cần account và period', 'error');
      return;
    }
    if (kind === 'renewal' && !contractRaw) {
      push('Renewal cần contract_id', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmPlan(token, {
        agency_client_id,
        kind,
        period_key,
        contract_id: contractRaw ? Number(contractRaw) : undefined,
        due_on: due_on || undefined,
      });
      push('Đã tạo plan', 'success');
      closeCreate();
      retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không tạo được plan', 'error');
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
          <Link href="/crm/account-management/clients/new" role="menuitem" className="am-create__link" onClick={() => setOpen(false)}>
            Khách (form đầy đủ)
          </Link>
          <button type="button" role="menuitem" onClick={() => openStub('client')}>
            Khách nhanh
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
          <button type="button" role="menuitem" onClick={() => openStub('interaction')}>
            Log tương tác
          </button>
        </div>
      ) : null}
      {createKind ? (
        <div
          className="am-drawer-bg"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeCreate();
          }}
        >
          <div className="am-drawer" role="dialog" aria-label={stubTitle}>
            <div className="am-drawer__head">
              <strong>{stubTitle}</strong>
              <button type="button" className="am-btn" onClick={closeCreate}>
                Đóng
              </button>
            </div>
            {createKind === 'task' ? (
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
                <AccountField book={book} />
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
                  <button type="button" className="am-btn" onClick={closeCreate}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={saving}>
                    {saving ? 'Đang tạo…' : 'Tạo việc'}
                  </button>
                </div>
              </form>
            ) : null}
            {createKind === 'client' ? (
              <>
                <div className="am-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={clientTab === 'create' ? 'is-active' : ''}
                    aria-selected={clientTab === 'create'}
                    onClick={() => setClientTab('create')}
                  >
                    Tạo mới
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={clientTab === 'attach' ? 'is-active' : ''}
                    aria-selected={clientTab === 'attach'}
                    onClick={() => setClientTab('attach')}
                  >
                    Gắn đã có
                  </button>
                </div>
                {clientTab === 'create' ? (
                  !agencyWrite ? (
                    <p className="am-muted">
                      Cần quyền crm_agency.create.{' '}
                      <Link href="/agency/clients/new">Mở /agency/clients/new</Link>
                    </p>
                  ) : (
                    <form className="am-form" onSubmit={(ev) => void onCreateClient(ev)}>
                      <label className="am-field">
                        <span>Mã (CODE) *</span>
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          required
                          placeholder="AP01"
                        />
                      </label>
                      <label className="am-field">
                        <span>Tên *</span>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="An Phu"
                        />
                      </label>
                      <label className="am-field">
                        <span>Ngành *</span>
                        <IndustrySelect
                          token={token}
                          value={industrySlug}
                          onChange={setIndustrySlug}
                          required
                        />
                      </label>
                      <label className="am-field">
                        <span>Owner AM</span>
                        <OwnerAmSelect token={token} value={ownerAmId} onChange={setOwnerAmId} />
                      </label>
                      <div className="am-form__actions">
                        <button type="button" className="am-btn" onClick={closeCreate}>
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="am-btn am-btn--primary"
                          disabled={saving || !industrySlug}
                        >
                          {saving ? 'Đang tạo…' : 'Tạo khách'}
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  <form className="am-form" onSubmit={(ev) => void onAttachClient(ev)}>
                    <label className="am-field">
                      <span>Tìm clients *</span>
                      <input
                        value={attachQ}
                        onChange={(e) => {
                          setAttachQ(e.target.value);
                          setAttachPicked('');
                        }}
                        placeholder="Mã hoặc tên (≥ 2 ký tự)"
                      />
                    </label>
                    {attachSearching ? <p className="am-muted">Đang tìm…</p> : null}
                    {attachHits.length > 0 ? (
                      <ul className="am-attach-list">
                        {attachHits.map((row) => (
                          <li key={row.id}>
                            <label>
                              <input
                                type="radio"
                                name="agency_client_id"
                                checked={attachPicked === row.id}
                                onChange={() => setAttachPicked(row.id)}
                              />
                              <span>
                                {row.code} · {row.name}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : attachQ.trim().length >= 2 && !attachSearching ? (
                      <p className="am-muted">Không tìm thấy clients.</p>
                    ) : null}
                    <div className="am-form__actions">
                      <button type="button" className="am-btn" onClick={closeCreate}>
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="am-btn am-btn--primary"
                        disabled={saving || !attachPicked}
                      >
                        {saving ? 'Đang gắn…' : 'Gắn khách'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : null}
            {createKind === 'interaction' ? (
              <AmTimeline
                book={book}
                composerOnly
                onSaved={() => {
                  closeCreate();
                  retry();
                }}
              />
            ) : null}
            {createKind === 'plan' ? (
              <form className="am-form" onSubmit={(ev) => void onCreatePlan(ev)}>
                <label className="am-field">
                  <span>Loại *</span>
                  <select
                    name="kind"
                    value={planKind}
                    onChange={(e) => setPlanKind(e.target.value as AmPlanKind)}
                  >
                    {PLAN_KIND_OPTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <AccountField book={book} />
                <label className="am-field">
                  <span>Period *</span>
                  <input name="period_key" required placeholder="2026-Q3" />
                </label>
                <label className="am-field">
                  <span>{planKind === 'renewal' ? 'Hợp đồng *' : 'Hợp đồng'}</span>
                  <input
                    name="contract_id"
                    type="number"
                    min={1}
                    required={planKind === 'renewal'}
                    placeholder="contract_id"
                  />
                </label>
                <label className="am-field">
                  <span>Hạn</span>
                  <input name="due_on" type="date" />
                </label>
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={closeCreate}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={saving}>
                    {saving ? 'Đang tạo…' : 'Tạo plan'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountField({ book }: { book: Array<{ agency_client_id: string; name: string }> }) {
  return (
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
  );
}
