'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  assignLead,
  fetchCrmStaffList,
  fetchLeads,
  type CrmStaffRow,
  type LeadRow,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';
import { leadOptionLabel, suggestAssignees } from '../revops-modal.util';

export type RevOpsAssignContext = {
  leadId?: number;
  leadIds?: number[];
  leadLabel?: string;
};

export function RevOpsAssignModal({
  open,
  token,
  context,
  onClose,
  onAssigned,
}: {
  open: boolean;
  token: string;
  context: RevOpsAssignContext | null;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const { push } = useToast();
  const [staff, setStaff] = useState<CrmStaffRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadId, setLeadId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const bulkLeadIds = context?.leadIds?.filter((id) => id > 0) ?? [];
  const selectedLeadId = context?.leadId ?? (leadId ? Number(leadId) : 0);
  const assignLeadIds =
    bulkLeadIds.length > 0 ? bulkLeadIds : selectedLeadId > 0 ? [selectedLeadId] : [];
  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  const leadLabel =
    context?.leadLabel ??
    (bulkLeadIds.length > 1
      ? `${bulkLeadIds.length} leads đã chọn`
      : selectedLead
        ? selectedLead.full_name
        : selectedLeadId > 0
          ? `Lead #${selectedLeadId}`
          : '—');

  const suggestions = useMemo(
    () => suggestAssignees(staff, selectedLeadId || 1, 3),
    [staff, selectedLeadId],
  );

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    void Promise.all([
      fetchCrmStaffList(token).catch(() => ({ staff: [], summary: {} })),
      fetchLeads(token, { limit: 30, unassigned_only: true, lead_flow_kind: 'b2b_prospect' }).catch(() => ({
        leads: [],
        total: 0,
        limit: 0,
        offset: 0,
      })),
    ])
      .then(([staffOut, leadsOut]) => {
        setStaff(staffOut.staff ?? []);
        setLeads(leadsOut.leads ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setReason('');
    if (context?.leadId) setLeadId(String(context.leadId));
    else setLeadId('');
  }, [open, context?.leadId]);

  async function assignTo(staffRow: CrmStaffRow, suggestionIndex: number) {
    if (saving || assignLeadIds.length === 0) {
      push('Chọn lead cần phân bổ trước', 'error');
      return;
    }
    setSaving(true);
    try {
      for (const id of assignLeadIds) {
        await assignLead(token, id, {
          to_user_id: staffRow.id,
          reason: reason.trim() || `Routing engine suggestion #${suggestionIndex + 1}`,
        });
      }
      push(
        assignLeadIds.length > 1
          ? `Đã phân ${assignLeadIds.length} leads cho ${staffRow.name}.`
          : `Đã phân lead cho ${staffRow.name}.`,
        'success',
      );
      onAssigned?.();
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không phân bổ được lead', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Phân bổ Lead"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
          Hủy
        </button>
      }
    >
      {loading ? <p className="revops-muted">Đang tải…</p> : null}
      {!context?.leadId && bulkLeadIds.length === 0 ? (
        <label className="revops-field revops-field--full">
          <span>
            Lead <span className="revops-req">*</span>
          </span>
          <select value={leadId} onChange={(ev) => setLeadId(ev.target.value)}>
            <option value="">Chọn lead chưa gán</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {leadOptionLabel(lead)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="revops-widget">
        <b>Lead: {leadLabel}</b>
        {selectedLead ? (
          <p className="revops-sub">
            {[selectedLead.source, selectedLead.status, selectedLead.ai_band?.toUpperCase()]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
      <h3 className="revops-modal__section">Gợi ý phân bổ (W1)</h3>
      <div className="revops-list">
        {suggestions.map((row, idx) => (
          <div key={row.id} className="revops-list-row">
            <div>
              <b>
                {idx + 1}. {row.name}
              </b>
              <p className="revops-sub">
                {row.department || 'Sales'} · Round-robin · {row.email}
              </p>
            </div>
            <button
              type="button"
              className={`revops-btn${idx === 0 ? ' revops-btn--primary' : ''}`}
              disabled={saving || assignLeadIds.length === 0}
              onClick={() => void assignTo(row, idx)}
            >
              Giao lead
            </button>
          </div>
        ))}
        {suggestions.length === 0 && !loading ? (
          <p className="revops-muted">Không có nhân sự nhận lead.</p>
        ) : null}
      </div>
      <label className="revops-field revops-field--full">
        <span>Lý do override (bắt buộc nếu không chọn gợi ý)</span>
        <textarea
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
          placeholder="Nhập lý do điều phối thủ công..."
          rows={3}
        />
      </label>
    </RevOpsModalFrame>
  );
}
