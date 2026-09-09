'use client';

import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  deleteLeadPartyLogo,
  leadPartyLogoUrl,
  uploadLeadPartyLogo,
} from '@/lib/api';

export type LeadPartyFormValue = {
  company_name: string;
  company_address: string;
  phone: string;
  email: string;
  logo_asset_id: string;
  full_name: string;
};

export function emptyLeadParty(fullName = ''): LeadPartyFormValue {
  return {
    company_name: '',
    company_address: '',
    phone: '',
    email: '',
    logo_asset_id: '',
    full_name: fullName,
  };
}

export function LeadPartyCard({
  leadId,
  value,
  onChange,
  disabled,
  onSave,
  saving,
  quoteHref,
  hint,
}: {
  leadId?: number;
  value: LeadPartyFormValue;
  onChange: (next: LeadPartyFormValue) => void;
  disabled?: boolean;
  onSave?: () => void;
  saving?: boolean;
  quoteHref?: string | null;
  hint?: string;
}) {
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');

  useEffect(() => {
    if (!leadId || !value.logo_asset_id) {
      setThumbUrl('');
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    let objectUrl = '';
    let cancelled = false;
    void fetch(leadPartyLogoUrl(leadId), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [leadId, value.logo_asset_id]);

  async function onLogo(file: File | null) {
    if (!file || !leadId || disabled) return;
    const token = getAccessToken();
    if (!token) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      const lead = await uploadLeadPartyLogo(token, leadId, file);
      onChange({
        ...value,
        logo_asset_id: String(lead.logo_asset_id ?? ''),
      });
    } catch (caught) {
      setLogoError(caught instanceof Error ? caught.message : 'Không tải được logo');
    } finally {
      setLogoBusy(false);
    }
  }

  async function onRemoveLogo() {
    if (!leadId || disabled) return;
    const token = getAccessToken();
    if (!token) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      await deleteLeadPartyLogo(token, leadId);
      onChange({ ...value, logo_asset_id: '' });
    } catch (caught) {
      setLogoError(caught instanceof Error ? caught.message : 'Không gỡ được logo');
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <section className="qt-card lead-panel lead-party-card" data-testid="lead-party-card">
      <div className="qt-card__head lead-panel__head">
        <b className="lead-panel__title">Thông tin khách</b>
        {quoteHref ? (
          <a className="qt-btn" href={quoteHref}>
            Mở báo giá
          </a>
        ) : null}
      </div>
      <p className="qt-muted">
        {hint ??
          'Tên công ty in trên báo giá. Chưa tạo khách AM 360. Nên có địa chỉ và logo trên PDF.'}
      </p>
      <label>
        Tên công ty / đơn vị *
        <input
          className="qt-inp"
          name="company_name"
          value={value.company_name}
          onChange={(event) => onChange({ ...value, company_name: event.target.value })}
          disabled={disabled}
        />
      </label>
      <label>
        Người liên hệ
        <input className="qt-inp" name="full_name" value={value.full_name} readOnly disabled />
      </label>
      <label>
        Địa chỉ
        <textarea
          className="qt-inp"
          name="company_address"
          rows={2}
          value={value.company_address}
          onChange={(event) => onChange({ ...value, company_address: event.target.value })}
          disabled={disabled}
        />
      </label>
      <label>
        Số điện thoại
        <input
          className="qt-inp"
          name="phone"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          disabled={disabled}
        />
      </label>
      <label>
        Email
        <input
          className="qt-inp"
          name="email"
          type="email"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          disabled={disabled}
        />
      </label>
      <label>
        Logo (PNG/JPEG/WebP, ≤ 2 MB)
        <input
          className="qt-inp"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || logoBusy || !leadId}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            void onLogo(file);
          }}
        />
      </label>
      {value.logo_asset_id && leadId ? (
        <div className="lead-party-card__logo">
          {/* auth cookie / bearer not on <img>; show filename + remove */}
          {thumbUrl ? (
            <img alt="Logo khách" src={thumbUrl} className="lead-party-card__thumb" />
          ) : (
            <span className="qt-muted">Đã có logo</span>
          )}
          <button type="button" className="qt-btn" disabled={disabled || logoBusy} onClick={() => void onRemoveLogo()}>
            Gỡ logo
          </button>
        </div>
      ) : (
        <p className="qt-muted">Chưa có logo — PDF sẽ không in logo.</p>
      )}
      {logoError ? <p className="qt-muted">{logoError}</p> : null}
      {onSave ? (
        <button type="button" className="qt-btn qt-btn--primary" disabled={disabled || saving} onClick={onSave}>
          {saving ? 'Đang lưu…' : 'Lưu thông tin khách'}
        </button>
      ) : null}
    </section>
  );
}
