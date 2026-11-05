'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { previewP13Pricing, type P13PreviewResponse, type P13PricingRole, type P13PricingSettings } from '@/lib/p13/api';
import {
  ROUNDING_UNITS,
  TRIAL_ROLES,
  TRIAL_SERVICES,
  buildPreviewBody,
  digitsFromGrouped,
  formatGroupedInt,
  formatRoundingLabel,
  formatVnd,
  previewErrorText,
  previewExportPayload,
  previewFieldError,
  ratioToVi,
  trialFromFixture,
  trialFromVersion,
  viToRatio,
  type TrialForm,
  type TrialLevel,
  type TrialLine,
} from '@/lib/p13/pricing-preview';

type Props = {
  token: string;
  versionId: string;
  versionCode: string;
  updatedAt: string;
  roles: P13PricingRole[];
  settings: P13PricingSettings | null;
  onClose: () => void;
};

function newLine(partial?: Partial<TrialLine>): TrialLine {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'package',
    service_code: 'WEB',
    level: 'standard',
    item_code: '',
    qty: '1',
    ...partial,
  };
}

export function PricePreviewPanel({ token, versionId, versionCode, updatedAt, roles, settings, onClose }: Props) {
  const [form, setForm] = useState<TrialForm>(() => trialFromVersion(roles, settings));
  const [lines, setLines] = useState<TrialLine[]>([]);
  const [draftService, setDraftService] = useState('WEB');
  const [draftLevel, setDraftLevel] = useState<TrialLevel>('standard');
  const [draftItem, setDraftItem] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftKind, setDraftKind] = useState<'package' | 'item'>('package');
  const [result, setResult] = useState<P13PreviewResponse | null>(null);
  const [requestBody, setRequestBody] = useState<Record<string, unknown> | null>(null);
  const [errorCode, setErrorCode] = useState('');
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);

  const fieldErrors = previewFieldError(errorCode);
  const body = useMemo(() => buildPreviewBody(form, lines, versionId), [form, lines, versionId]);

  const run = useCallback(async (next: Record<string, unknown>) => {
    setBusy(true);
    setRequestBody(next);
    try {
      const response = await previewP13Pricing(token, next);
      setResult(response);
      setErrorCode('');
      setErrorText('');
    } catch (err) {
      const failure = err as Error & { status?: number; code?: string; body?: { code?: string; error?: string; message?: string } };
      const code = failure.body?.code || failure.code || failure.body?.error || '';
      setErrorCode(code);
      setErrorText(previewErrorText(code, failure.body?.message || failure.message || code || 'Không tính được giá thử'));
      if (failure.status === 422) setResult(null);
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void run(body);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [body, run]);

  function patchRole(code: string, patch: Partial<TrialForm['roles'][number]>) {
    setForm((current) => ({
      ...current,
      roles: current.roles.map((role) => (role.role_code === code ? { ...role, ...patch } : role)),
    }));
  }

  function patchSettings(patch: Partial<TrialForm['settings']>) {
    setForm((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function addLine() {
    if (draftKind === 'item' && !draftItem.trim()) return;
    setLines((current) => [
      ...current,
      newLine({
        type: draftKind,
        service_code: draftService,
        level: draftLevel,
        item_code: draftItem.trim(),
        qty: draftQty.trim() || '1',
      }),
    ]);
  }

  function exportJson() {
    const payload = previewExportPayload(requestBody, result);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'p13-pricing-preview.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  const services = result?.matrix?.length
    ? [...new Set(result.matrix.map((row) => row.service_code))]
    : [...TRIAL_SERVICES];

  return (
    <div className="p13-drawer" onClick={onClose}>
      <aside className="p13-panel" style={{ width: 'min(1080px, 100%)' }} onClick={(event) => event.stopPropagation()}>
        <div className="p13-head">
          <div>
            <h2 style={{ margin: 0 }}>Xem thử giá</h2>
            <p className="p13-banner">Chế độ xem thử — không lưu. Version {versionCode || '—'} · updated_at {updatedAt || '—'}</p>
          </div>
          <button className="btn btn-sm" type="button" onClick={onClose}>Đóng</button>
        </div>
        <div className="p13-filters">
          <button className="btn btn-sm" type="button" onClick={() => setForm(trialFromFixture())}>Nạp bộ tham số test (fixture)</button>
          <button className="btn btn-sm" type="button" onClick={() => setForm(trialFromVersion(roles, settings))}>Đặt lại theo version</button>
          <button className="btn btn-sm" type="button" onClick={() => void run(body)}>{busy ? 'Đang tính…' : 'Tính'}</button>
          <button className="btn btn-sm" type="button" disabled={!result} onClick={exportJson}>Xuất JSON kết quả</button>
        </div>
        <p className="muted">Tham số test, không phải giá thật. Bộ fixture chỉ điền vào form này.</p>
        {errorText ? <p className="error">{errorCode || 'Lỗi'} — {errorText}</p> : null}
        <div className="p13-grid">
          <div>
            <strong>9 vai trò</strong>
            <table className="p13-table">
              <thead>
                <tr>
                  <th>Vai trò</th>
                  <th>Lương/tháng</th>
                  <th>BH</th>
                  <th>Phúc lợi/tháng</th>
                  <th>Giờ/tháng</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {form.roles.map((role) => {
                  const label = TRIAL_ROLES.find((row) => row[0] === role.role_code)?.[1] ?? role.role_code;
                  const exact = result?.rate?.[role.role_code] ?? result?.rates?.[role.role_code]?.rate ?? '';
                  const shown = result?.rates?.[role.role_code]?.rate_display ?? exact.split('.')[0] ?? '';
                  return (
                    <tr key={role.role_code}>
                      <td>{label}</td>
                      <td><input className="p13-field" inputMode="numeric" value={formatGroupedInt(role.monthly_salary)} onChange={(event) => patchRole(role.role_code, { monthly_salary: digitsFromGrouped(event.target.value) })} /></td>
                      <td><input className="p13-field" value={ratioToVi(role.insurance_pct)} onChange={(event) => patchRole(role.role_code, { insurance_pct: viToRatio(event.target.value) })} /></td>
                      <td><input className="p13-field" inputMode="numeric" value={formatGroupedInt(role.monthly_benefits)} onChange={(event) => patchRole(role.role_code, { monthly_benefits: digitsFromGrouped(event.target.value) })} /></td>
                      <td><input className="p13-field" value={role.productive_hours} onChange={(event) => patchRole(role.role_code, { productive_hours: viToRatio(event.target.value) })} /></td>
                      <td title={exact || undefined}>{shown ? formatVnd(shown) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <strong>Thông số</strong>
            {(
              [
                ['overhead_pct', 'Overhead'],
                ['margin_pct', 'Margin'],
                ['vat_pct', 'VAT'],
                ['discount_standard_pct', 'CK gói Tiêu chuẩn'],
                ['discount_advanced_pct', 'CK gói Nâng cao'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="muted">
                {label}
                <input className="p13-field" value={ratioToVi(form.settings[key])} onChange={(event) => patchSettings({ [key]: viToRatio(event.target.value) })} />
                {fieldErrors[key] ? <span className="error">{fieldErrors[key]} — {errorText}</span> : null}
              </label>
            ))}
            <label className="muted">
              Làm tròn
              <select className="p13-field" value={ROUNDING_UNITS.includes(form.settings.rounding_unit as (typeof ROUNDING_UNITS)[number]) ? form.settings.rounding_unit : form.settings.rounding_unit} onChange={(event) => patchSettings({ rounding_unit: event.target.value })}>
                {(ROUNDING_UNITS.includes(form.settings.rounding_unit as (typeof ROUNDING_UNITS)[number]) ? ROUNDING_UNITS : [form.settings.rounding_unit, ...ROUNDING_UNITS]).map((unit) => (
                  <option key={unit} value={unit}>{formatRoundingLabel(unit)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {result?.missing?.length ? (
          <div className="p13-banner">
            missing: {result.missing.join(', ')}
          </div>
        ) : null}
        {result?.warnings?.length ? <div className="p13-banner">warnings: {result.warnings.join(', ')}</div> : null}
        <table className="p13-table">
          <thead>
            <tr>
              <th>Dịch vụ</th>
              <th>Cơ bản</th>
              <th>Tiêu chuẩn</th>
              <th>Nâng cao</th>
            </tr>
          </thead>
          <tbody>
            {services.map((code) => {
              const same = result?.scope_identical?.includes(code);
              const inverted = result?.inversions?.includes(code);
              return (
                <tr key={code} className={same ? 'p13-same' : undefined}>
                  <td>
                    {code}
                    {same ? <span className="p13-badge">package_scope_identical</span> : null}
                  </td>
                  {(['basic', 'standard', 'advanced'] as const).map((level) => {
                    const cell = result?.matrix?.find((row) => row.service_code === code && row.level === level);
                    return (
                      <td key={level} className={inverted && level === 'advanced' ? 'p13-inv' : undefined}>
                        {formatVnd(cell?.price_vnd)}
                        <div className="muted">{cell?.hours ?? '—'} giờ</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>Dòng thử</h3>
        <div className="p13-filters">
          <select className="p13-field" style={{ width: 'auto' }} value={draftKind} onChange={(event) => setDraftKind(event.target.value === 'item' ? 'item' : 'package')}>
            <option value="package">Gói</option>
            <option value="item">Hạng mục lẻ</option>
          </select>
          {draftKind === 'package' ? (
            <>
              <select className="p13-field" style={{ width: 'auto' }} value={draftService} onChange={(event) => setDraftService(event.target.value)}>
                {TRIAL_SERVICES.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
              <select className="p13-field" style={{ width: 'auto' }} value={draftLevel} onChange={(event) => setDraftLevel(event.target.value as TrialLevel)}>
                <option value="basic">Cơ bản</option>
                <option value="standard">Tiêu chuẩn</option>
                <option value="advanced">Nâng cao</option>
              </select>
            </>
          ) : (
            <input className="p13-field" style={{ width: 160 }} placeholder="WEB-04-08" value={draftItem} onChange={(event) => setDraftItem(event.target.value)} />
          )}
          <input className="p13-field" style={{ width: 80 }} value={draftQty} onChange={(event) => setDraftQty(digitsFromGrouped(event.target.value) || '')} />
          <button className="btn btn-sm" type="button" onClick={addLine}>Thêm dòng</button>
        </div>
        <table className="p13-table">
          <thead>
            <tr>
              <th>Dòng</th>
              <th>SL</th>
              <th>Thành tiền</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.key}>
                <td>{line.type === 'package' ? `${line.service_code} ${line.level}` : line.item_code}</td>
                <td>{line.qty}</td>
                <td>{formatVnd(result?.lines?.[index]?.amount)}</td>
                <td><button className="btn btn-sm" type="button" onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>fee_subtotal {formatVnd(result?.fee_subtotal)} · fee_vat {formatVnd(result?.fee_vat)} · fee_total {formatVnd(result?.fee_total)}</p>
      </aside>
    </div>
  );
}
