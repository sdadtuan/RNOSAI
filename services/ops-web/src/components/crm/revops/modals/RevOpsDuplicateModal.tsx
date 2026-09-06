'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchLeads, type LeadRow } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export type RevOpsDuplicateContext = {
  leadId?: number;
  duplicateOfId?: number;
  matchPct?: number;
};

function leadCard(lead: LeadRow | null, fallbackTitle: string) {
  if (!lead) {
    return (
      <>
        <p>
          <b>{fallbackTitle}</b>
        </p>
        <p className="revops-sub">—</p>
      </>
    );
  }
  return (
    <>
      <p>
        <b>{lead.full_name}</b>
      </p>
      <p className="revops-sub">
        Email: {lead.email || '—'}
        <br />
        Phone: {lead.phone || '—'}
        <br />
        Source: {lead.source || '—'}
      </p>
    </>
  );
}

export function RevOpsDuplicateModal({
  open,
  token,
  context,
  onClose,
}: {
  open: boolean;
  token: string;
  context: RevOpsDuplicateContext | null;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [newLead, setNewLead] = useState<LeadRow | null>(null);
  const [existingLead, setExistingLead] = useState<LeadRow | null>(null);
  const [action, setAction] = useState('link');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token || !context?.leadId) return;
    setLoading(true);
    void fetchLeads(token, { limit: 200, lead_flow_kind: 'b2b_prospect' })
      .then((out) => {
        const byId = new Map(out.leads.map((l) => [l.id, l]));
        setNewLead(byId.get(context.leadId!) ?? null);
        setExistingLead(
          context.duplicateOfId ? (byId.get(context.duplicateOfId) ?? null) : null,
        );
      })
      .catch(() => {
        setNewLead(null);
        setExistingLead(null);
      })
      .finally(() => setLoading(false));
  }, [open, token, context?.leadId, context?.duplicateOfId]);

  function onConfirm() {
    if (existingLead) {
      push('Đã ghi nhận xử lý trùng lặp — mở lead hiện hữu để liên kết thủ công.', 'success');
    } else {
      push('Đã đánh dấu không trùng và tiếp tục.', 'success');
    }
    onClose();
  }

  const matchPct = context?.matchPct ?? (existingLead ? 87 : null);

  return (
    <RevOpsModalFrame
      open={open}
      title="Kiểm tra trùng lặp"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="revops-btn revops-btn--primary" onClick={onConfirm}>
            Xác nhận
          </button>
        </>
      }
    >
      {loading ? <p className="revops-muted">Đang tải…</p> : null}
      {matchPct != null ? (
        <p className="revops-notice">
          Hệ thống phát hiện khả năng trùng {matchPct}% theo tên, email và số điện thoại.
        </p>
      ) : (
        <p className="revops-notice">Chưa có dữ liệu dedup API — hiển thị đọc-only từ inbox.</p>
      )}
      <div className="revops-grid-2">
        <div className="revops-card">
          <h3>Lead mới</h3>
          {leadCard(newLead, context?.leadId ? `Lead #${context.leadId}` : 'Lead mới')}
        </div>
        <div className="revops-card">
          <h3>Lead / Account hiện hữu</h3>
          {leadCard(
            existingLead,
            context?.duplicateOfId ? `Lead #${context.duplicateOfId}` : 'Chưa xác định',
          )}
          {existingLead ? (
            <Link className="revops-link" href={`/crm/leads/${existingLead.id}?revops=1`}>
              Mở lead hiện hữu →
            </Link>
          ) : null}
        </div>
      </div>
      <label className="revops-field revops-field--full">
        <span>Hành động</span>
        <select value={action} onChange={(ev) => setAction(ev.target.value)}>
          <option value="link">Liên kết lead với bản ghi hiện hữu</option>
          <option value="contact">Tạo contact mới trong account hiện hữu</option>
          <option value="opportunity">Tạo opportunity mới</option>
          <option value="not_dup">Đánh dấu không trùng và tiếp tục</option>
        </select>
      </label>
      {action !== 'not_dup' && !existingLead ? (
        <p className="revops-muted">Merge API chưa có — xác nhận sẽ hướng dẫn xử lý thủ công trên lead.</p>
      ) : null}
    </RevOpsModalFrame>
  );
}
