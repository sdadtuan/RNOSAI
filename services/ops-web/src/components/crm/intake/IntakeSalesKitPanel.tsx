'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  fetchIntakeSalesKitTurns,
  fetchSalesKitRuntime,
  postIntakeSalesKit,
  rateIntakeSalesKitTurn,
  type IntakeSalesKitOutput,
  type IntakeSalesKitTurnRow,
  type SalesKitRuntimeDto,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  chipUserLabel,
  composerIntent,
  kitBadge,
} from '@/lib/crm/intake-sales-kit-thread.util';
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

function parseApply(raw: unknown): IntakeSalesKitOutput['apply'] {
  if (!raw || typeof raw !== 'object') return {};
  return raw as IntakeSalesKitOutput['apply'];
}

export type IntakeSalesKitPanelProps = {
  sessionId: number | null;
  serviceSlug?: string | null;
  canEdit: boolean;
  sciExcerpt?: string | null;
  onApply: (
    apply: IntakeSalesKitOutput['apply'],
    selected: SalesKitApplySelected & { summary: boolean },
  ) => void | Promise<void>;
  onFocusTab?: (tab: 'discovery' | 'qualify' | 'win_intel') => void;
  embedded?: boolean;
};

export function IntakeSalesKitPanel({
  sessionId,
  serviceSlug,
  canEdit,
  sciExcerpt,
  onApply,
  onFocusTab,
  embedded = false,
}: IntakeSalesKitPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [turns, setTurns] = useState<IntakeSalesKitTurnRow[]>([]);
  const [runtime, setRuntime] = useState<SalesKitRuntimeDto | null>(null);
  const [lastOutput, setLastOutput] = useState<IntakeSalesKitOutput | null>(null);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const [applying, setApplying] = useState(false);
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !sessionId) {
      setTurns([]);
      return;
    }
    try {
      const out = await fetchIntakeSalesKitTurns(token, sessionId);
      setTurns(out.turns ?? []);
    } catch {
      setTurns([]);
    }
  }, [sessionId]);

  const loadRuntime = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const out = await fetchSalesKitRuntime(token);
      setRuntime(out);
    } catch {
      setRuntime({ mode: 'off', locked: false, healthy: true, hint_vi: 'Rules' });
    }
  }, []);

  useEffect(() => {
    void loadThread();
    void loadRuntime();
    setLastOutput(null);
    setActiveIntent(null);
    setMessage('');
    setError('');
  }, [sessionId, loadThread, loadRuntime]);

  const lastTurn = turns.length ? turns[turns.length - 1]! : null;
  const apply = lastOutput?.apply ?? parseApply(lastTurn?.apply_json);
  const citations = useMemo(
    () => parseCitations(lastOutput?.citations ?? lastTurn?.citations_json),
    [lastOutput, lastTurn],
  );
  const hasApply =
    Boolean(apply?.discovery?.length) ||
    Boolean(apply?.win_intel && Object.keys(apply.win_intel).length) ||
    Boolean(apply?.ai_summary?.trim()) ||
    Boolean(apply?.bant_hints && Object.keys(apply.bant_hints).length);
  const canRun = Boolean(sessionId) && canEdit && !busy && !applying;
  const badge = kitBadge({
    mode: runtime?.mode ?? 'off',
    stubMode: lastTurn?.stub_mode ?? true,
  });

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
        service_slug: serviceSlug?.trim() || undefined,
      });
      setLastOutput(out);
      setSelected({ ...DEFAULT_SELECTED });
      if (out.next_question?.tab) onFocusTab?.(out.next_question.tab);
      await loadThread();
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sales Kit thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRate(turnId: string, rating: 'up' | 'down') {
    const token = getAccessToken();
    if (!token) return;
    setRatingBusy(turnId);
    setError('');
    try {
      await rateIntakeSalesKitTurn(token, turnId, { rating });
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đánh giá thất bại');
    } finally {
      setRatingBusy(null);
    }
  }

  async function onConfirmApply() {
    if (!hasApply) return;
    setApplying(true);
    setError('');
    try {
      await onApply(apply, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Áp dụng thất bại');
    } finally {
      setApplying(false);
    }
  }

  function onSubmitChat(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const intent = composerIntent(activeIntent, text);
    void runIntent(intent, text);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const text = message.trim();
      if (!text || !canRun) return;
      const intent = composerIntent(activeIntent, text);
      void runIntent(intent, text);
    }
  }

  const sciLine = sciExcerpt?.trim() ?? '';

  const subtitleParts: string[] = [badge];
  if (runtime?.hint_vi) subtitleParts.push(runtime.hint_vi);

  return (
    <section
      className={`lmp-panel lmp-cockpit intake-kit${embedded ? ' intake-kit--embedded' : ''}`}
      aria-label="Sales Kit"
    >
      {!embedded ? (
        <header className="lmp-panel__head intake-kit__head">
          <div>
            <h2 className="lmp-panel__title">Sales Kit</h2>
            <p className="muted intake-kit__subtitle">
              {subtitleParts.join(' · ')}
              {!sessionId ? ' · Tạo phiên để dùng kit.' : ''}
            </p>
          </div>
        </header>
      ) : null}

      {embedded ? (
        <p className="muted intake-kit__subtitle intake-kit__subtitle--embedded">
          {subtitleParts.join(' · ')}
          {!sessionId ? ' · Tạo phiên để dùng kit.' : ''}
        </p>
      ) : null}

      {sciLine ? (
        <p className="intake-kit__sci">
          <span className="muted">Góc từ cuộc gọi đầu</span>
          {sciLine.length > 160 ? `${sciLine.slice(0, 160)}…` : sciLine}
        </p>
      ) : null}

      <nav className="intake-kit__chips" aria-label="Chip Sales Kit">
        {CHIPS.map((chip) => (
          <button
            key={chip.intent}
            type="button"
            className={`intake-kit__chip${activeIntent === chip.intent ? ' is-active' : ''}`}
            disabled={!canRun}
            onClick={() => void runIntent(chip.intent)}
          >
            {chip.label}
          </button>
        ))}
      </nav>

      <div className="lmp-cockpit-body intake-kit__body">
        <div className="intake-kit__thread" aria-live="polite">
          {turns.length === 0 && !busy ? (
            <p className="muted intake-kit__empty">Chọn chip hoặc gõ câu hỏi để bắt đầu.</p>
          ) : null}
          {turns.map((turn) => {
            const userLabel = chipUserLabel(turn.intent, turn.user_text);
            const turnCitations = parseCitations(turn.citations_json);
            return (
              <div key={turn.id} className="intake-kit__turn">
                <div className="intake-kit__bubble intake-kit__bubble--user">
                  <span className="muted">{userLabel}</span>
                </div>
                <div className="intake-kit__bubble intake-kit__bubble--assistant">
                  <p className="intake-kit__reply-text">{turn.reply_vi}</p>
                  {turnCitations.length > 0 ? (
                    <ul className="intake-kit__citations">
                      {turnCitations.map((cite, index) => (
                        <li key={`${cite.file_name}-${index}`}>
                          <strong>Nguồn:</strong> {cite.file_name}
                          {cite.folder_path ? ` · ${cite.folder_path}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="intake-kit__rate">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!canEdit || turn.rating != null || ratingBusy === turn.id}
                      onClick={() => void onRate(turn.id, 'up')}
                      aria-label="Hữu ích"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!canEdit || turn.rating != null || ratingBusy === turn.id}
                      onClick={() => void onRate(turn.id, 'down')}
                      aria-label="Chưa ổn"
                    >
                      👎
                    </button>
                    {turn.rating ? <span className="muted">Đã đánh giá</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
          {busy ? <p className="muted">Đang hỏi kit…</p> : null}
        </div>

        {error ? <p className="error">{error}</p> : null}

        {hasApply && lastTurn ? (
          <fieldset className="intake-kit__apply" disabled={applying || !canEdit}>
            <legend className="muted">Áp dụng vào form (lượt cuối)</legend>
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

      <footer className="lmp-cockpit-foot intake-kit__foot">
        <form className="intake-kit__chat" onSubmit={onSubmitChat}>
          <label className="intake-field">
            <span className="muted">Chat</span>
            <textarea
              className="intake-kit__chat-input"
              rows={3}
              value={message}
              placeholder="Hỏi kit hoặc gõ điều KH vừa nói…"
              disabled={!canRun}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
          </label>
        </form>
        <p className="muted intake-kit__footer">Nội bộ — không gửi khách</p>
      </footer>
    </section>
  );
}
