'use client';

import { useMemo, useState } from 'react';
import { assignLead, reassignLeadOwner, type CrmStaffRow } from '@/lib/api';

export type LeadOwnerKind = 'sales' | 'am' | 'acm' | 'solution' | 'quote_am';

const KIND_LABEL: Record<LeadOwnerKind, string> = {
  sales: 'Sales phụ trách',
  am: 'AM phụ trách',
  acm: 'ACM phụ trách',
  solution: 'Marketing solution',
  quote_am: 'AM báo giá / thương lượng / hợp đồng',
};

function codeOf(row: CrmStaffRow): string {
  return `${row.position_catalog_code ?? ''} ${row.job_title ?? ''} ${row.department ?? ''}`.toLowerCase();
}

export function staffForOwnerKind(staff: CrmStaffRow[], kind: LeadOwnerKind): CrmStaffRow[] {
  const active = staff.filter((row) => row.active !== 0);
  const match = (pred: (row: CrmStaffRow) => boolean) => {
    const hit = active.filter(pred);
    return hit.length ? hit : active;
  };
  if (kind === 'sales') {
    return match((row) => row.can_receive_leads !== false || /sale|ae\b|kinh doanh|account executive/.test(codeOf(row)));
  }
  if (kind === 'am' || kind === 'acm') {
    return match((row) =>
      /\bam\b|\bacm\b|account manager|account-manager|account care/.test(codeOf(row)),
    );
  }
  if (kind === 'quote_am') {
    return match((row) => /\bam\b|account manager|account-manager/.test(codeOf(row)));
  }
  return match((row) => row.can_receive_solution === true || /mkt|marketing|solution/.test(codeOf(row)));
}

export function ownerKindFromHandoffStep(step: string | null | undefined): LeadOwnerKind {
  switch (String(step ?? '').trim()) {
    case 'await_solutions':
      return 'am';
    case 'doing_solutions':
      return 'solution';
    case 'await_quote':
    case 'negotiate':
    case 'sign_contract':
      return 'quote_am';
    default:
      return 'sales';
  }
}

export function currentOwnerIdForKind(
  kind: LeadOwnerKind,
  ids: {
    sales?: number | null;
    assignedAm?: number | null;
    solution?: number | null;
    quoteAm?: number | null;
  },
): number | null {
  const asId = (value?: number | null) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  if (kind === 'sales') return asId(ids.sales);
  if (kind === 'am' || kind === 'acm') return asId(ids.assignedAm);
  if (kind === 'solution') return asId(ids.solution);
  return asId(ids.quoteAm) ?? asId(ids.assignedAm);
}

export function LeadOwnerReassignControl({
  token,
  leadId,
  kind,
  currentOwnerId,
  staff,
  onAssigned,
  onError,
  onMessage,
}: {
  token: string;
  leadId: number;
  kind: LeadOwnerKind;
  currentOwnerId?: number | null;
  staff: CrmStaffRow[];
  onAssigned?: () => void | Promise<void>;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => staffForOwnerKind(staff, kind), [staff, kind]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = Number(toId);
    if (!Number.isFinite(next) || next <= 0) {
      onError?.('Chọn người nhận.');
      return;
    }
    if (currentOwnerId && next === currentOwnerId) {
      onError?.('Người này đang phụ trách.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'sales') {
        // Existing assign endpoint still works on the running API (pre-restart).
        await assignLead(token, leadId, { to_user_id: next, reason: 'thủ công' });
      } else {
        await reassignLeadOwner(token, leadId, { kind, to_staff_id: next, reason: 'thủ công' });
      }
      setOpen(false);
      setToId('');
      onMessage?.(`Đã phân công lại ${KIND_LABEL[kind]}.`);
      await onAssigned?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Phân công lại thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lead-owner-reassign" data-testid="lead-owner-reassign">
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-testid="lead-owner-reassign-open"
        onClick={() => setOpen(true)}
      >
        Phân công lại
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-reassign-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="lead-reassign-title">Phân công lại {KIND_LABEL[kind]}</h3>
            <form className="lead-form" onSubmit={(e) => void onSubmit(e)}>
              <label className="lead-field">
                <span className="lead-field__label">Nhân viên</span>
                <select className="lead-select" value={toId} onChange={(e) => setToId(e.target.value)} required>
                  <option value="">— Chọn —</option>
                  {options.map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">Lý do sẽ ghi là «thủ công».</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                  Đóng
                </button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !toId}>
                  {busy ? 'Đang phân…' : 'Phân công lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
