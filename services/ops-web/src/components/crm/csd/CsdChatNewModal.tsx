'use client';

import { FormEvent, useState } from 'react';
import type { CreateCsdConversationInput, CsdConversationKind } from '@/lib/crm/csd-api';

export type CsdChatCreateKind = Extract<CsdConversationKind, 'client' | 'group' | 'direct' | 'project'>;

const KINDS: { id: CsdChatCreateKind; label: string }[] = [
  { id: 'client', label: 'Khách' },
  { id: 'group', label: 'Nội bộ nhóm' },
  { id: 'direct', label: 'DM' },
  { id: 'project', label: 'Dự án' },
];

function parseStaffIds(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
}

type CsdChatNewModalProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCsdConversationInput) => Promise<void> | void;
};

export function CsdChatNewModal({ open, busy, onClose, onSubmit }: CsdChatNewModalProps) {
  const [kind, setKind] = useState<CsdChatCreateKind>('client');
  const [nameVi, setNameVi] = useState('');
  const [clientAccountId, setClientAccountId] = useState('');
  const [peerStaffId, setPeerStaffId] = useState('');
  const [memberStaffIds, setMemberStaffIds] = useState('');
  const [projectRefKind, setProjectRefKind] = useState('project');
  const [projectRefId, setProjectRefId] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload: CreateCsdConversationInput = {
      kind,
      name_vi: nameVi.trim(),
    };
    if (kind === 'client') {
      const clientId = clientAccountId.trim();
      if (!clientId) {
        setError('Nhập mã khách hàng');
        return;
      }
      if (!payload.name_vi) payload.name_vi = `Khách ${clientId}`;
      payload.client_account_id = clientId;
    } else if (kind === 'direct') {
      const peer = Number(peerStaffId);
      if (!Number.isInteger(peer) || peer <= 0) {
        setError('Nhập staff id người nhận');
        return;
      }
      payload.member_staff_ids = [peer];
    } else if (kind === 'group') {
      const members = parseStaffIds(memberStaffIds);
      if (!payload.name_vi) {
        setError('Nhập tên nhóm');
        return;
      }
      if (members.length < 1) {
        setError('Nhập ít nhất một staff id');
        return;
      }
      payload.member_staff_ids = members;
    } else {
      if (!payload.name_vi || !projectRefKind.trim() || !projectRefId.trim()) {
        setError('Nhập tên dự án và mã tham chiếu');
        return;
      }
      payload.project_ref_kind = projectRefKind.trim();
      payload.project_ref_id = projectRefId.trim();
    }
    await onSubmit(payload);
  }

  return (
    <div className="csd-modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="csd-modal page-card stack-gap"
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        data-testid="csd-chat-new-modal"
      >
        <h3 className="kpi-section-title">Tạo hội thoại</h3>
        <div className="csd-chat-new-kinds">
          {KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn btn-sm btn-secondary${kind === item.id ? ' is-active' : ''}`}
              data-testid={`csd-chat-new-kind-${item.id}`}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {kind !== 'direct' ? (
          <input
            className="kpi-input"
            placeholder={kind === 'client' ? 'Tên hội thoại (tuỳ chọn)' : 'Tên hội thoại'}
            value={nameVi}
            onChange={(e) => setNameVi(e.target.value)}
            data-testid="csd-chat-new-name"
          />
        ) : null}
        {kind === 'client' ? (
          <input
            className="kpi-input"
            placeholder="Mã khách hàng"
            value={clientAccountId}
            onChange={(e) => setClientAccountId(e.target.value)}
            data-testid="csd-chat-new-client"
          />
        ) : null}
        {kind === 'direct' ? (
          <input
            className="kpi-input"
            inputMode="numeric"
            placeholder="Staff id người nhận"
            value={peerStaffId}
            onChange={(e) => setPeerStaffId(e.target.value)}
            data-testid="csd-chat-new-peer"
          />
        ) : null}
        {kind === 'group' ? (
          <input
            className="kpi-input"
            placeholder="Staff id, cách nhau bởi dấu phẩy"
            value={memberStaffIds}
            onChange={(e) => setMemberStaffIds(e.target.value)}
            data-testid="csd-chat-new-members"
          />
        ) : null}
        {kind === 'project' ? (
          <>
            <input
              className="kpi-input"
              placeholder="Loại tham chiếu (project / campaign)"
              value={projectRefKind}
              onChange={(e) => setProjectRefKind(e.target.value)}
              data-testid="csd-chat-new-project-kind"
            />
            <input
              className="kpi-input"
              placeholder="Mã dự án"
              value={projectRefId}
              onChange={(e) => setProjectRefId(e.target.value)}
              data-testid="csd-chat-new-project-id"
            />
          </>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="csd-composer__actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn btn-sm" disabled={busy} data-testid="csd-chat-new-submit">
            Tạo
          </button>
        </div>
      </form>
    </div>
  );
}
