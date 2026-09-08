'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  buildQtSettingsPatch,
  getQtSettings,
  patchQtSettings,
  type QtSettings,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export const QT_SETTINGS_TABS = [
  { id: 'set-01', label: 'Mặc định' },
  { id: 'set-02', label: 'Guardrail' },
  { id: 'set-03', label: 'Rate card' },
  { id: 'set-04', label: 'Chia sẻ' },
  { id: 'set-05', label: 'Approver' },
  { id: 'set-06', label: 'Template' },
] as const;

export type QtSettingsTabId = (typeof QT_SETTINGS_TABS)[number]['id'];

const GUARDRAIL_ROWS = [
  { when: 'Discount ≤ 5% và GM ≥ floor', who: 'Auto / Sales Manager' },
  { when: 'Discount 5–10%', who: 'AM Lead / AD' },
  { when: 'Discount > 10%', who: 'AD + Finance' },
  { when: 'GM dưới floor', who: 'Finance + GDKD' },
  { when: 'Tổng vượt ngưỡng GDKD', who: 'GDKD' },
  { when: 'Payment term vượt hạn', who: 'Finance' },
  { when: 'Clause lệch template', who: 'Legal' },
  { when: 'Custom / zero-price / thiếu cost', who: 'Finance' },
] as const;

export function asSettingsTab(value: string | null | undefined): QtSettingsTabId {
  return QT_SETTINGS_TABS.some((tab) => tab.id === value)
    ? (value as QtSettingsTabId)
    : 'set-01';
}

function num(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function qtSettingsFromForm(form: FormData): Record<string, unknown> {
  return buildQtSettingsPatch({
    validity_days: num(form.get('validity_days')),
    vat_bps: num(form.get('vat_bps')),
    payment_template: String(form.get('payment_template') ?? '').trim() || undefined,
    gm_floor_bps: num(form.get('gm_floor_bps')),
    discount_auto_bps: num(form.get('discount_auto_bps')),
    director_value_vnd: num(form.get('director_value_vnd')),
    payment_term_max_days: num(form.get('payment_term_max_days')),
    share_expiry_days: num(form.get('share_expiry_days')),
    pdf_download: form.get('pdf_download') === '1',
    otp_required: form.get('otp_required') === '1',
    view_tracking: form.get('view_tracking') === '1',
    ai_enabled: form.get('ai_enabled') === '1',
  });
}

export function QtSettingsForm({
  settings,
  tab = 'set-01',
  saving = false,
  onSubmit,
}: {
  settings: QtSettings;
  tab?: QtSettingsTabId;
  saving?: boolean;
  onSubmit?: (form: FormData) => void | Promise<void>;
}) {
  const active = asSettingsTab(tab);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit?.(new FormData(event.currentTarget));
  }

  return (
    <form className="qt-settings-form qt-form" onSubmit={(event) => void submit(event)}>
      <div hidden={active !== 'set-01'}>
        <h2>Mặc định thương mại</h2>
        <p className="qt-muted">SET-01 · tenant PTT · một legal entity PTT HCM</p>
        <label className="qt-form-label">
          Format mã
          <input
            className="qt-inp"
            name="quote_code_pattern"
            value={settings.quote_code_pattern ?? ''}
            readOnly
          />
        </label>
        <label className="qt-form-label">
          Hiệu lực mặc định (ngày)
          <input
            className="qt-inp"
            name="validity_days"
            type="number"
            defaultValue={settings.validity_days ?? ''}
          />
        </label>
        <label className="qt-form-label">
          VAT (bps)
          <input
            className="qt-inp"
            name="vat_bps"
            type="number"
            defaultValue={settings.vat_bps ?? ''}
          />
        </label>
        <label className="qt-form-label">
          Tiền tệ
          <input className="qt-inp" name="currency_code" value={settings.currency_code ?? 'VND'} readOnly />
        </label>
        <label className="qt-form-label">
          Timezone
          <input
            className="qt-inp"
            name="timezone"
            value={settings.timezone ?? 'Asia/Ho_Chi_Minh'}
            readOnly
          />
        </label>
        <label className="qt-form-label">
          Legal entity
          <input
            className="qt-inp"
            name="issuing_entity"
            value={settings.issuing_entity ?? 'PTT-HCM'}
            readOnly
          />
        </label>
        <label className="qt-form-label">
          Payment template
          <select className="qt-inp" name="payment_template" defaultValue={settings.payment_template ?? '50/30/20'}>
            <option value="50/30/20">50 / 30 / 20</option>
            <option value="40/40/20">40 / 40 / 20</option>
          </select>
        </label>
        <label className="qt-form-label">
          <span>
            <input type="checkbox" name="ai_enabled" value="1" defaultChecked={settings.ai_enabled === true} />
            {' '}
            AI hỗ trợ soạn
          </span>
          <span className="qt-muted">Hiển thị trạng thái. Máy chủ bỏ qua nếu AI chưa mở.</span>
        </label>
      </div>

      <div hidden={active !== 'set-02'}>
        <h2>Guardrail giá &amp; margin</h2>
        <p className="qt-muted">SET-02 · floor / discount / ngưỡng GDKD / hạn thanh toán</p>
        <label className="qt-form-label">
          GM floor (bps)
          <input
            className="qt-inp"
            name="gm_floor_bps"
            type="number"
            defaultValue={settings.gm_floor_bps ?? ''}
          />
        </label>
        <label className="qt-form-label">
          Discount auto (bps)
          <input
            className="qt-inp"
            name="discount_auto_bps"
            type="number"
            defaultValue={settings.discount_auto_bps ?? ''}
          />
        </label>
        <label className="qt-form-label">
          Ngưỡng GDKD (₫)
          <input
            className="qt-inp"
            name="director_value_vnd"
            type="number"
            defaultValue={settings.director_value_vnd ?? ''}
          />
        </label>
        <label className="qt-form-label">
          Payment term tối đa (ngày)
          <input
            className="qt-inp"
            name="payment_term_max_days"
            type="number"
            defaultValue={settings.payment_term_max_days ?? ''}
          />
        </label>
        <div className="qt-table-wrap">
          <table className="qt-table">
            <thead>
              <tr>
                <th>Điều kiện</th>
                <th>Approver</th>
              </tr>
            </thead>
            <tbody>
              {GUARDRAIL_ROWS.map((row) => (
                <tr key={row.when}>
                  <td>{row.when}</td>
                  <td>{row.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div hidden={active !== 'set-03'}>
        <h2>Quản trị rate card</h2>
        <p className="qt-muted">SET-03 · deep-link catalog · Active/Retired</p>
        <p>
          <Link className="qt-btn" href="/crm/proposals/catalog">
            Mở catalog
          </Link>
        </p>
        <p className="qt-empty">{dash(null)}</p>
      </div>

      <div hidden={active !== 'set-04'}>
        <h2>Chia sẻ &amp; OTP</h2>
        <p className="qt-muted">SET-04 · expiry · PDF · OTP · view tracking</p>
        <label className="qt-form-label">
          Hết hạn link mặc định (ngày)
          <input
            className="qt-inp"
            name="share_expiry_days"
            type="number"
            defaultValue={settings.share_expiry_days ?? ''}
          />
        </label>
        <label className="qt-form-label">
          <input type="checkbox" name="pdf_download" value="1" defaultChecked={settings.pdf_download === true} />
          {' '}
          Cho phép tải PDF
        </label>
        <label className="qt-form-label">
          <input type="checkbox" name="otp_required" value="1" defaultChecked={settings.otp_required === true} />
          {' '}
          OTP email khi xác nhận
        </label>
        <label className="qt-form-label">
          <input type="checkbox" name="view_tracking" value="1" defaultChecked={settings.view_tracking === true} />
          {' '}
          Ghi first/last view + section
        </label>
      </div>

      <div hidden={active !== 'set-05'}>
        <h2>Ma trận approver</h2>
        <p className="qt-muted">SET-05 · map job function PTT</p>
        <div className="qt-table-wrap">
          <table className="qt-table">
            <thead>
              <tr>
                <th>Bước</th>
                <th>Cap</th>
                <th>Người / hàng</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="qt-empty" colSpan={3}>
                  {dash(null)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div hidden={active !== 'set-06'}>
        <h2>Template điều khoản &amp; Studio</h2>
        <p className="qt-muted">SET-06 · clause snapshot lúc xuất bản · cấm merge field finance</p>
        <section className="qt-card">
          <h3>Clause PTT HCM</h3>
          <p className="qt-empty">{dash(null)}</p>
        </section>
        <section className="qt-card">
          <h3>Studio cover</h3>
          <p className="qt-empty">{dash(null)}</p>
        </section>
      </div>

      <div className="qt-head__actions">
        <button className="qt-btn qt-btn--primary" type="submit" disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  );
}

export function QtSettingsChrome({
  settings,
  tab = 'set-01',
  saving = false,
  loading = false,
  error = '',
  notice = '',
  onTab,
  onSubmit,
  onRetry,
}: {
  settings: QtSettings | null;
  tab?: QtSettingsTabId;
  saving?: boolean;
  loading?: boolean;
  error?: string;
  notice?: string;
  onTab?: (id: QtSettingsTabId) => void;
  onSubmit?: (form: FormData) => void | Promise<void>;
  onRetry?: () => void;
}) {
  const active = asSettingsTab(tab);
  return (
    <div className="qt-settings">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Cấu hình</p>
          <h1>Cấu hình</h1>
          <p className="qt-muted">SET-01…06 · tenant PTT</p>
        </div>
      </header>
      <div className="qt-tabs">
        {QT_SETTINGS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-tab${item.id === active ? ' qt-tab--on' : ''}`}
            onClick={onTab ? () => onTab(item.id) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          {onRetry ? (
            <button type="button" className="qt-btn" onClick={onRetry}>
              Thử lại
            </button>
          ) : null}
        </section>
      ) : null}
      {notice ? <p className="qt-muted">{notice}</p> : null}
      {loading && !settings ? <p className="qt-muted">Đang tải…</p> : null}
      {settings ? (
        <QtSettingsForm settings={settings} tab={active} saving={saving} onSubmit={onSubmit} />
      ) : !loading ? (
        <p className="qt-empty">{dash(null)}</p>
      ) : null}
    </div>
  );
}

export function QtSettings() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/settings';
  const searchParams = useSearchParams();
  const tab = useMemo(() => asSettingsTab(searchParams.get('tab')), [searchParams]);
  const [settings, setSettings] = useState<QtSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSettings(await getQtSettings(token));
    } catch (caught) {
      setSettings(null);
      setError(caught instanceof Error ? caught.message : 'Không tải được cấu hình');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeTab(next: QtSettingsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'set-01') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function save(form: FormData) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      setSettings(await patchQtSettings(token, qtSettingsFromForm(form)));
      setNotice('Đã lưu cấu hình');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được cấu hình');
    } finally {
      setSaving(false);
    }
  }

  return (
    <QtSettingsChrome
      settings={settings}
      tab={tab}
      saving={saving}
      loading={loading}
      error={error}
      notice={notice}
      onTab={changeTab}
      onSubmit={save}
      onRetry={() => void load()}
    />
  );
}
