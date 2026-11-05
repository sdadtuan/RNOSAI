'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { canEditP13QuoteSettings } from '@/lib/p13/flags';
import type { StoredStaffUser } from '@/lib/auth';

type QuoteSettings = {
  discount_approval_threshold_pct: string | null;
  default_validity_days: number;
  default_display_mode: string;
  custom_line_requires_approval: boolean;
};

function ratioToPercent(ratio: string | null): string {
  if (!ratio) return '';
  const [whole, frac = ''] = ratio.split('.');
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, '') || '0';
  const places = frac.length - 2;
  if (places <= 0) return digits + '0'.repeat(-places);
  const cut = digits.length - places;
  const left = cut > 0 ? digits.slice(0, cut) : '0';
  const right = (cut > 0 ? digits.slice(cut) : digits.padStart(places, '0')).replace(/0+$/, '');
  return right ? `${left},${right}` : left;
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

export function QuoteApprovalSettings({ token, user }: { token: string; user: StoredStaffUser | null }) {
  const editable = canEditP13QuoteSettings(user);
  const [threshold, setThreshold] = useState('');
  const [days, setDays] = useState('10');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API_BASE}/api/crm/p13/settings/quote`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = (await res.json()) as { data?: QuoteSettings; error?: { message?: string } };
        if (!res.ok || !body.data) throw new Error(body.error?.message || 'Không tải được cài đặt');
        if (cancelled) return;
        setThreshold(ratioToPercent(body.data.discount_approval_threshold_pct));
        setDays(String(body.data.default_validity_days ?? 10));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được cài đặt');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function save() {
    setError('');
    setNotice('');
    const ratio = percentToRatio(threshold);
    if (threshold.trim() && !ratio) {
      setError('pct_out_of_range');
      return;
    }
    const res = await fetch(`${API_BASE}/api/crm/p13/settings/quote`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discount_approval_threshold_pct: ratio,
        default_validity_days: Number(days),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (!res.ok) {
      setError(body.error?.code || body.error?.message || 'Không lưu được');
      return;
    }
    setNotice('Đã lưu cài đặt duyệt báo giá');
  }

  return (
    <section className="p13-card">
      <strong>Cài đặt duyệt báo giá</strong>
      <p className="p13-muted">Không gắn với version giá. Đổi ngưỡng không cần clone hay kích hoạt.</p>
      <label>
        Ngưỡng chiết khấu cần CEO duyệt (%)
        <input
          className="p13-field"
          value={threshold}
          placeholder="Trống = mọi chiết khấu đều cần CEO duyệt"
          disabled={!editable}
          onChange={(event) => setThreshold(event.target.value)}
        />
      </label>
      <label>
        Hiệu lực mặc định (ngày lịch)
        <input className="p13-field" value={days} disabled={!editable} onChange={(event) => setDays(event.target.value.replace(/[^\d]/g, ''))} />
      </label>
      {editable ? (
        <button className="btn btn-sm" type="button" onClick={() => void save()}>
          Lưu cài đặt
        </button>
      ) : (
        <p className="p13-muted">Chỉ CEO sửa được.</p>
      )}
      {notice ? <div className="p13-banner">{notice}</div> : null}
      {error ? <div className="error">{error}</div> : null}
    </section>
  );
}
