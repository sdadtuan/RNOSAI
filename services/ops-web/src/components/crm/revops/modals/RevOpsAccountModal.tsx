'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IndustrySelect } from '@/components/agency/IndustrySelect';
import { OwnerAmSelect } from '@/components/agency/OwnerAmSelect';
import { ApiError } from '@/lib/api';
import { createAmAccount } from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsAccountModal({
  open,
  token,
  onClose,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [domain, setDomain] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [tier, setTier] = useState('enterprise');
  const [ownerAmId, setOwnerAmId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLegalName('');
    setTaxId('');
    setDomain('');
    setCode('');
    setIndustry('');
    setTier('enterprise');
    setOwnerAmId('');
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const name = legalName.trim();
    const accountCode = (code.trim() || name.slice(0, 8)).toUpperCase().replace(/\s+/g, '-');
    if (!name || !ownerAmId.trim()) {
      push('Tên pháp lý và Owner là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      const out = await createAmAccount(token, {
        mode: 'create',
        code: accountCode,
        name,
        industry_slug: industry || undefined,
        owner_am_id: ownerAmId.trim(),
      });
      push('Account đã được tạo', 'success');
      onClose();
      router.push(`/crm/account-management/clients/${out.agency_client_id}?revops=1`);
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được account', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Tạo Account"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-account-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo account'}
          </button>
        </>
      }
    >
      <form id="revops-account-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên pháp lý <span className="revops-req">*</span>
            </span>
            <input value={legalName} onChange={(ev) => setLegalName(ev.target.value)} placeholder="Công ty TNHH …" />
          </label>
          <label className="revops-field">
            <span>MST</span>
            <input value={taxId} onChange={(ev) => setTaxId(ev.target.value)} placeholder="0123456789" />
          </label>
          <label className="revops-field">
            <span>Domain</span>
            <input value={domain} onChange={(ev) => setDomain(ev.target.value)} placeholder="company.vn" />
          </label>
          <label className="revops-field">
            <span>Mã account</span>
            <input value={code} onChange={(ev) => setCode(ev.target.value)} placeholder="AUTO nếu trống" />
          </label>
          <label className="revops-field">
            <span>Industry</span>
            <IndustrySelect token={token} value={industry} onChange={setIndustry} />
          </label>
          <label className="revops-field">
            <span>Tier</span>
            <select value={tier} onChange={(ev) => setTier(ev.target.value)}>
              <option value="enterprise">Enterprise</option>
              <option value="mid_market">Mid-market</option>
              <option value="smb">SMB</option>
            </select>
          </label>
          <label className="revops-field revops-field--full">
            <span>
              Owner <span className="revops-req">*</span>
            </span>
            <OwnerAmSelect token={token} value={ownerAmId} onChange={setOwnerAmId} />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}
