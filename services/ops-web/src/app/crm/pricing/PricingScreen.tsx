'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import { clearSession, getAccessToken, getRefreshToken, getStoredUser, updateAccessToken, updateStoredUser, type StoredStaffUser } from '@/lib/auth';
import {
  activateP13Pricing,
  cloneP13Pricing,
  createP13PricingDraft,
  fetchP13PricingMatrix,
  fetchP13PricingVersion,
  fetchP13PricingVersions,
  patchP13Pricing,
  type P13MatrixCell,
  type P13PricingRole,
  type P13PricingSettings,
  type P13PricingVersion,
} from '@/lib/p13/api';
import { canActivateP13Pricing, canEditP13Pricing, canSeeP13Pricing, canViewP13Cost, p13Enabled } from '@/lib/p13/flags';
import '../service-catalog/catalog.css';

const LEVELS = [
  { code: 'basic' as const, name: 'Cơ bản' },
  { code: 'standard' as const, name: 'Tiêu chuẩn' },
  { code: 'advanced' as const, name: 'Nâng cao' },
];

function vnd(value: string | null | undefined): string {
  if (!value) return '—';
  const neg = value.startsWith('-');
  const digits = (neg ? value.slice(1) : value).split('.')[0];
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${grouped}` : grouped;
}

function ratioToPercent(ratio: string | null | undefined): string {
  if (!ratio) return '';
  const [whole, frac = ''] = ratio.split('.');
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, '') || '0';
  const places = frac.length - 2;
  if (places <= 0) return digits + '0'.repeat(-places);
  const cut = digits.length - places;
  const left = cut > 0 ? digits.slice(0, cut) : '0';
  const right = (cut > 0 ? digits.slice(cut) : digits.padStart(places, '0')).replace(/0+$/, '');
  return right ? `${left}.${right}` : left;
}

function percentToRatio(text: string): string | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, '') || '0';
  const padded = digits.padStart(frac.length + 3, '0');
  const cut = padded.length - (frac.length + 2);
  const left = padded.slice(0, cut).replace(/^0+(?=\d)/, '') || '0';
  const right = padded.slice(cut).replace(/0+$/, '');
  return right ? `${left}.${right}` : left;
}

export function PricingScreen() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [versions, setVersions] = useState<P13PricingVersion[]>([]);
  const [versionId, setVersionId] = useState('');
  const [roles, setRoles] = useState<P13PricingRole[]>([]);
  const [settings, setSettings] = useState<P13PricingSettings | null>(null);
  const [matrix, setMatrix] = useState<P13MatrixCell[]>([]);
  const [inversions, setInversions] = useState<string[]>([]);
  const [sameScope, setSameScope] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [activateOpen, setActivateOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [ackNote, setAckNote] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const current = versions.find((row) => row.id === versionId) ?? null;
  const editable = Boolean(current && current.status === 'draft' && canEditP13Pricing(user));
  const showCost = canViewP13Cost(user);

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      updateStoredUser(me);
      return { token: access, me };
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      updateStoredUser(me);
      return { token: access, me };
    }
  }, [router]);

  const loadVersion = useCallback(async (access: string, id: string) => {
    const [detail, grid] = await Promise.all([fetchP13PricingVersion(access, id), fetchP13PricingMatrix(access, id)]);
    setRoles(detail.roles);
    setSettings(detail.settings);
    setMatrix(grid.matrix);
    setInversions(grid.inversions);
    setSameScope(grid.scope_identical);
    setMissing(grid.missing);
  }, []);

  useEffect(() => {
    const cached = getStoredUser();
    if (cached) setUser(cached);
    void (async () => {
      const auth = await ensureAuth();
      if (!auth) return;
      setUser(auth.me);
      setToken(auth.token);
      if (!p13Enabled(auth.me)) {
        setDisabled(true);
        setLoading(false);
        return;
      }
      if (!canSeeP13Pricing(auth.me)) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      try {
        const list = await fetchP13PricingVersions(auth.token);
        setVersions(list.versions);
        const first = list.versions[0];
        if (first) {
          setVersionId(first.id);
          await loadVersion(auth.token, first.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được tham số giá');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadVersion]);

  async function refresh(id = versionId) {
    const list = await fetchP13PricingVersions(token);
    setVersions(list.versions);
    if (id) await loadVersion(token, id);
  }

  async function save() {
    if (!settings || !editable) return;
    setNotice('');
    try {
      await patchP13Pricing(token, versionId, { roles, settings });
      await refresh();
      setNotice('Đã lưu nháp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    }
  }

  function cell(code: string, level: P13MatrixCell['level']) {
    return matrix.find((row) => row.service_code === code && row.level === level);
  }

  const services = [...new Set(matrix.map((row) => row.service_code))];

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      width="wide"
      loading={loading}
      breadcrumb={[{ label: 'Bán hàng', href: '/crm/proposals' }, { label: 'Tham số giá' }]}
    >
      {disabled ? <div className="p13-banner">Danh mục giá đang tắt.</div> : null}
      {forbidden ? <div className="error">Bạn không có quyền xem tham số giá.</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="p13-skel" /> : null}
      {!loading && !disabled && !forbidden ? (
        <div className="p13-main">
          <div className="p13-head">
            <div>
              <strong>{current?.code ?? 'Chưa có version'}</strong>
              {current ? <span className="p13-badge">{current.status}</span> : null}
            </div>
            <div className="p13-filters">
              <button className="btn btn-sm" type="button" disabled={!canEditP13Pricing(user)} onClick={() => void createP13PricingDraft(token).then((row) => refresh(row.id).then(() => setVersionId(row.id)))}>
                Tạo nháp
              </button>
              <button className="btn btn-sm" type="button" disabled={!current || !canEditP13Pricing(user)} onClick={() => void cloneP13Pricing(token, versionId).then((row) => refresh(row.id).then(() => setVersionId(row.id)))}>
                Clone thành nháp
              </button>
              <button className="btn btn-sm" type="button" disabled={!editable} onClick={() => void save()}>
                Lưu nháp
              </button>
              <button className="btn btn-sm" type="button" disabled={!current || current.status !== 'draft' || !canActivateP13Pricing(user)} onClick={() => setActivateOpen(true)}>
                Kích hoạt version…
              </button>
            </div>
          </div>
          {notice ? <div className="p13-banner">{notice}</div> : null}
          {missing.length ? <div className="p13-banner">Thiếu tham số: {missing.join(', ')}</div> : null}
          {!matrix.length ? <div className="p13-banner">Chưa có danh mục — ma trận để trống cho đến khi import seed.</div> : null}
          <div className="p13-grid">
            <div className="p13-card">
              <strong>Chi phí nhân sự</strong>
              <table className="p13-table">
                <thead>
                  <tr>
                    <th>Vai trò</th>
                    {showCost ? <th>Lương/tháng</th> : null}
                    {showCost ? <th>BH %</th> : null}
                    {showCost ? <th>Phúc lợi</th> : null}
                    <th>Giờ</th>
                    {showCost ? <th>Đơn giá/giờ</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.role_code}>
                      <td>{role.name}</td>
                      {showCost ? (
                        <td>
                          <input className="p13-field" disabled={!editable} value={role.monthly_salary ?? ''} onChange={(event) => setRoles(roles.map((row) => (row.role_code === role.role_code ? { ...row, monthly_salary: event.target.value.replace(/[^\d]/g, '') || null } : row)))} />
                        </td>
                      ) : null}
                      {showCost ? (
                        <td>
                          <input className="p13-field" disabled={!editable} value={ratioToPercent(role.insurance_pct)} onChange={(event) => setRoles(roles.map((row) => (row.role_code === role.role_code ? { ...row, insurance_pct: percentToRatio(event.target.value) } : row)))} />
                        </td>
                      ) : null}
                      {showCost ? (
                        <td>
                          <input className="p13-field" disabled={!editable} value={role.monthly_benefits ?? ''} onChange={(event) => setRoles(roles.map((row) => (row.role_code === role.role_code ? { ...row, monthly_benefits: event.target.value.replace(/[^\d]/g, '') || null } : row)))} />
                        </td>
                      ) : null}
                      <td>
                        <input className="p13-field" disabled={!editable} value={role.productive_hours ?? ''} onChange={(event) => setRoles(roles.map((row) => (row.role_code === role.role_code ? { ...row, productive_hours: event.target.value } : row)))} />
                      </td>
                      {showCost ? <td>{vnd(role.rate_display ?? role.hourly_rate)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {settings ? (
              <div className="p13-card">
                <strong>Thông số chung</strong>
                {(
                  [
                    ['overhead_pct', 'Overhead %'],
                    ['margin_pct', 'Margin %'],
                    ['vat_pct', 'VAT %'],
                    ['discount_standard_pct', 'CK Tiêu chuẩn %'],
                    ['discount_advanced_pct', 'CK Nâng cao %'],
                    ['ads_fee_pct', 'Phí QC %'],
                    ['booking_fee_pct', 'Booking %'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="muted">
                    {label}
                    <input className="p13-field" disabled={!editable} value={ratioToPercent(settings[key])} onChange={(event) => setSettings({ ...settings, [key]: percentToRatio(event.target.value) })} />
                  </label>
                ))}
                <label className="muted">
                  Làm tròn
                  <input className="p13-field" disabled={!editable} value={settings.rounding_unit ?? ''} onChange={(event) => setSettings({ ...settings, rounding_unit: event.target.value.replace(/[^\d]/g, '') })} />
                </label>
              </div>
            ) : null}
          </div>
          {services.length ? (
            <table className="p13-table">
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  {LEVELS.map((level) => (
                    <th key={level.code}>{level.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((code) => (
                  <tr key={code} className={sameScope.includes(code) ? 'p13-same' : undefined}>
                    <td>{code}</td>
                    {LEVELS.map((level) => {
                      const row = cell(code, level.code);
                      const inverted = level.code === 'advanced' && inversions.includes(code);
                      return (
                        <td key={level.code} className={inverted ? 'p13-inv' : undefined}>
                          {vnd(row?.price_vnd)}
                          <div className="muted">{row?.hours ?? '—'} giờ</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <h3>Lịch sử version</h3>
          <table className="p13-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Trạng thái</th>
                <th>Hiệu lực</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn btn-sm" type="button" onClick={() => void loadVersion(token, row.id).then(() => setVersionId(row.id))}>
                      {row.code}
                    </button>
                  </td>
                  <td>{row.status}</td>
                  <td>{row.effective_from ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {activateOpen ? (
        <div className="p13-modal">
          <div className="p13-dialog">
            <strong>Kích hoạt version</strong>
            {missing.length ? <div className="p13-banner">Chưa đủ tham số. Nút kích hoạt đang khóa.</div> : null}
            {inversions.length ? <div className="p13-banner">Đảo giá: {inversions.join(', ')}</div> : null}
            <label className="muted">
              Ngày hiệu lực
              <input className="p13-field" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </label>
            <label className="muted">
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} /> Tôi đã xem cảnh báo đảo giá
            </label>
            <textarea className="p13-field" value={ackNote} onChange={(event) => setAckNote(event.target.value)} placeholder="Ghi chú xác nhận" />
            <div className="p13-filters">
              <button className="btn" type="button" onClick={() => setActivateOpen(false)}>
                Đóng
              </button>
              <button
                className="btn"
                type="button"
                disabled={missing.length > 0 || (inversions.length > 0 && (!ack || !ackNote.trim()))}
                onClick={() =>
                  void activateP13Pricing(token, versionId, {
                    effective_from: effectiveFrom || undefined,
                    inversion_ack: ack,
                    inversion_ack_note: ackNote,
                  })
                    .then(() => refresh())
                    .then(() => setActivateOpen(false))
                    .catch((err: Error & { body?: { missing?: string[] } }) => setError(err.body?.missing?.join(', ') || err.message))
                }
              >
                Kích hoạt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StaffPageShell>
  );
}
