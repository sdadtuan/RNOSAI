'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  postIntakeSalesKit,
  type IntakeSalesKitOutput,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import type { SalesKitApplySelected } from '@/lib/crm/intake-sales-kit-apply';

const CHIPS: Array<{ intent: string; label: string }> = [
  { intent: 'next_question', label: 'Câu tiếp theo' },
  { intent: 'gap_to_go', label: 'Còn thiếu để Go' },
  { intent: 'win_intel', label: 'Win intel' },
  { intent: 'service_dive', label: 'Deep-dive dịch vụ' },
  { intent: 'summary_30s', label: 'Tóm tắt 30s' },
  { intent: 'red_flag', label: 'Red flag' },
  { intent: 'ask_library', label: 'Hỏi kho / Q&A' },
  { intent: 'pricing_band', label: 'Bảng giá / band' },
];

const BANT_HINT_LABELS: Record<string, string> = {
  budget: 'Budget',
  authority: 'Authority',
  need: 'Need',
  timeline: 'Timeline',
  fit: 'Fit',
  history: 'History',
};

const DEFAULT_SELECTED: SalesKitApplySelected & { summary: boolean } = {
  discovery: true,
  winIntel: true,
  summary: true,
  bantHints: false,
};

type KitCitation = {
  file_name: string;
  folder_path: string;
  excerpt: string;
};

function parseCitations(raw: unknown): KitCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: KitCitation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const file_name = String(row.file_name ?? '').trim();
    const folder_path = String(row.folder_path ?? '').trim();
    const excerpt = String(row.excerpt ?? '').trim();
    if (!file_name && !excerpt) continue;
    out.push({
      file_name: file_name || 'Nguồn',
      folder_path,
      excerpt: excerpt.length > 120 ? `${excerpt.slice(0, 120)}…` : excerpt,
    });
  }
  return out;
}

export type IntakeSalesKitPanelProps = {
  sessionId: number | null;
  canEdit: boolean;
  llmEnabled: boolean;
  sciExcerpt?: string | null;
  onApply: (
    apply: IntakeSalesKitOutput['apply'],
    selected: SalesKitApplySelected & { summary: boolean },
  ) => void | Promise<void>;
  onFocusTab?: (tab: 'discovery' | 'qualify' | 'win_intel') => void;
};

export function IntakeSalesKitPanel({
  sessionId,
  canEdit,
  llmEnabled,
  sciExcerpt,
  onApply,
  onFocusTab,
}: IntakeSalesKitPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [reply, setReply] = useState<IntakeSalesKitOutput | null>(null);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const [applying, setApplying] = useState(false);

  const citations = useMemo(() => parseCitations(reply?.citations), [reply]);
  const apply = reply?.apply;
  const hasApply =
    Boolean(apply?.discovery?.length) ||
    Boolean(apply?.win_intel && Object.keys(apply.win_intel).length) ||
    Boolean(apply?.ai_summary?.trim()) ||
    Boolean(apply?.bant_hints && Object.keys(apply.bant_hints).length);
  const canRun = Boolean(sessionId) && canEdit && !busy && !applying;
  const chatPlaceholder = activeIntent === 'ask_library' ? 'KH vừa nói…' : 'Hỏi kit…';

  async function runIntent(intent: string, text?: string) {
    if (!sessionId || !canEdit) return;
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập hết hạn');
      return;
    }
    setBusy(true);
    setError('');
    setActiveIntent(intent);
    try {
      const out = await postIntakeSalesKit(token, sessionId, {
        intent,
        message: text?.trim() || undefined,
      });
      setReply(out);
      setSelected({ ...DEFAULT_SELECTED });
      if (out.next_question?.tab) onFocusTab?.(out.next_question.tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sales Kit thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmApply() {
    if (!reply || !hasApply) return;
    setApplying(true);
    setError('');
    try {
      await onApply(reply.apply, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Áp dụng thất bại');
    } finally {
      setApplying(false);
    }
  }

  function onSubmitChat(event: FormEvent) {
    event.preventDefault();
    if (!llmEnabled) return;
    const text = message.trim();
    if (!text) return;
    void runIntent('freeform', text);
  }

  const sciLine = sciExcerpt?.trim() ?? '';

  return (
    <section className="intake-kit" aria-label="Sales Kit">
      <header className="intake-kit__head">
        <strong>Sales Kit</strong>
        {!sessionId ? <p className="muted">Tạo phiên để dùng kit.</p> : null}
      </header>

      {sciLine ? (
        <p className="intake-kit__sci">
          <span className="muted">Góc từ cuộc gọi đầu</span>
          {sciLine.length > 160 ? `${sciLine.slice(0, 160)}…` : sciLine}
        </p>
      ) : null}

      <div className="intake-kit__chips" role="group" aria-label="Chip Sales Kit">
        {CHIPS.map((chip) => (
          <button
            key={chip.intent}
            type="button"
            className={`btn btn-secondary btn-sm intake-kit__chip${
              activeIntent === chip.intent ? ' is-active' : ''
            }`}
            disabled={!canRun}
            onClick={() => void runIntent(chip.intent)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {busy ? <p className="muted">Đang hỏi kit…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {reply ? (
        <div className="intake-kit__reply">
          <p className="intake-kit__reply-text">{reply.reply_vi}</p>
          {reply.next_question ? (
            <p className="muted intake-kit__next">
              {reply.next_question.tab}: {reply.next_question.text}
            </p>
          ) : null}
          {reply.gap && reply.gap.to_go > 0 && activeIntent === 'gap_to_go' ? (
            <p className="muted">Còn {reply.gap.to_go} điểm · yếu: {reply.gap.weakest.join(', ') || '—'}</p>
          ) : null}

          {citations.length > 0 ? (
            <ul className="intake-kit__citations">
              {citations.map((cite, index) => (
                <li key={`${cite.file_name}-${index}`}>
                  <strong>Nguồn:</strong> {cite.file_name}
                  {cite.folder_path ? ` · ${cite.folder_path}` : ''}
                  {cite.excerpt ? ` — ${cite.excerpt}` : ''}
                </li>
              ))}
            </ul>
          ) : activeIntent === 'ask_library' || activeIntent === 'pricing_band' ? (
            <p className="muted">Chưa có file trong thư mục kho.</p>
          ) : null}

          {hasApply ? (
            <fieldset className="intake-kit__apply" disabled={applying || !canEdit}>
              <legend className="muted">Áp dụng vào form</legend>
              {apply?.discovery?.length ? (
                <label className="intake-kit__check">
                  <input
                    type="checkbox"
                    checked={selected.discovery}
                    onChange={(e) => setSelected((prev) => ({ ...prev, discovery: e.target.checked }))}
                  />
                  Discovery ({apply.discovery.length})
                </label>
              ) : null}
              {apply?.win_intel && Object.keys(apply.win_intel).length > 0 ? (
                <label className="intake-kit__check">
                  <input
                    type="checkbox"
                    checked={selected.winIntel}
                    onChange={(e) => setSelected((prev) => ({ ...prev, winIntel: e.target.checked }))}
                  />
                  Win intel
                </label>
              ) : null}
              {apply?.ai_summary?.trim() ? (
                <label className="intake-kit__check">
                  <input
                    type="checkbox"
                    checked={selected.summary}
                    onChange={(e) => setSelected((prev) => ({ ...prev, summary: e.target.checked }))}
                  />
                  Tóm tắt
                </label>
              ) : null}
              {apply?.bant_hints && Object.keys(apply.bant_hints).length > 0 ? (
                <label className="intake-kit__check">
                  <input
                    type="checkbox"
                    checked={selected.bantHints}
                    onChange={(e) => setSelected((prev) => ({ ...prev, bantHints: e.target.checked }))}
                  />
                  {Object.entries(apply.bant_hints)
                    .filter(([, value]) => Number.isFinite(Number(value)))
                    .map(([key, value]) => `Bot đề xuất ${BANT_HINT_LABELS[key] ?? key} ${value}/5 — Áp dụng?`)
                    .join(' · ')}
                </label>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={applying || !canEdit}
                onClick={() => void onConfirmApply()}
              >
                Áp dụng
              </button>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {llmEnabled ? (
        <form className="intake-kit__chat" onSubmit={onSubmitChat}>
          <label className="intake-field">
            <span className="muted">Chat</span>
            <textarea
              className="intake-kit__chat-input"
              rows={2}
              value={message}
              placeholder={chatPlaceholder}
              disabled={!canRun}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!canRun || !message.trim()}>
            Gửi
          </button>
        </form>
      ) : null}
    </section>
  );
}
