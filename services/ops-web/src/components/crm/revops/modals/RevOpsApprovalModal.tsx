'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { approveKpiHubItem, rejectKpiHubItem } from '@/lib/kpi-hub-api';
import type { RevopsApprovalItem } from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsApprovalModal({
  open,
  token,
  item,
  onClose,
  onDone,
}: {
  open: boolean;
  token: string;
  item: RevopsApprovalItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setComment('');
  }, [open, item?.id]);

  async function submit(action: 'approve' | 'reject' | 'changes', ev?: FormEvent) {
    ev?.preventDefault();
    if (!item || saving) return;
    if (!comment.trim()) {
      push('Comment là bắt buộc', 'error');
      return;
    }
    if (action === 'changes') {
      push('Yêu cầu chỉnh sửa — Wave 3', 'info');
      return;
    }
    if (!item.canAct) {
      push('Chưa có nguồn phê duyệt cho loại này (Wave 2)', 'error');
      return;
    }
    setSaving(true);
    try {
      if (action === 'approve') {
        await approveKpiHubItem(token, item.sourceKind, item.id, comment.trim());
        push('Đã duyệt', 'success');
      } else {
        await rejectKpiHubItem(token, item.sourceKind, item.id, comment.trim());
        push('Đã từ chối', 'success');
      }
      onDone();
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Thao tác thất bại', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  const actionsDisabled = !item.canAct;

  return (
    <RevOpsModalFrame
      open={open}
      title="Review Approval"
      onClose={onClose}
      wide
      footer={
        <div className="revops-page-actions">
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            type="button"
            className="revops-btn"
            disabled={saving || actionsDisabled}
            title={actionsDisabled ? 'Chưa có nguồn' : undefined}
            onClick={() => void submit('changes')}
          >
            Yêu cầu chỉnh sửa
          </button>
          <button
            type="button"
            className="revops-btn revops-btn--danger"
            disabled={saving || actionsDisabled}
            title={actionsDisabled ? 'Chưa có nguồn' : undefined}
            onClick={() => void submit('reject')}
          >
            Từ chối
          </button>
          <button
            type="button"
            className="revops-btn revops-btn--primary"
            disabled={saving || actionsDisabled}
            title={actionsDisabled ? 'Chưa có nguồn' : undefined}
            onClick={() => void submit('approve')}
          >
            Duyệt
          </button>
        </div>
      }
    >
      <form className="revops-form" onSubmit={(ev) => void submit('approve', ev)}>
        <div className="revops-form-grid">
          <label>
            Request
            <input type="text" value={item.title} readOnly />
          </label>
          <label>
            Type
            <input type="text" value={item.typeLabel} readOnly />
          </label>
          <label>
            Related record
            <input type="text" value={item.relatedRecord} readOnly />
          </label>
          <label>
            Requested by
            <input type="text" value={item.requestedBy} readOnly />
          </label>
          <label>
            Amount / Impact
            <input type="text" value={item.amountImpact ?? '—'} readOnly />
          </label>
          <label>
            Current step
            <input type="text" value={item.currentStep} readOnly />
          </label>
          <label>
            Due
            <input type="text" value={item.dueAt?.slice(0, 10) ?? '—'} readOnly />
          </label>
          <label>
            Status
            <input type="text" value={item.status} readOnly />
          </label>
        </div>
        {item.href ? (
          <p className="revops-sub">
            <Link className="revops-link" href={item.href}>
              Mở bản ghi liên quan →
            </Link>
          </p>
        ) : null}
        {!item.canAct ? (
          <p className="revops-muted revops-approval-hint">
            Loại {item.typeLabel}: chưa có nguồn phê duyệt tích hợp (Wave 2). Xem bản ghi liên quan hoặc KPI Hub.
          </p>
        ) : null}
        <label>
          Comment *
          <textarea
            rows={3}
            value={comment}
            onChange={(ev) => setComment(ev.target.value)}
            placeholder="Ghi chú phê duyệt…"
            required
          />
        </label>
      </form>
    </RevOpsModalFrame>
  );
}
