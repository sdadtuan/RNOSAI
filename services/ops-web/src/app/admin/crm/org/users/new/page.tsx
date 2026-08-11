'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { JobFunctionPicker } from '@/components/rbac/JobFunctionPicker';
import { WinWizardSteps } from '@/components/win';
import {
  createStaffOrgUser,
  fetchStaffOrgJobFunctionCatalog,
  fetchStaffOrgPositions,
  fetchStaffOrgTeams,
  type StaffOrgPositionRow,
  type StaffTeamRow,
} from '@/lib/api';
import {
  canEditOrgUsers,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

type StepId = 'profile' | 'access' | 'account' | 'uat';

const UAT_ITEMS = [
  'NV đăng nhập được bằng email + mật khẩu tạm',
  'Menu sidebar khớp chức vụ / job function',
  'Không thấy mục CRM bị cấm (SoD)',
  'Hồ sơ crm_staff hiển thị đúng tên',
  'HR xác nhận NV hiểu quy trình lead cơ bản',
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function AdminOrgUserOnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const canEdit = canEditOrgUsers(user);

  const [crmStaffId, setCrmStaffId] = useState<number | undefined>(undefined);
  const [step, setStep] = useState<StepId>('profile');
  const [startedAt] = useState(() => Date.now());
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [catalog, setCatalog] = useState<Array<{ code: string; label: string }>>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const [positionId, setPositionId] = useState<number | ''>('');
  const [functions, setFunctions] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [uatChecks, setUatChecks] = useState<boolean[]>(() => UAT_ITEMS.map(() => false));

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [tempPasswordShown, setTempPasswordShown] = useState('');

  useEffect(() => {
    if (!token) return;
    void Promise.all([
      fetchStaffOrgPositions(token),
      fetchStaffOrgTeams(token),
      fetchStaffOrgJobFunctionCatalog(token),
    ]).then(([pos, tms, fnCat]) => {
      setPositions(pos);
      setTeams(tms);
      setCatalog(fnCat.map((f) => ({ code: f.code, label: f.label })));
      if (pos[0] && positionId === '') setPositionId(pos[0].id);
    });
  }, [token, positionId]);

  useEffect(() => {
    const email = searchParams.get('email')?.trim();
    const nameParam = searchParams.get('name')?.trim();
    const phoneParam = searchParams.get('phone')?.trim();
    const jobTitleParam = searchParams.get('job_title')?.trim();
    const internalCodeParam = searchParams.get('internal_code')?.trim();
    const staffIdRaw = searchParams.get('crm_staff_id')?.trim();

    if (email) setEmail(email);
    if (nameParam) {
      setName(nameParam);
      setDisplayName(nameParam);
    }
    if (phoneParam) setPhone(phoneParam);
    if (jobTitleParam) setJobTitle(jobTitleParam);
    if (internalCodeParam) setInternalCode(internalCodeParam);
    if (staffIdRaw && /^\d+$/.test(staffIdRaw)) setCrmStaffId(Number(staffIdRaw));
  }, [searchParams]);

  const steps = useMemo(
    () =>
      (
        [
          { id: 'profile', label: 'Hồ sơ' },
          { id: 'access', label: 'Quyền' },
          { id: 'account', label: 'Tài khoản' },
          { id: 'uat', label: 'UAT' },
        ] as const
      ).map((s) => ({
        ...s,
        status:
          s.id === step
            ? ('current' as const)
            : ['profile', 'access', 'account', 'uat'].indexOf(s.id) <
                ['profile', 'access', 'account', 'uat'].indexOf(step)
              ? ('done' as const)
              : ('pending' as const),
      })),
    [step],
  );

  const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);

  function nextStep() {
    if (step === 'profile') {
      if (!name.trim()) {
        setFormError('Nhập tên NV');
        return;
      }
      setDisplayName(name.trim());
      setStep('access');
    } else if (step === 'access') {
      if (!positionId) {
        setFormError('Chọn chức vụ');
        return;
      }
      setStep('account');
    } else if (step === 'account') {
      if (!email.trim() || !email.includes('@')) {
        setFormError('Email không hợp lệ');
        return;
      }
      setStep('uat');
    }
    setFormError('');
  }

  function prevStep() {
    setFormError('');
    if (step === 'access') setStep('profile');
    else if (step === 'account') setStep('access');
    else if (step === 'uat') setStep('account');
  }

  function toggleTeam(id: number) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function finish() {
    if (!token || !canEdit) return;
    if (uatChecks.some((c) => !c)) {
      setFormError('Tick đủ checklist UAT trước khi hoàn tất');
      return;
    }
    if (!positionId) return;

    setBusy(true);
    setFormError('');
    try {
      const out = await createStaffOrgUser(token, {
        email: email.trim(),
        display_name: displayName.trim() || name.trim(),
        position_id: Number(positionId),
        team_ids: teamIds,
        functions,
        password,
        ...(crmStaffId != null ? { crm_staff_id: crmStaffId } : {}),
        crm_staff: {
          name: name.trim(),
          phone: phone.trim(),
          internal_code: internalCode.trim(),
          job_title: jobTitle.trim(),
        },
      });
      setTempPasswordShown(out.temp_password ?? password);
      router.push(`/admin/crm/org/users?created=${encodeURIComponent(out.user.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo user thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !loading) {
    return (
      <AdminPageShell user={user} onLogout={logout} section="crm-config" title="Onboard NV" loading={loading}>
        <p className="form-error">Cần quyền crm_staff_roster.edit</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Onboard nhân viên"
      subtitle={`Wizard WIN-2 · mục tiêu ≤15 ph · đã ${elapsedMin} phút`}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Người dùng', href: '/admin/crm/org/users' },
        { label: 'Onboard' },
      ]}
      loading={loading}
      actions={
        <Link href="/admin/crm/org/users" className="btn btn-ghost btn-sm">
          ← Danh sách
        </Link>
      }
    >
      <AdminOrgSubNav />
      {crmStaffId != null ? (
        <p className="staff-roster-callout" role="status">
          Đang onboard từ hồ sơ roster (crm_staff #{crmStaffId}).
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {tempPasswordShown ? (
        <p className="muted">
          Mật khẩu tạm: <code>{tempPasswordShown}</code> — copy gửi NV qua kênh bảo mật.
        </p>
      ) : null}

      <WinWizardSteps steps={steps} onStepClick={(id) => setStep(id as StepId)} />

      <div className="win-excel-wizard" style={{ marginTop: '1rem' }}>
        {step === 'profile' ? (
          <div className="stack-gap">
            <label>
              Họ tên *
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              SĐT
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>
              Mã NV
              <input value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
            </label>
            <label>
              Chức danh
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </label>
          </div>
        ) : null}

        {step === 'access' ? (
          <div className="stack-gap">
            <label>
              Chức vụ *
              <select
                value={positionId === '' ? '' : String(positionId)}
                onChange={(e) => setPositionId(Number(e.target.value))}
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <JobFunctionPicker options={catalog} value={functions} onChange={setFunctions} />
            <div>
              <p className="muted">Team</p>
              <div className="win-filter-chips">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${teamIds.includes(t.id) ? ' is-active' : ''}`}
                    onClick={() => toggleTeam(t.id)}
                  >
                    {t.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 'account' ? (
          <div className="stack-gap">
            <label>
              Email đăng nhập *
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </label>
            <label>
              Tên hiển thị
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label>
              Mật khẩu tạm
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={password} readOnly style={{ flex: 1, fontFamily: 'monospace' }} />
                <button type="button" className="btn btn-sm" onClick={() => setPassword(generatePassword())}>
                  Tạo lại
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => void navigator.clipboard.writeText(password)}
                >
                  Copy
                </button>
              </div>
            </label>
          </div>
        ) : null}

        {step === 'uat' ? (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {UAT_ITEMS.map((label, i) => (
              <li key={label} style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={uatChecks[i]}
                    onChange={(e) =>
                      setUatChecks((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                    }
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
          {step !== 'profile' ? (
            <button type="button" className="btn btn-ghost" onClick={prevStep} disabled={busy}>
              Quay lại
            </button>
          ) : null}
          {step !== 'uat' ? (
            <button type="button" className="btn btn-primary" onClick={nextStep} disabled={busy}>
              Tiếp
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void finish()} disabled={busy}>
              Hoàn tất onboard
            </button>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
