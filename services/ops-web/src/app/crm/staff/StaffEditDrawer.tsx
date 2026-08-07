'use client';

import { useEffect, useState } from 'react';
import { WinDrawer } from '@/components/win';
import { patchCrmStaff, type CrmStaffRow } from '@/lib/api';

type Props = {
  open: boolean;
  staff: CrmStaffRow | null;
  token: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (row: CrmStaffRow) => void;
};

export function StaffEditDrawer({ open, staff, token, canEdit, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!staff) return;
    setName(staff.name ?? '');
    setPhone(staff.phone ?? '');
    setEmail(staff.email ?? '');
    setJobTitle(staff.job_title ?? '');
    setError('');
  }, [staff]);

  async function save() {
    if (!staff || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      const updated = await patchCrmStaff(token, staff.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        job_title: jobTitle.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!staff) return null;

  return (
    <WinDrawer
      open={open}
      title={`Sửa hồ sơ — ${staff.name}`}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              Lưu
            </button>
          </>
        ) : null
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <label>
        Họ tên
        <input value={name} onChange={(e) => setName(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        SĐT
        <input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        Chức danh
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} readOnly={!canEdit} />
      </label>
    </WinDrawer>
  );
}
