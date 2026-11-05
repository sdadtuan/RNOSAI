'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRevopsTerritory, fetchRevopsTerritoryCenter } from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsTerritoryModal({
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
  const [type, setType] = useState('team');
  const [parentId, setParentId] = useState('');
  const [teamLabel, setTeamLabel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [parents, setParents] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setName('');
    setType('team');
    setParentId('');
    setTeamLabel('');
    setCapacity('');
    void fetchRevopsTerritoryCenter(token)
      .then((out) =>
        setParents(
          (out.territories ?? [])
            .filter((t) => t.type === 'region' || t.type === 'team')
            .map((t) => ({ id: t.id, name: t.name })),
        ),
      )
      .catch(() => setParents([]));
  }, [open, token]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      push('Tên territory là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRevopsTerritory(token, {
        name: name.trim(),
        type,
        parent_id: parentId.trim() || undefined,
        team_label: teamLabel.trim() || undefined,
        capacity: capacity.trim() ? Number(capacity) : undefined,
      });
      push('Territory đã được tạo', 'success');
      onCreated?.();
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được territory', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Territory"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-territory-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo territory'}
          </button>
        </>
      }
    >
      <form id="revops-territory-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên <span className="revops-req">*</span>
            </span>
            <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>Loại</span>
            <select value={type} onChange={(ev) => setType(ev.target.value)}>
              <option value="region">Region</option>
              <option value="team">Team</option>
              <option value="pod">Pod</option>
            </select>
          </label>
          <label className="revops-field">
            <span>Parent territory</span>
            <select value={parentId} onChange={(ev) => setParentId(ev.target.value)}>
              <option value="">— Không —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>Team label</span>
            <input value={teamLabel} onChange={(ev) => setTeamLabel(ev.target.value)} placeholder="Sales HN" />
          </label>
          <label className="revops-field">
            <span>Capacity (leads + accounts)</span>
            <input type="number" min={0} value={capacity} onChange={(ev) => setCapacity(ev.target.value)} />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}
