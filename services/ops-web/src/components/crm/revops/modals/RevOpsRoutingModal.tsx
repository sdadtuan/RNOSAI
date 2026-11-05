'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createRevopsRoutingRule,
  publishRevopsRoutingRule,
  simulateRevopsRouting,
} from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsRoutingModal({
  open,
  token,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('100');
  const [method, setMethod] = useState('round_robin');
  const [leadId, setLeadId] = useState('');
  const [lastRuleId, setLastRuleId] = useState('');
  const [simulateOut, setSimulateOut] = useState<Array<{ staffId: number; name: string; score: number; ruleName: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPriority('100');
    setMethod('round_robin');
    setLeadId('');
    setLastRuleId('');
    setSimulateOut([]);
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      push('Tên rule là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      const rule = await createRevopsRoutingRule(token, {
        name: name.trim(),
        priority: Number(priority) || 100,
        method,
      });
      setLastRuleId(rule.id);
      push('Routing rule đã được tạo (draft)', 'success');
      onCreated?.();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được rule', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!lastRuleId) {
      push('Tạo rule trước khi publish', 'error');
      return;
    }
    setSaving(true);
    try {
      await publishRevopsRoutingRule(token, lastRuleId);
      push('Rule đã publish', 'success');
      onCreated?.();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không publish được rule', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onSimulate() {
    const id = Number(leadId);
    try {
      const out = await simulateRevopsRouting(token, Number.isFinite(id) && id > 0 ? id : undefined);
      setSimulateOut(out.rankedOwners ?? []);
    } catch {
      setSimulateOut([]);
      push('Simulate thất bại', 'error');
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Routing Rule"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          {lastRuleId ? (
            <button type="button" className="revops-btn revops-btn--primary" onClick={() => void onPublish()} disabled={saving}>
              Publish
            </button>
          ) : null}
          <button type="submit" form="revops-routing-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo rule'}
          </button>
        </>
      }
    >
      <form id="revops-routing-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên <span className="revops-req">*</span>
            </span>
            <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>Priority</span>
            <input type="number" min={1} value={priority} onChange={(ev) => setPriority(ev.target.value)} />
          </label>
          <label className="revops-field">
            <span>Method</span>
            <select value={method} onChange={(ev) => setMethod(ev.target.value)}>
              <option value="round_robin">Round robin</option>
              <option value="capacity">Capacity balance</option>
              <option value="named_account">Named account</option>
              <option value="territory">Territory match</option>
            </select>
          </label>
        </div>
      </form>
      <div className="revops-inline-form" style={{ marginTop: '1rem' }}>
        <input value={leadId} onChange={(ev) => setLeadId(ev.target.value)} placeholder="Lead ID simulate" />
        <button type="button" className="revops-btn" onClick={() => void onSimulate()}>
          Simulate
        </button>
      </div>
      {simulateOut.length > 0 ? (
        <ol className="revops-list" style={{ marginTop: '0.75rem' }}>
          {simulateOut.map((o) => (
            <li key={o.staffId}>
              {o.name} — score {o.score} · {o.ruleName}
            </li>
          ))}
        </ol>
      ) : null}
    </RevOpsModalFrame>
  );
}
