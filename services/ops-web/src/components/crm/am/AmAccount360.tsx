'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchStaffRoster, type StaffRosterRow } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  createAmPlan,
  createAmTask,
  fetchAmAccount,
  mergeAmAccount,
  overrideAmHealth,
  patchAmAccount,
  transferAmAccounts,
  type AmAccount360 as AmAccount360Data,
  type AmAccountContact,
} from '@/lib/crm/am-api';
import {
  AM_360_STATUS_COPY,
  AM_360_TABS,
  am360LoadErrorCopy,
  am360LoadErrorKind,
  am360PatchToast,
  am360WaveCopy,
  parseAm360Tab,
  type Am360LoadError,
  type Am360TabId,
} from '@/lib/crm/am-account-360.util';
import { canAssignAmAccounts } from '@/lib/crm/am-accounts-views.util';
import { bandCopy, vnd } from '@/lib/crm/am-format';
import { amGrowthNextRefreshNonce } from '@/lib/crm/am-growth.util';
import { useToast } from '@/lib/toast';
import { amRecoveryRequiredCopy } from '@/lib/crm/am-risk.util';
import { AmContactDrawer } from './AmContactDrawer';
import { AmFinance } from './AmFinance';
import { AmGrowth } from './AmGrowth';
import { AmOpportunityForm } from './AmOpportunityForm';
import { AmPlaceholder } from './AmPlaceholder';
import { AmRiskForm } from './AmRiskForm';
import { AmTimeline } from './AmTimeline';
import { useAmPage } from './AmShell';

type DrawerKind =
  | 'edit'
  | 'contact'
  | 'owner'
  | 'lifecycle'
  | 'merge'
  | 'task'
  | 'renewal'
  | 'interaction'
  | 'risk'
  | 'opportunity'
  | null;

function bandClass(band: AmAccount360Data['band']): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  if (band === 'critical') return 'am-pill am-pill--crit';
  return 'am-pill';
}

function dashText(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function AmAccount360({ agencyClientId }: { agencyClientId: string }) {
  const { token, user, canEdit } = useAmPage();
  const { push } = useToast();
  const router = useRouter();
  const pathname = usePathname() ?? `/crm/account-management/clients/${agencyClientId}`;
  const searchParams = useSearchParams();
  const tab = parseAm360Tab(searchParams.get('tab'));

  const [data, setData] = useState<AmAccount360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Am360LoadError | ''>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [mergeHint, setMergeHint] = useState('');
  const [roster, setRoster] = useState<StaffRosterRow[]>([]);
  const [overrideBand, setOverrideBand] = useState<AmAccount360Data['band']>('watch');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideUntil, setOverrideUntil] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [growthRefreshNonce, setGrowthRefreshNonce] = useState(0);

  const canAssign = canAssignAmAccounts(user);
  const canManage = hasCap(user, 'crm_am', 'manage');
  const primary = data?.contacts.find((row) => row.is_primary) ?? data?.contacts[0] ?? null;

  const load = useCallback(async () => {
    if (!token || !agencyClientId) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAmAccount(token, agencyClientId));
    } catch (err) {
      setData(null);
      setError(am360LoadErrorKind(err instanceof ApiError ? err.status : undefined));
    } finally {
      setLoading(false);
    }
  }, [agencyClientId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !canAssign) return;
    void fetchStaffRoster(token)
      .then((out) => setRoster(out.staff ?? []))
      .catch(() => setRoster([]));
  }, [canAssign, token]);

  function setTab(next: Am360TabId) {
    const qs = new URLSearchParams(searchParams.toString());
    if (next === 'overview') qs.delete('tab');
    else qs.set('tab', next);
    const suffix = qs.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  function openDrawer(kind: DrawerKind) {
    setMenuOpen(false);
    setFormError('');
    setDrawer(kind);
  }

  async function onPatch(body: Parameters<typeof patchAmAccount>[2]): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFormError('');
    try {
      const next = await patchAmAccount(token, agencyClientId, body);
      setData(next);
      setDrawer(null);
      const toast = am360PatchToast({
        nameRequested: Boolean(body.name?.trim()),
        nameUnchanged: Boolean(next.name_unchanged),
      });
      push(toast.message, toast.tone);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không lưu được';
      setFormError(message === 'primary_contact_required' ? 'Active cần tối thiểu một contact chính' : message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onArchive() {
    if (!canManage || busy) return;
    if (!window.confirm('Lưu trữ khách này? Lifecycle sẽ chuyển sang Paused.')) return;
    await onPatch({ archive: true });
  }

  async function onMerge(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canManage || busy) return;
    const form = new FormData(ev.currentTarget);
    const into = String(form.get('into_agency_client_id') ?? '').trim();
    if (!into) {
      setFormError('Cần khách đích');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await mergeAmAccount(token, agencyClientId, into);
      setMergeHint('');
      setDrawer(null);
      push('Đã hợp nhất', 'success');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'merge_denied';
      setFormError(message);
      if (err instanceof ApiError && err.status === 403) {
        setMergeHint(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canAssign || busy) return;
    const form = new FormData(ev.currentTarget);
    const toStaffId = Number(String(form.get('to_staff_id') ?? '').trim());
    const reason = String(form.get('reason') ?? '').trim();
    if (!toStaffId || !reason) {
      setFormError('Cần owner và lý do');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await transferAmAccounts(token, {
        agency_client_ids: [agencyClientId],
        to_staff_id: toStaffId,
        reason,
        keep_secondary: form.get('keep_secondary') === 'on',
        move_open_tasks: form.get('move_open_tasks') === '1',
      });
      setDrawer(null);
      push('Đã đổi owner', 'success');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không đổi được owner');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateTask(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canEdit || busy) return;
    const form = new FormData(ev.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setFormError('Cần tiêu đề');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createAmTask(token, { agency_client_id: agencyClientId, title });
      setDrawer(null);
      push('Đã tạo việc', 'success');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được việc');
    } finally {
      setBusy(false);
    }
  }

  async function onStartRenewal(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canEdit || busy) return;
    const form = new FormData(ev.currentTarget);
    const period_key = String(form.get('period_key') ?? '').trim();
    const contractRaw = String(form.get('contract_id') ?? '').trim();
    if (!period_key) {
      setFormError('Cần period');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createAmPlan(token, {
        agency_client_id: agencyClientId,
        kind: 'renewal',
        period_key,
        contract_id: contractRaw ? Number(contractRaw) : undefined,
      });
      setDrawer(null);
      push('Đã bắt đầu gia hạn', 'success');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được gia hạn');
    } finally {
      setBusy(false);
    }
  }

  const activeContracts = useMemo(
    () => (data?.contracts ?? []).filter((row) => /active|renewing/i.test(row.status)),
    [data],
  );

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải Account 360…</p>
      </section>
    );
  }

  if (error === 'not_found' || error === 'load_failed' || !data) {
    const kind: Am360LoadError = error === 'not_found' ? 'not_found' : 'load_failed';
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/clients">Khách hàng</Link>
        </p>
        <div className="am-widget__error">
          <p>{am360LoadErrorCopy(kind)}</p>
        </div>
      </section>
    );
  }

  const statusLabel = AM_360_STATUS_COPY[data.am_status] ?? data.am_status;
  const activeTab = AM_360_TABS.find((item) => item.id === tab) ?? AM_360_TABS[0];

  return (
    <section className="am-page am-360">
      <p className="am-crumb">
        <Link href="/crm/account-management/clients">Khách hàng</Link>
        {' / '}
        {data.name}
      </p>

      <header className="am-360__head">
        <div>
          <h1>{data.name}</h1>
          <div className="am-360__meta">
            <span className="am-pill">{statusLabel}</span>
            <Link
              className={bandClass(data.band)}
              href={`/crm/account-management/health/${data.agency_client_id}`}
              title="Health & Risk"
            >
              {dashText(data.score)} / 100 · {bandCopy(data.band)}
            </Link>
            <span>Mã: {dashText(data.code)}</span>
            <span>{dashText(data.industry)}</span>
            <span>Tier {dashText(data.tier)}</span>
            <span>{dashText(data.team_label)}</span>
            {canAssign ? (
              <button type="button" className="am-link" onClick={() => openDrawer('owner')}>
                Owner: {dashText(data.owner_label)} ▾
              </button>
            ) : (
              <span>Owner: {dashText(data.owner_label)}</span>
            )}
            {data.delivery_label ? <span>Delivery: {data.delivery_label}</span> : null}
            {data.media_label ? <span>Media: {data.media_label}</span> : null}
            <Link className="am-link" href={`/agency/clients/${data.agency_client_id}`}>
              Mở Agency
            </Link>
          </div>
        </div>
        <div className="am-360__more">
          <button
            type="button"
            className="am-btn"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋮
          </button>
          {menuOpen ? (
            <div className="am-create__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={!canEdit}
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/crm/account-management/clients/${agencyClientId}/edit`);
                }}
              >
                Sửa
              </button>
              <button type="button" role="menuitem" onClick={() => openDrawer('contact')}>
                Contact
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canAssign}
                title={canAssign ? 'Đổi owner' : 'Cần quyền crm_am.assign'}
                onClick={() => openDrawer('owner')}
              >
                Đổi owner
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canEdit}
                onClick={() => openDrawer('lifecycle')}
              >
                Lifecycle
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canManage}
                title={canManage ? 'Lưu trữ' : 'Cần quyền crm_am.manage'}
                onClick={() => void onArchive()}
              >
                Archive
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canManage}
                title={
                  canManage
                    ? mergeHint || 'Hợp nhất khách trùng'
                    : 'Cần quyền crm_am.manage'
                }
                onClick={() => openDrawer('merge')}
              >
                Merge
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {data.override ? (
        <p className="am-banner">
          Health override: {data.override.band} đến {data.override.until}. {data.override.reason}
        </p>
      ) : null}
      {data.recovery_required ? (
        <p className="am-banner" role="alert">
          {amRecoveryRequiredCopy()}
        </p>
      ) : null}

      {canManage ? (
        <form
          className="am-scorecard__override"
          onSubmit={(ev) => {
            ev.preventDefault();
            void (async () => {
              if (busy) return;
              const reason = overrideReason.trim();
              if (!reason) {
                setOverrideError('reason_required');
                return;
              }
              if (!overrideUntil || !overrideBand) {
                setOverrideError('override_until_invalid');
                return;
              }
              setBusy(true);
              setOverrideError('');
              try {
                await overrideAmHealth(token, agencyClientId, {
                  band: overrideBand,
                  reason,
                  until: overrideUntil,
                });
                push('Đã ghi health override', 'success');
                await load();
              } catch (err) {
                setOverrideError(err instanceof ApiError ? err.message : 'Không ghi được override.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <span className="am-muted">Override health</span>
          <select
            value={overrideBand ?? 'watch'}
            onChange={(ev) => setOverrideBand(ev.target.value as AmAccount360Data['band'])}
          >
            <option value="healthy">healthy</option>
            <option value="watch">watch</option>
            <option value="at_risk">at_risk</option>
            <option value="critical">critical</option>
          </select>
          <input
            placeholder="Lý do"
            value={overrideReason}
            onChange={(ev) => setOverrideReason(ev.target.value)}
          />
          <input
            type="date"
            value={overrideUntil}
            onChange={(ev) => setOverrideUntil(ev.target.value)}
          />
          <button type="submit" className="am-btn" disabled={busy}>
            Ghi
          </button>
          {overrideError ? <span className="am-banner">{overrideError}</span> : null}
        </form>
      ) : null}

      <div className="am-360__actions">
        <button
          type="button"
          className="am-btn"
          disabled={!canEdit}
          title={canEdit ? 'Log tương tác' : 'Cần quyền crm_am.edit'}
          onClick={() => canEdit && openDrawer('interaction')}
        >
          Log tương tác
        </button>
        <button
          type="button"
          className="am-btn"
          disabled={!canEdit}
          title={canEdit ? 'Tạo việc' : 'Cần quyền crm_am.edit'}
          onClick={() => canEdit && openDrawer('task')}
        >
          Tạo việc
        </button>
        <button
          type="button"
          className="am-btn"
          disabled={!canEdit}
          title={canEdit ? 'Tạo rủi ro' : 'Cần quyền crm_am.edit'}
          onClick={() => canEdit && openDrawer('risk')}
        >
          Tạo rủi ro
        </button>
        <button
          type="button"
          className="am-btn"
          disabled={!canEdit}
          title={canEdit ? 'Bắt đầu gia hạn' : 'Cần quyền crm_am.edit'}
          onClick={() => canEdit && openDrawer('renewal')}
        >
          Bắt đầu gia hạn
        </button>
        <button
          type="button"
          className="am-btn"
          disabled={!canEdit}
          title={canEdit ? 'Tạo cơ hội' : 'Cần quyền crm_am.edit'}
          onClick={() => canEdit && openDrawer('opportunity')}
        >
          Tạo cơ hội
        </button>
      </div>

      <nav className="am-360__tabs" aria-label="Account 360">
        {AM_360_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === tab ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <OverviewPanel data={data} primary={primary} />
      ) : tab === 'timeline' ? (
        <AmTimeline agencyClientId={agencyClientId} />
      ) : tab === 'finance' ? (
        <FinancePanel data={data} agencyClientId={agencyClientId} />
      ) : tab === 'opportunities' ? (
        <AmGrowth key={growthRefreshNonce} agencyClientId={agencyClientId} embedded />
      ) : tab === 'audit' ? (
        <AuditPanel data={data} />
      ) : (
        <div className="am-360__panel">
          <h2>{activeTab.label}</h2>
          <AmPlaceholder title={activeTab.label} wave={activeTab.wave} />
          <p className="am-muted">{am360WaveCopy(activeTab)}</p>
        </div>
      )}

      {drawer === 'contact' ? (
        <AmContactDrawer
          contacts={data.contacts}
          canEdit={canEdit}
          busy={busy}
          error={formError}
          onClose={() => setDrawer(null)}
          onSave={(contact) => onPatch({ contacts: [contact] })}
        />
      ) : null}
      {drawer === 'risk' ? (
        <AmRiskForm
          agencyClientId={agencyClientId}
          canEdit={canEdit}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            void load();
          }}
        />
      ) : null}
      {drawer === 'opportunity' ? (
        <AmOpportunityForm
          agencyClientId={agencyClientId}
          canEdit={canEdit}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            setGrowthRefreshNonce(amGrowthNextRefreshNonce);
            void load();
          }}
        />
      ) : null}

      {drawer && drawer !== 'contact' && drawer !== 'risk' && drawer !== 'opportunity' ? (
        <div
          className="am-drawer-bg"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !busy) setDrawer(null);
          }}
        >
          <div className="am-drawer" role="dialog" aria-modal="true">
            <div className="am-drawer__head">
              <strong>
                {drawer === 'owner'
                  ? 'Đổi owner'
                  : drawer === 'lifecycle'
                    ? 'Lifecycle'
                    : drawer === 'merge'
                      ? 'Hợp nhất'
                      : drawer === 'task'
                        ? 'Tạo việc'
                        : drawer === 'interaction'
                          ? 'Log tương tác'
                          : 'Bắt đầu gia hạn'}
              </strong>
              <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                Đóng
              </button>
            </div>
            {drawer === 'interaction' ? (
              <AmTimeline
                agencyClientId={agencyClientId}
                composerOnly
                onSaved={() => {
                  setDrawer(null);
                  void load();
                }}
              />
            ) : null}
            {drawer === 'owner' ? (
              <form className="am-form" onSubmit={(ev) => void onTransfer(ev)}>
                <label className="am-field">
                  <span>Owner mới (crm_staff ID) *</span>
                  {roster.length > 0 ? (
                    <select name="to_staff_id" defaultValue="" required>
                      <option value="" disabled>
                        Chọn owner
                      </option>
                      {roster.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.display_name || row.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input name="to_staff_id" inputMode="numeric" placeholder="crm_staff ID" required />
                  )}
                </label>
                <label className="am-check">
                  <input type="checkbox" name="keep_secondary" defaultChecked />
                  Giữ owner cũ là secondary
                </label>
                <label className="am-check">
                  <input type="checkbox" name="move_open_tasks" value="1" />
                  Chuyển task đang mở
                </label>
                <label className="am-field">
                  <span>Lý do *</span>
                  <textarea name="reason" required rows={3} />
                </label>
                {formError ? <p className="am-banner">{formError}</p> : null}
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                    Xác nhận
                  </button>
                </div>
              </form>
            ) : null}
            {drawer === 'lifecycle' ? (
              <form
                className="am-form"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const form = new FormData(ev.currentTarget);
                  void onPatch({ am_status: String(form.get('am_status') ?? '') });
                }}
              >
                <label className="am-field">
                  <span>Lifecycle</span>
                  <select name="am_status" defaultValue={data.am_status}>
                    {Object.entries(AM_360_STATUS_COPY).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {formError ? <p className="am-banner">{formError}</p> : null}
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                    Lưu
                  </button>
                </div>
              </form>
            ) : null}
            {drawer === 'merge' ? (
              <form className="am-form" onSubmit={(ev) => void onMerge(ev)}>
                <label className="am-field">
                  <span>Gộp vào agency_client_id *</span>
                  <input name="into_agency_client_id" required placeholder="uuid khách đích" />
                </label>
                {formError ? (
                  <p className="am-banner" title={formError}>
                    {formError}
                  </p>
                ) : null}
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                    Hợp nhất
                  </button>
                </div>
              </form>
            ) : null}
            {drawer === 'task' ? (
              <form className="am-form" onSubmit={(ev) => void onCreateTask(ev)}>
                <label className="am-field">
                  <span>Tiêu đề *</span>
                  <input name="title" required maxLength={200} />
                </label>
                {formError ? <p className="am-banner">{formError}</p> : null}
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                    Tạo việc
                  </button>
                </div>
              </form>
            ) : null}
            {drawer === 'renewal' ? (
              <form className="am-form" onSubmit={(ev) => void onStartRenewal(ev)}>
                <label className="am-field">
                  <span>Period *</span>
                  <input name="period_key" required placeholder="2026-Q3" />
                </label>
                <label className="am-field">
                  <span>Hợp đồng</span>
                  {activeContracts.length ? (
                    <select name="contract_id" defaultValue={String(activeContracts[0].id)}>
                      {activeContracts.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.reference_code || row.title || row.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input name="contract_id" type="number" min={1} placeholder="contract_id" />
                  )}
                </label>
                {formError ? <p className="am-banner">{formError}</p> : null}
                <div className="am-form__actions">
                  <button type="button" className="am-btn" onClick={() => setDrawer(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                    Bắt đầu
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OverviewPanel({
  data,
  primary,
}: {
  data: AmAccount360Data;
  primary: AmAccountContact | null;
}) {
  const care = data.plans.find((row) => row.kind === 'care') ?? data.plans[0] ?? null;
  return (
    <div className="am-360__grid">
      <div>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Tổng quan khách hàng</h2>
          </div>
          <p>Ngành: {dashText(data.industry)}</p>
          <p>Ghi chú: {dashText(data.notes)}</p>
          <p>Account Owner: {dashText(data.owner_label)}</p>
          {data.delivery_label ? <p>Delivery: {data.delivery_label}</p> : null}
          {data.parent_name ? <p>Parent: {data.parent_name}</p> : null}
        </section>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>KPI & Success Plan</h2>
          </div>
          {care ? (
            <p>
              {care.kind} · {care.period_key} · {care.status}
              {care.due_on ? ` · hạn ${care.due_on}` : ''}
            </p>
          ) : (
            <p className="am-muted">Chưa có success plan.</p>
          )}
        </section>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Dịch vụ đang hoạt động</h2>
          </div>
          {data.contracts.length === 0 ? (
            <p className="am-muted">Chưa có hợp đồng.</p>
          ) : (
            <ul className="am-work">
              {data.contracts.map((row) => (
                <li key={row.id} className="am-work__row">
                  <span>
                    {row.title || row.reference_code || row.id} · {row.status}
                  </span>
                  <Link className="am-link" href={`/crm/account-management/contracts/${row.id}`}>
                    Xem hợp đồng
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {data.children.length > 0 ? (
          <section className="am-widget">
            <div className="am-widget__head">
              <h2>Công ty con</h2>
            </div>
            <ul className="am-work">
              {data.children.map((child) => (
                <li key={child.agency_client_id} className="am-work__row">
                  <Link
                    className="am-link"
                    href={`/crm/account-management/clients/${child.agency_client_id}`}
                  >
                    {child.name}
                  </Link>
                  <span className="am-muted">
                    {child.code} · {AM_360_STATUS_COPY[child.am_status] ?? child.am_status} ·{' '}
                    {dashText(child.owner_label)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Hành động cần làm ({data.open_tasks.length})</h2>
            <Link className="am-link" href="/crm/account-management/work">
              Xem tất cả →
            </Link>
          </div>
          {data.open_tasks.length === 0 ? (
            <p className="am-muted">Không có việc mở.</p>
          ) : (
            <ul className="am-work">
              {data.open_tasks.map((row) => (
                <li key={row.id} className="am-work__row">
                  <Link className="am-link" href={`/crm/account-management/work/${row.id}`}>
                    {row.title}
                  </Link>
                  <span className="am-muted">{row.sla_label || row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Contact chính</h2>
          </div>
          {primary ? (
            <>
              <p>
                <strong>{primary.full_name}</strong>
                {primary.role_committee ? ` — ${primary.role_committee}` : ''}
              </p>
              <p className="am-muted">
                {dashText(primary.phone)} · {dashText(primary.email)}
              </p>
              <p className="am-muted">Sentiment: {dashText(primary.sentiment)}</p>
            </>
          ) : (
            <p className="am-muted">Chưa có contact.</p>
          )}
        </section>
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Tóm tắt tài chính</h2>
          </div>
          <p>MRR: {data.hide_amounts ? '—' : vnd(data.mrr_vnd)}</p>
          <p>Công nợ: {data.hide_amounts ? '—' : vnd(data.outstanding_vnd)}</p>
          <p>Hóa đơn tiếp theo: {dashText(data.next_invoice_on)}</p>
        </section>
      </div>
    </div>
  );
}

function FinancePanel({ data, agencyClientId }: { data: AmAccount360Data; agencyClientId: string }) {
  return (
    <>
      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Hợp đồng & Tài chính</h2>
        </div>
        <div className="am-tbl-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Trạng thái</th>
                <th>Loại</th>
                <th>Hiệu lực</th>
                <th>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {data.contracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="am-muted">
                    Chưa có hợp đồng.
                  </td>
                </tr>
              ) : (
                data.contracts.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="am-link" href={`/crm/account-management/contracts/${row.id}`}>
                        {row.reference_code || row.title || row.id}
                      </Link>
                      <div className="am-muted">{row.title}</div>
                    </td>
                    <td>{row.status}</td>
                    <td>{row.billing_type || row.service_slug || '—'}</td>
                    <td>
                      {dashText(row.starts_on)} — {dashText(row.ends_on)}
                    </td>
                    <td>{data.hide_amounts ? '—' : vnd(row.amount_vnd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <AmFinance agencyClientId={agencyClientId} />
    </>
  );
}

function AuditPanel({ data }: { data: AmAccount360Data }) {
  return (
    <section className="am-widget">
      <div className="am-widget__head">
        <h2>Audit</h2>
      </div>
      <div className="am-tbl-wrap">
        <table className="am-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Hành động</th>
              <th>Thực thể</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {data.audit.length === 0 ? (
              <tr>
                <td colSpan={4} className="am-muted">
                  Chưa có audit.
                </td>
              </tr>
            ) : (
              data.audit.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at ? row.created_at.slice(0, 19).replace('T', ' ') : '—'}</td>
                  <td>{row.action}</td>
                  <td>{row.entity_type}</td>
                  <td>{dashText(row.actor_staff_id)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

