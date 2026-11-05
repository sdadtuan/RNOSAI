'use client';

import { useEffect, useState } from 'react';
import { Form, FormCheck, FormError, FormField, FormFooter, FormInput, FormSelect } from '@/components/form';
import type { B2bProjectDetail, B2bProjectListItem } from '@/lib/b2b-projects-api';
import {
  B2B_PROJECT_STATUSES,
  B2B_PROJECT_STATUS_LABELS,
  normalizeProjectCode,
  type B2bProjectStatus,
} from '@/lib/b2b-project-util';

export type B2bProjectFormValues = {
  code: string;
  name: string;
  status: B2bProjectStatus;
  manual_ingest_enabled: boolean;
  ai_call_enabled: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  initial?: B2bProjectListItem | B2bProjectDetail | null;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: B2bProjectFormValues) => void | Promise<void>;
};

export function B2bProjectFormModal({ mode, initial, busy, error, onClose, onSubmit }: Props) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState<B2bProjectStatus>((initial?.status as B2bProjectStatus) ?? 'draft');
  const [manualIngest, setManualIngest] = useState(
    initial && 'manual_ingest_enabled' in initial ? Boolean(initial.manual_ingest_enabled) : true,
  );
  const [aiCall, setAiCall] = useState(
    initial && 'ai_call_enabled' in initial ? Boolean(initial.ai_call_enabled) : false,
  );

  useEffect(() => {
    if (!initial) return;
    setCode(initial.code);
    setName(initial.name);
    setStatus((initial.status as B2bProjectStatus) ?? 'draft');
    if ('manual_ingest_enabled' in initial) setManualIngest(Boolean(initial.manual_ingest_enabled));
    if ('ai_call_enabled' in initial) setAiCall(Boolean(initial.ai_call_enabled));
  }, [initial]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <Form
        className="modal-card stack-gap"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            code: mode === 'create' ? normalizeProjectCode(code) : code,
            name: name.trim(),
            status,
            manual_ingest_enabled: manualIngest,
            ai_call_enabled: aiCall,
          });
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{mode === 'create' ? 'Thêm dự án PTT' : 'Sửa dự án PTT'}</h3>

        <FormField label="Mã (slug webhook)" hint={mode === 'create' ? 'Dùng trong URL webhook Meta/Zalo' : undefined}>
          <FormInput
            value={code}
            disabled={mode === 'edit' || busy}
            onChange={(e) => setCode(mode === 'create' ? normalizeProjectCode(e.target.value) : e.target.value)}
            placeholder="vd: ptt-hcm"
            required
          />
        </FormField>

        <FormField label="Tên dự án">
          <FormInput value={name} disabled={busy} onChange={(e) => setName(e.target.value)} required />
        </FormField>

        <FormField label="Trạng thái">
          <FormSelect value={status} disabled={busy} onChange={(e) => setStatus(e.target.value as B2bProjectStatus)}>
            {B2B_PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {B2B_PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </FormSelect>
        </FormField>

        <FormCheck label="Cho phép ingest lead thủ công">
          <input type="checkbox" checked={manualIngest} disabled={busy} onChange={(e) => setManualIngest(e.target.checked)} />
        </FormCheck>

        <FormCheck label="Bật AI gọi (pilot)">
          <input type="checkbox" checked={aiCall} disabled={busy} onChange={(e) => setAiCall(e.target.checked)} />
        </FormCheck>

        {error ? <FormError>{error}</FormError> : null}

        <FormFooter className="modal-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || (mode === 'create' && !code.trim())}>
            {busy ? 'Đang lưu…' : mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
          </button>
        </FormFooter>
      </Form>
    </div>
  );
}
