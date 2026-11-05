'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAmAiDraft,
  postAmAiFeedback,
  type AmAiDraft,
  type AmAiKind,
} from '@/lib/crm/am-api';
import {
  AM_AI_MODES,
  AM_AI_PROPOSAL_LABEL,
  amAiCreateDraftAction,
  amAiCreateTaskAction,
  type AmAiOpenFormAction,
} from '@/lib/crm/am-ai.util';

type AmAiDrawerProps = {
  agencyClientId: string;
  token: string;
  onClose: () => void;
  onOpenForm: (action: AmAiOpenFormAction) => void;
};

export function AmAiDrawer({ agencyClientId, token, onClose, onOpenForm }: AmAiDrawerProps) {
  const [kind, setKind] = useState<AmAiKind>('summary');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AmAiDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rated, setRated] = useState<'up' | 'down' | ''>('');
  const [confirmed, setConfirmed] = useState(false);

  async function onGenerate() {
    if (busy) return;
    setBusy(true);
    setError('');
    setRated('');
    setConfirmed(false);
    try {
      const out = await createAmAiDraft(token, {
        agency_client_id: agencyClientId,
        kind,
        prompt: prompt.trim() || undefined,
      });
      setResult(out);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Không tạo được draft');
    } finally {
      setBusy(false);
    }
  }

  function openExistingForm(action: AmAiOpenFormAction) {
    setConfirmed(true);
    onOpenForm(action);
  }

  async function onRate(rating: 'up' | 'down') {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    try {
      await postAmAiFeedback(token, { draft_id: result.draft_id, kind, rating });
      setRated(rating);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được phản hồi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="am-drawer-bg"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div className="am-drawer" role="dialog" aria-modal="true" aria-label="Hỏi AI">
        <div className="am-drawer__head">
          <strong>Hỏi AI</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className="am-form">
          <label className="am-field">
            <span>Chế độ</span>
            <select value={kind} onChange={(ev) => setKind(ev.target.value as AmAiKind)}>
              {AM_AI_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="am-field">
            <span>Prompt (tuỳ chọn)</span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(ev) => setPrompt(ev.target.value)}
              placeholder="Thêm ngữ cảnh cho draft"
            />
          </label>
          <div className="am-form__actions">
            <button type="button" className="am-btn am-btn--primary" disabled={busy} onClick={() => void onGenerate()}>
              {busy ? 'Đang soạn…' : 'Soạn draft'}
            </button>
          </div>
          {error ? <p className="am-banner">{error}</p> : null}
          {result ? (
            <div className="am-ai-result">
              {confirmed ? null : <p className="am-ai-label">{AM_AI_PROPOSAL_LABEL}</p>}
              <p className="am-ai-draft">{result.draft}</p>
              <pre className="am-ai-evidence">{JSON.stringify(result.evidence, null, 2)}</pre>
              <div className="am-form__actions">
                <button
                  type="button"
                  className="am-btn"
                  disabled={busy}
                  onClick={() => openExistingForm(amAiCreateTaskAction(result))}
                >
                  Tạo việc
                </button>
                <button
                  type="button"
                  className="am-btn"
                  disabled={busy}
                  onClick={() => openExistingForm(amAiCreateDraftAction(kind, result))}
                >
                  Tạo draft
                </button>
                <button
                  type="button"
                  className="am-btn"
                  disabled={busy || rated === 'up'}
                  title="Hữu ích"
                  onClick={() => void onRate('up')}
                >
                  👍
                </button>
                <button
                  type="button"
                  className="am-btn"
                  disabled={busy || rated === 'down'}
                  title="Chưa hữu ích"
                  onClick={() => void onRate('down')}
                >
                  👎
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
