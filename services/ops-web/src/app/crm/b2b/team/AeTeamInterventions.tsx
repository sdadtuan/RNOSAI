'use client';

import { useEffect, useState } from 'react';
import { ApiError, postKanbanCall } from '@/lib/api';
import {
  fetchAeInterventions,
  fetchAeSuggest,
  fetchAeTeamLeads,
  postAeInstruction,
  postAeIntake,
  postAeReassign,
  postAeRemind,
  type AeInterventionItem,
  type AeSuggestRow,
} from '@/lib/crm/ae-team-api';
import type { AeTeamSortRow } from '@/lib/crm/ae-team-table.util';
import { kanbanColumnIdForStatus } from '@/lib/crm/lead-status';

const HOLDING = new Set(['moi', 'da_lien_he', 'dang_tu_van', 'bao_gia']);

function delayLabel(item: AeInterventionItem): string {
  if (item.delayUnit === 'days') return `${item.delay} ngày`;
  if (item.delayUnit === 'count') return `${item.delay} lần`;
  return `${item.delay} phút`;
}

export function AeTeamInterventions({
  token,
  preset,
  members,
  refreshKey = 0,
  onChanged,
}: {
  token: string;
  preset: string;
  members: AeTeamSortRow[];
  refreshKey?: number;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<AeInterventionItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [drawer, setDrawer] = useState<'move' | 'leave' | 'call' | 'note' | null>(null);
  const [targetId, setTargetId] = useState(0);
  const [reason, setReason] = useState('');
  const [split, setSplit] = useState('keep_first_touch');
  const [leaveId, setLeaveId] = useState(0);
  const [suggestions, setSuggestions] = useState<AeSuggestRow[]>([]);
  const [phone, setPhone] = useState('');
  const [callLeadId, setCallLeadId] = useState(0);

  async function reload(keepSelection = false) {
    const data = await fetchAeInterventions(token);
    setItems(data.items);
    if (!keepSelection) setSelected([]);
  }

  useEffect(() => {
    if (!token) return;
    reload(refreshKey > 0).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không tải được danh sách can thiệp'));
  }, [token, preset, refreshKey]);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const chosen = items.filter((item) => selected.includes(item.lead_id));
  const needsSplit = chosen.some((item) => item.requires_split);

  async function remind() {
    setError('');
    try {
      await postAeRemind(token, { lead_ids: selected, note });
      setNote('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không nhắc được');
    }
  }

  async function openMove() {
    setDrawer('move');
    setSuggestions([]);
    const first = selected[0];
    if (!first) return;
    try {
      const data = await fetchAeSuggest(token, first, preset);
      setSuggestions(data.suggestions);
      if (data.suggestions[0]) setTargetId(data.suggestions[0].staff_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gợi ý được AE');
    }
  }

  async function move(leadIds: number[]): Promise<boolean> {
    setError('');
    try {
      await postAeReassign(token, {
        lead_ids: leadIds,
        to_staff_id: targetId,
        reason,
        split: needsSplit || drawer === 'leave' ? split : undefined,
      });
      setDrawer(null);
      setReason('');
      await reload();
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không chuyển được');
      return false;
    }
  }

  async function leave() {
    const leads = await fetchAeTeamLeads(token, leaveId);
    const openIds = leads
      .filter((lead) => HOLDING.has(kanbanColumnIdForStatus(lead.status) ?? ''))
      .map((lead) => lead.id);
    if (!openIds.length) {
      setError('AE này không còn lead đang giữ.');
      return;
    }
    const moved = await move(openIds);
    if (!moved) return;
    await postAeIntake(token, { staff_id: leaveId, accepting: false, note: reason });
    onChanged();
  }

  async function saveNote() {
    const leadId = selected[0];
    if (!leadId) return;
    setError('');
    try {
      await postAeInstruction(token, { lead_id: leadId, note });
      setDrawer(null);
      setNote('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được ghi chú');
    }
  }

  async function startCall(leadId: number) {
    setCallLeadId(leadId);
    setPhone('');
    setDrawer('call');
    setError('');
    try {
      const started = await postKanbanCall(token, leadId, { phase: 'start' });
      setPhone(started.phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không mở được cuộc gọi');
    }
  }

  async function finishCall(result: 'answered' | 'no_answer' | 'wrong_number' | 'callback') {
    setError('');
    try {
      await postKanbanCall(token, callLeadId, { phase: 'result', result });
      setDrawer(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được kết quả gọi');
    }
  }

  return (
    <section className="ae-team-panel ae-team-queue">
      <header className="ae-team-panel-head">
        <div>
          <h2>Lead cần can thiệp</h2>
          <p>{items.length ? `${items.length} lead đang trễ nhịp.` : 'Không có lead trễ nhịp trong sổ đang giữ.'}</p>
        </div>
        <div className="ae-team-actions">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nội dung nhắc hoặc chỉ đạo" />
          <button type="button" className="btn btn-sm btn-primary" disabled={!selected.length || !note.trim()} onClick={() => void remind()}>Nhắc</button>
          <button type="button" className="btn btn-sm" disabled={!selected.length} onClick={() => void openMove()}>Chuyển</button>
          <button type="button" className="btn btn-sm" disabled={selected.length !== 1} onClick={() => setDrawer('note')}>Ghi chú</button>
          <button type="button" className="btn btn-sm" onClick={() => setDrawer('leave')}>Nghỉ phép</button>
        </div>
      </header>
      {error ? <p className="ae-team-error">{error}</p> : null}
      <div className="table-wrap">
        <table className="table ae-team-table">
          <thead>
            <tr>
              <th />
              <th>Lead</th>
              <th>AE</th>
              <th>Mã</th>
              <th>Trễ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6}>Không có lead cần can thiệp.</td></tr>
            ) : items.map((item) => (
              <tr key={item.lead_id}>
                <td><input type="checkbox" checked={selected.includes(item.lead_id)} onChange={() => toggle(item.lead_id)} /></td>
                <td>{item.name || `#${item.lead_id}`}</td>
                <td>{item.owner_name}</td>
                <td>{item.codes.join(', ')}</td>
                <td>{delayLabel(item)}</td>
                <td><button type="button" className="btn btn-sm" onClick={() => void startCall(item.lead_id)}>Gọi</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drawer ? (
        <div className="ae-team-drawer" role="presentation" onClick={() => setDrawer(null)}>
          <section onClick={(event) => event.stopPropagation()}>
            <h2>{drawer === 'call' ? 'Gọi' : drawer === 'leave' ? 'Nghỉ phép' : drawer === 'note' ? 'Ghi chú chỉ đạo' : 'Chuyển lead'}</h2>
            {drawer === 'call' ? (
              <>
                <p>{phone || 'Đang mở cuộc gọi…'}</p>
                <div className="ae-team-actions">
                  <button type="button" className="btn btn-sm" onClick={() => void finishCall('answered')}>Nghe máy</button>
                  <button type="button" className="btn btn-sm" onClick={() => void finishCall('no_answer')}>Không nghe</button>
                  <button type="button" className="btn btn-sm" onClick={() => void finishCall('wrong_number')}>Sai số</button>
                  <button type="button" className="btn btn-sm" onClick={() => void finishCall('callback')}>Hẹn lại</button>
                </div>
              </>
            ) : null}
            {drawer === 'note' ? (
              <>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
                <button type="button" className="btn btn-sm btn-primary" disabled={!note.trim()} onClick={() => void saveNote()}>Lưu</button>
              </>
            ) : null}
            {drawer === 'leave' || drawer === 'move' ? (
              <>
                {drawer === 'leave' ? (
                  <label>AE nghỉ
                    <select value={leaveId} onChange={(event) => setLeaveId(Number(event.target.value))}>
                      <option value={0}>Chọn AE</option>
                      {members.map((member) => <option key={member.staff_id} value={member.staff_id}>{member.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label>AE nhận
                  <select value={targetId} onChange={(event) => setTargetId(Number(event.target.value))}>
                    <option value={0}>Chọn AE</option>
                    {members.map((member) => <option key={member.staff_id} value={member.staff_id}>{member.name}</option>)}
                  </select>
                </label>
                {suggestions.length ? <p>Gợi ý: {suggestions.map((row) => `${row.name} ${row.score}`).join(' · ')}</p> : null}
                <label>Lý do
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
                </label>
                <label>Chia hoa hồng
                  <select value={split} onChange={(event) => setSplit(event.target.value)}>
                    <option value="keep_first_touch">Giữ người chạm đầu</option>
                    <option value="reset_closer">Đặt lại theo dự án</option>
                    <option value="no_split">Không chia lại</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!reason.trim() || (drawer === 'move' ? !targetId || !selected.length : !leaveId || !targetId)}
                  onClick={() => void (drawer === 'leave' ? leave() : move(selected))}
                >
                  Xác nhận
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={() => setDrawer(null)}>Đóng</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export async function toggleAeIntake(token: string, staffId: number, accepting: boolean) {
  await postAeIntake(token, { staff_id: staffId, accepting });
}
