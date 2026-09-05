'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IndustrySelect } from '@/components/agency/IndustrySelect';
import { OwnerAmSelect } from '@/components/agency/OwnerAmSelect';
import { fetchStaffRoster, type StaffRosterRow } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  createAmAccount,
  fetchAmAccount,
  patchAmAccount,
  type AmAccount360,
  type AmContactInput,
} from '@/lib/crm/am-api';
import {
  amAccountEditHref,
  amAccountFormCtas,
  amAccountSaveId,
  amConfirmLeave,
  amDraftStatus,
  amGuardDirtyClick,
  amOnboardingHref,
  amOwnerStaffPatch,
  amPrimaryContactError,
  emptyAmFormContact,
  suggestAmAccountCode,
  type AmFormContact,
} from '@/lib/crm/am-account-form.util';
import { canAssignAmAccounts } from '@/lib/crm/am-accounts-views.util';
import {
  AM_COMMITTEE_ROLES,
  AM_CONTACT_CHANNELS,
  AM_RENEWAL_ATTITUDES,
  AM_SENTIMENTS,
} from '@/lib/crm/am-contact-drawer.util';
import { canEditAmAccountName } from '@/lib/crm/am-account-360.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

type SaveKind = 'draft' | 'onboarding' | 'save';

const LIFECYCLES = [
  { value: 'pending_handover', label: 'Pending Handover' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'renewing', label: 'Renewing' },
  { value: 'paused', label: 'Paused' },
];

function snapshot(input: Record<string, unknown>): string {
  return JSON.stringify(input);
}

export function AmAccountForm({ agencyClientId }: { agencyClientId?: string }) {
  const { token, user, canEdit } = useAmPage();
  const { push } = useToast();
  const router = useRouter();
  const [createdId, setCreatedId] = useState('');
  const accountId = amAccountSaveId(agencyClientId, createdId);
  const isEdit = Boolean(accountId);
  const canName = canEditAmAccountName(user);
  const canAssign = canAssignAmAccounts(user);
  const agencyWrite = hasCap(user, 'crm_agency', 'create') || hasCap(user, 'crm_agency', 'write');

  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState<StaffRosterRow[]>([]);

  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [accountType, setAccountType] = useState('enterprise');
  const [industry, setIndustry] = useState('');
  const [tier, setTier] = useState('');
  const [source, setSource] = useState('sales_crm');
  const [website, setWebsite] = useState('');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [ownerAmId, setOwnerAmId] = useState(user.email ?? '');
  const [ownerStaffId, setOwnerStaffId] = useState('');
  const [loadedOwnerStaffId, setLoadedOwnerStaffId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [lifecycle, setLifecycle] = useState('active');
  const [packageName, setPackageName] = useState('');
  const [preferChannel, setPreferChannel] = useState('zalo');
  const [contacts, setContacts] = useState<AmFormContact[]>([emptyAmFormContact(true)]);
  const [tagDraft, setTagDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [bdsProject, setBdsProject] = useState('');
  const [bdsProduct, setBdsProduct] = useState('');
  const [bdsRegion, setBdsRegion] = useState('');
  const [bdsLeads, setBdsLeads] = useState('');
  const [baseline, setBaseline] = useState('');

  const formSnap = useMemo(
    () =>
      snapshot({
        legalName,
        displayName,
        code,
        accountType,
        industry,
        tier,
        source,
        website,
        timezone,
        ownerAmId,
        ownerStaffId,
        teamId,
        lifecycle,
        packageName,
        preferChannel,
        contacts,
        tags,
        bdsProject,
        bdsProduct,
        bdsRegion,
        bdsLeads,
      }),
    [
      legalName,
      displayName,
      code,
      accountType,
      industry,
      tier,
      source,
      website,
      timezone,
      ownerAmId,
      ownerStaffId,
      teamId,
      lifecycle,
      packageName,
      preferChannel,
      contacts,
      tags,
      bdsProject,
      bdsProduct,
      bdsRegion,
      bdsLeads,
    ],
  );
  const dirty = Boolean(baseline) && formSnap !== baseline;
  const showBds = /bds|bat-dong-san|real-estate|bất động sản/i.test(industry);
  const ctas = amAccountFormCtas();

  useEffect(() => {
    if (!token) return;
    void fetchStaffRoster(token)
      .then((out) => setRoster(out.staff ?? []))
      .catch(() => setRoster([]));
  }, [token]);

  useEffect(() => {
    if (!agencyClientId || !token) {
      if (createdId) return;
      setBaseline(
        snapshot({
          legalName: '',
          displayName: '',
          code: '',
          accountType: 'enterprise',
          industry: '',
          tier: '',
          source: 'sales_crm',
          website: '',
          timezone: 'Asia/Ho_Chi_Minh',
          ownerAmId: user.email ?? '',
          ownerStaffId: '',
          teamId: '',
          lifecycle: 'active',
          packageName: '',
          preferChannel: 'zalo',
          contacts: [emptyAmFormContact(true)],
          tags: [],
          bdsProject: '',
          bdsProduct: '',
          bdsRegion: '',
          bdsLeads: '',
        }),
      );
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAmAccount(token, agencyClientId)
      .then((row) => {
        if (cancelled) return;
        applyLoaded(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được khách');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyClientId, createdId, token, user.email]);

  useEffect(() => {
    function onBeforeUnload(ev: BeforeUnloadEvent) {
      if (!dirty) return;
      ev.preventDefault();
      ev.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function applyLoaded(row: AmAccount360) {
    const nextContacts =
      row.contacts.length > 0
        ? row.contacts.map((item) => ({
            id: item.id,
            full_name: item.full_name,
            title: '',
            role_committee: item.role_committee ?? 'decision_maker',
            is_primary: item.is_primary,
            sentiment: item.sentiment ?? 'neutral',
            channel: item.channel ?? 'zalo',
            renewal_attitude: item.renewal_attitude ?? 'neutral',
            email: item.email ?? '',
            phone: item.phone ?? '',
          }))
        : [emptyAmFormContact(true)];
    setLegalName(row.name);
    setDisplayName(row.name);
    setCode(row.code);
    setIndustry(row.industry ?? '');
    setTier(row.tier ?? '');
    setOwnerStaffId(row.owner_staff_id ? String(row.owner_staff_id) : '');
    setLoadedOwnerStaffId(row.owner_staff_id ? String(row.owner_staff_id) : '');
    setTeamId(row.team_id ? String(row.team_id) : '');
    setLifecycle(row.am_status || amDraftStatus());
    setContacts(nextContacts);
    const next = {
      legalName: row.name,
      displayName: row.name,
      code: row.code,
      accountType: 'enterprise',
      industry: row.industry ?? '',
      tier: row.tier ?? '',
      source: 'sales_crm',
      website: '',
      timezone: 'Asia/Ho_Chi_Minh',
      ownerAmId: user.email ?? '',
      ownerStaffId: row.owner_staff_id ? String(row.owner_staff_id) : '',
      teamId: row.team_id ? String(row.team_id) : '',
      lifecycle: row.am_status || amDraftStatus(),
      packageName: '',
      preferChannel: 'zalo',
      contacts: nextContacts,
      tags: [],
      bdsProject: '',
      bdsProduct: '',
      bdsRegion: '',
      bdsLeads: '',
    };
    setBaseline(snapshot(next));
  }

  function leave(href: string) {
    if (!amConfirmLeave(dirty)) return;
    router.push(href);
  }

  function setContact(index: number, patch: Partial<AmFormContact>) {
    setContacts((prev) =>
      prev.map((row, i) => {
        if (i !== index) {
          return patch.is_primary ? { ...row, is_primary: false } : row;
        }
        return { ...row, ...patch };
      }),
    );
  }

  function addTag() {
    const value = tagDraft.trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
    setTagDraft('');
  }

  function toContactPayload(): AmContactInput[] {
    return contacts
      .filter((row) => row.full_name.trim())
      .map((row) => ({
        id: row.id,
        full_name: row.full_name.trim(),
        role_committee: row.role_committee || null,
        is_primary: Boolean(row.is_primary),
        sentiment: row.sentiment || null,
        channel: row.channel || null,
        renewal_attitude: row.renewal_attitude || null,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
      }));
  }

  async function onSave(kind: SaveKind) {
    if (busy || !canEdit) return;
    const name = (displayName || legalName).trim();
    if (!name || !industry) {
      setError('Cần tên hiển thị, loại account, ngành và owner');
      return;
    }
    const status =
      kind === 'draft' ? amDraftStatus() : kind === 'onboarding' ? 'onboarding' : lifecycle || 'active';
    const payloadContacts = toContactPayload();
    const gate = amPrimaryContactError(status, payloadContacts);
    if (gate) {
      setError('Active cần tối thiểu một contact chính');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let id = accountId;
      if (!id) {
        if (!agencyWrite) {
          setError('Cần quyền crm_agency.create — mở Agency để tạo khách');
          return;
        }
        const created = await createAmAccount(token, {
          mode: 'create',
          code: (code.trim() || suggestAmAccountCode(name)).toUpperCase(),
          name,
          industry_slug: industry || undefined,
          owner_am_id: ownerAmId.trim() || user.email || undefined,
        });
        id = created.agency_client_id;
        setCreatedId(id);
        router.replace(amAccountEditHref(id));
      }
      const ownerPatch = amOwnerStaffPatch(ownerStaffId, loadedOwnerStaffId, canAssign);
      if ('error' in ownerPatch) {
        setError('Cần quyền crm_am.assign để đổi owner');
        return;
      }
      const next = await patchAmAccount(token, id, {
        name: canName ? name : undefined,
        tier: tier.trim() || null,
        team_id: teamId.trim() ? Number(teamId) : null,
        am_status: status,
        industry: industry.trim() || null,
        tags,
        contacts: payloadContacts,
        ...ownerPatch,
      });
      setBaseline(formSnap);
      push(kind === 'draft' ? 'Đã lưu nháp' : 'Đã lưu', 'success');
      if (kind === 'onboarding') {
        router.push(amOnboardingHref(id));
        return;
      }
      router.push(`/crm/account-management/clients/${next.agency_client_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không lưu được';
      setError(message === 'primary_contact_required' ? 'Active cần tối thiểu một contact chính' : message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải form…</p>
      </section>
    );
  }

  if (!canEdit) {
    return (
      <section className="am-page">
        <p className="am-banner">Cần quyền crm_am.edit.</p>
      </section>
    );
  }

  const cancelHref = accountId
    ? `/crm/account-management/clients/${accountId}`
    : '/crm/account-management/clients';

  return (
    <section className="am-page am-form-page">
      <div className="am-form-page__head">
        <div>
          <p className="am-crumb">
            <Link
              href="/crm/account-management/clients"
              onClick={(ev) => {
                if (!amGuardDirtyClick(ev, dirty)) ev.preventDefault();
              }}
            >
              Khách hàng
            </Link>{' '}
            / {isEdit ? 'Sửa' : 'Tạo mới'}
          </p>
          <h1>{isEdit ? 'Sửa khách hàng' : 'Tạo khách hàng mới'}</h1>
        </div>
        <button type="button" className="am-btn" disabled={busy} onClick={() => void onSave('draft')}>
          {ctas[1]}
        </button>
      </div>

      {!isEdit && !agencyWrite ? (
        <p className="am-banner">
          Cần quyền crm_agency.create.{' '}
          <Link
            href="/agency/clients/new"
            onClick={(ev) => {
              if (!amGuardDirtyClick(ev, dirty)) ev.preventDefault();
            }}
          >
            Mở /agency/clients/new
          </Link>
        </p>
      ) : null}

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Thông tin định danh</h2>
          <span className="am-muted">(*) Bắt buộc</span>
        </div>
        <div className="am-form">
          <div className="am-split">
            <label className="am-field">
              <span>Tên pháp lý *</span>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
            </label>
            <label className="am-field">
              <span>Tên hiển thị *</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={isEdit && !canName}
                title={canName ? 'Tên hiển thị' : 'Cần quyền crm_agency.write'}
              />
            </label>
          </div>
          <div className="am-split">
            <label className="am-field">
              <span>Mã khách hàng</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Tự sinh sau khi lưu"
                disabled={isEdit}
              />
            </label>
            <label className="am-field">
              <span>Loại khách hàng *</span>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="enterprise">Doanh nghiệp</option>
                <option value="individual">Cá nhân</option>
              </select>
            </label>
          </div>
          <div className="am-split">
            <label className="am-field">
              <span>Ngành *</span>
              <IndustrySelect token={token} value={industry} onChange={setIndustry} required />
            </label>
            <label className="am-field">
              <span>Phân khúc</span>
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">—</option>
                <option value="A">Tier A</option>
                <option value="B">Tier B</option>
                <option value="C">Tier C</option>
              </select>
            </label>
          </div>
          <div className="am-split">
            <label className="am-field">
              <span>Nguồn</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <label className="am-field">
              <span>Website</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </label>
          </div>
          <label className="am-field">
            <span>Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Sở hữu và vận hành</h2>
        </div>
        <div className="am-form">
          <div className="am-split">
            <label className="am-field">
              <span>Account Owner *</span>
              {isEdit ? (
                roster.length > 0 ? (
                  <select
                    value={ownerStaffId}
                    onChange={(e) => setOwnerStaffId(e.target.value)}
                    disabled={!canAssign}
                    title={canAssign ? 'Account Owner' : 'Cần quyền crm_am.assign để đổi owner'}
                  >
                    <option value="">Chọn owner</option>
                    {roster.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.display_name || row.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={ownerStaffId}
                    onChange={(e) => setOwnerStaffId(e.target.value)}
                    placeholder="crm_staff ID"
                    disabled={!canAssign}
                    title={canAssign ? 'Account Owner' : 'Cần quyền crm_am.assign để đổi owner'}
                  />
                )
              ) : (
                <OwnerAmSelect token={token} value={ownerAmId} onChange={setOwnerAmId} />
              )}
            </label>
            <label className="am-field">
              <span>Team</span>
              <input value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team_id" />
            </label>
          </div>
          <div className="am-split">
            <label className="am-field">
              <span>Lifecycle</span>
              <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}>
                {LIFECYCLES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>Kênh ưu tiên</span>
              <select value={preferChannel} onChange={(e) => setPreferChannel(e.target.value)}>
                {AM_CONTACT_CHANNELS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="am-field">
            <span>Gói dịch vụ dự kiến</span>
            <input value={packageName} onChange={(e) => setPackageName(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Người liên hệ</h2>
          <button
            type="button"
            className="am-btn"
            onClick={() => setContacts((prev) => [...prev, emptyAmFormContact(prev.length === 0)])}
          >
            + Thêm contact
          </button>
        </div>
        {contacts.map((row, index) => (
          <div key={`${row.id ?? 'new'}-${index}`} className="am-form am-contact-card">
            <div className="am-split">
              <label className="am-field">
                <span>Họ tên *</span>
                <input
                  value={row.full_name}
                  onChange={(e) => setContact(index, { full_name: e.target.value })}
                />
              </label>
              <label className="am-field">
                <span>Chức danh</span>
                <input value={row.title ?? ''} onChange={(e) => setContact(index, { title: e.target.value })} />
              </label>
            </div>
            <div className="am-split">
              <label className="am-field">
                <span>SĐT</span>
                <input value={row.phone ?? ''} onChange={(e) => setContact(index, { phone: e.target.value })} />
              </label>
              <label className="am-field">
                <span>Email</span>
                <input value={row.email ?? ''} onChange={(e) => setContact(index, { email: e.target.value })} />
              </label>
            </div>
            <div className="am-split">
              <label className="am-field">
                <span>Vai trò buying committee</span>
                <select
                  value={row.role_committee ?? ''}
                  onChange={(e) => setContact(index, { role_committee: e.target.value })}
                >
                  {AM_COMMITTEE_ROLES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>Sentiment</span>
                <select
                  value={row.sentiment ?? ''}
                  onChange={(e) => setContact(index, { sentiment: e.target.value })}
                >
                  {AM_SENTIMENTS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="am-split">
              <label className="am-field">
                <span>Kênh</span>
                <select
                  value={row.channel ?? 'zalo'}
                  onChange={(e) => setContact(index, { channel: e.target.value })}
                >
                  {AM_CONTACT_CHANNELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>Thái độ renewal</span>
                <select
                  value={row.renewal_attitude ?? ''}
                  onChange={(e) => setContact(index, { renewal_attitude: e.target.value })}
                >
                  {AM_RENEWAL_ATTITUDES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="am-field am-field--check">
              <span>
                <input
                  type="checkbox"
                  checked={row.is_primary}
                  onChange={(e) => setContact(index, { is_primary: e.target.checked })}
                />{' '}
                Đặt làm contact chính
              </span>
            </label>
          </div>
        ))}
      </section>

      {showBds ? (
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Trường riêng: Bất động sản</h2>
          </div>
          <div className="am-form">
            <div className="am-split">
              <label className="am-field">
                <span>Dự án chính</span>
                <input value={bdsProject} onChange={(e) => setBdsProject(e.target.value)} />
              </label>
              <label className="am-field">
                <span>Loại sản phẩm</span>
                <input value={bdsProduct} onChange={(e) => setBdsProduct(e.target.value)} />
              </label>
            </div>
            <div className="am-split">
              <label className="am-field">
                <span>Khu vực bán hàng</span>
                <input value={bdsRegion} onChange={(e) => setBdsRegion(e.target.value)} />
              </label>
              <label className="am-field">
                <span>Mục tiêu lead/tháng</span>
                <input value={bdsLeads} onChange={(e) => setBdsLeads(e.target.value)} inputMode="numeric" />
              </label>
            </div>
          </div>
        </section>
      ) : null}

      <section className="am-widget">
        <div className="am-widget__head">
          <h2>Tags</h2>
        </div>
        <div className="am-tags">
          {tags.map((tag) => (
            <button key={tag} type="button" className="am-tag" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
              {tag} ×
            </button>
          ))}
        </div>
        <div className="am-split">
          <label className="am-field">
            <span>+ Thêm tag</span>
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
          </label>
          <div className="am-form__actions">
            <button type="button" className="am-btn" onClick={addTag}>
              Thêm
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="am-banner">{error}</p> : null}

      <div className="am-form__actions">
        <button type="button" className="am-btn" onClick={() => leave(cancelHref)}>
          {ctas[0]}
        </button>
        <button type="button" className="am-btn" disabled={busy} onClick={() => void onSave('draft')}>
          {ctas[1]}
        </button>
        <button type="button" className="am-btn" disabled={busy} onClick={() => void onSave('onboarding')}>
          {ctas[2]}
        </button>
        <button type="button" className="am-btn am-btn--primary" disabled={busy} onClick={() => void onSave('save')}>
          {ctas[3]}
        </button>
      </div>
    </section>
  );
}
