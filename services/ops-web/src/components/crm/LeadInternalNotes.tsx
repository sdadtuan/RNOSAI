'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addLeadInternalNote,
  fetchLeadInternalNotes,
  type LeadActivityRow,
} from '@/lib/api';
import { formatHandoffStamp } from '@/lib/crm/handoff-flow.util';

export function LeadInternalNotes({
  token,
  leadId,
  onMessage,
  onError,
  compact = false,
  title = 'Ghi chú nội bộ',
  sectionTestId = 'ahd-notes',
  inputTestId = 'ahd-internal-input',
}: {
  token: string;
  leadId: number;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  compact?: boolean;
  title?: string;
  sectionTestId?: string;
  inputTestId?: string;
}) {
  const [notes, setNotes] = useState<LeadActivityRow[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await fetchLeadInternalNotes(token, leadId);
      setNotes(rows);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không tải được ghi chú nội bộ.');
    }
  }, [token, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const rows = await addLeadInternalNote(token, leadId, content);
      setNotes(rows);
      setText('');
      onMessage?.('Đã lưu ghi chú nội bộ. Các thành viên liên quan sẽ được thông báo.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không lưu được ghi chú nội bộ.';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ahd-card lin-notes" data-testid={sectionTestId}>
      <h3 className="ahd-card__title">{title}</h3>
      <p className="lin-notes__hint muted">Chỉ nhân sự nội bộ (Sales, AM, Marketing, CEO) thấy ghi chú này. Các thành viên đang tham gia lead sẽ được thông báo.</p>
      <div className="ahd-note-form">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ghi chú nội bộ cho team…"
          rows={compact ? 3 : 4}
          data-testid={inputTestId}
          disabled={busy}
        />
        <button
          type="button"
          className="ahd-btn ahd-btn--primary"
          data-testid="lin-send"
          onClick={() => void save()}
          disabled={busy || text.trim().length < 2}
        >
          {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
        </button>
      </div>
      {loadError ? <p className="ahd-empty">{loadError}</p> : null}
      {notes.length ? (
        <div className="ahd-history" style={{ marginTop: 12 }} data-testid="lin-list">
          {notes.map((note) => (
            <div className="ahd-history__item" key={note.id} data-testid="lin-item">
              {note.created_at ? (
                <time dateTime={note.created_at}>{formatHandoffStamp(note.created_at)}</time>
              ) : null}
              <p className="ahd-prose">
                <strong>{note.user_name || note.created_by || 'Nhân sự'}: </strong>
                {note.content}
              </p>
            </div>
          ))}
        </div>
      ) : !loadError ? (
        <p className="ahd-empty" style={{ marginTop: 10 }}>
          Chưa có ghi chú nội bộ. Ghi chú được lưu trên máy chủ và các thành viên liên quan sẽ nhận thông báo.
        </p>
      ) : null}
    </section>
  );
}
