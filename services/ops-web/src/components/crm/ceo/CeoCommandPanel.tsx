'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  commitCeoAction,
  fetchCeoContext,
  fetchCeoTurns,
  postCeoTurn,
  rateCeoTurn,
  type CeoTurnOutput,
  type CeoTurnRow,
} from '@/lib/api';
import { CeoActionConfirmDialog } from '@/components/crm/ceo/CeoActionConfirmDialog';
import { CeoBriefingInbox } from '@/components/crm/ceo/CeoBriefingInbox';
import { confirmCopy } from '@/lib/crm/ceo-command-confirm.util';
import { rowsToTable, sparkPoints } from '@/lib/crm/ceo-command-nl-render.util';
import {
  CHIPS_A,
  CHIPS_B,
  ceoBadge,
  ceoCommandErrorMessage,
  isBriefingIntent,
  parseCards,
} from '@/lib/crm/ceo-command-thread.util';

type TurnBubble = {
  role: 'user' | 'assistant';
  text: string;
  turnId?: string | null;
  output?: CeoTurnOutput;
};

export type CeoCommandPanelProps = {
  token: string;
  staffName?: string;
};

export function CeoCommandPanel({ token, staffName }: CeoCommandPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [threadId, setThreadId] = useState('');
  const [bubbles, setBubbles] = useState<TurnBubble[]>([]);
  const [context, setContext] = useState<{
    llm_enabled: boolean;
    can_act: boolean;
  } | null>(null);
  const [confirmTurn, setConfirmTurn] = useState<CeoTurnOutput | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);
  const autoBriefRef = useRef(false);

  const loadContext = useCallback(async () => {
    try {
      const out = await fetchCeoContext(token);
      setContext({ llm_enabled: out.llm_enabled, can_act: out.can_act });
    } catch {
      setContext({ llm_enabled: false, can_act: false });
    }
  }, [token]);

  const loadThread = useCallback(async () => {
    try {
      const out = await fetchCeoTurns(token, threadId);
      const turns = out.turns ?? [];
      const mapped: TurnBubble[] = [];
      for (const t of turns) {
        if (t.user_text) mapped.push({ role: 'user', text: t.user_text, turnId: t.id });
        mapped.push({
          role: 'assistant',
          text: t.reply_vi,
          turnId: t.id,
          output: {
            turn_id: t.id,
            thread_id: t.thread_id,
            intent: t.intent,
            reply_vi: t.reply_vi,
            stub_mode: t.stub_mode,
            model_name: t.model_name,
            facts_json: t.facts_json ?? {},
            citations: t.citations_json ?? [],
            cards: t.cards_json ?? [],
            degraded: t.degraded_json ?? [],
            proposed_action: t.proposed_action_json as CeoTurnOutput['proposed_action'],
            rows: (t.facts_json as { rows?: unknown[] })?.rows,
            result_kind: undefined,
          },
        });
      }
      setBubbles(mapped);
    } catch {
      setBubbles([]);
    }
  }, [token, threadId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!threadId) return;
    void loadThread();
  }, [threadId, loadThread]);

  const sendTurn = useCallback(
    async (body: {
      intent: string;
      message?: string;
      intent_id?: string;
      action_id?: string;
      params?: Record<string, unknown>;
    }) => {
      setBusy(true);
      setError('');
      try {
        if (body.message) {
          setBubbles((prev) => [...prev, { role: 'user', text: body.message! }]);
        }
        const out = await postCeoTurn(token, { ...body, thread_id: threadId || undefined });
        if (out.thread_id) setThreadId(out.thread_id);
        setBubbles((prev) => [
          ...prev,
          { role: 'assistant', text: out.reply_vi, turnId: out.turn_id, output: out },
        ]);
      } catch (e) {
        setError(ceoCommandErrorMessage(String((e as Error).message ?? 'Lỗi gửi lượt')));
      } finally {
        setBusy(false);
      }
    },
    [token, threadId],
  );

  useEffect(() => {
    if (!token || autoBriefRef.current) return;
    autoBriefRef.current = true;
    void sendTurn({ intent: 'briefing_today' });
  }, [token, sendTurn]);

  const lastStub = useMemo(() => {
    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      if (b?.role === 'assistant' && b.output) return b.output.stub_mode;
    }
    return true;
  }, [bubbles]);

  const badge = ceoBadge({
    llmEnabled: Boolean(context?.llm_enabled),
    stubMode: lastStub,
  });

  const latestBriefing = useMemo(() => {
    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      if (b?.role !== 'assistant' || !b.output) continue;
      if (!isBriefingIntent(b.output.intent)) continue;
      return {
        intent: b.output.intent,
        summary: b.text,
        cards: parseCards(b.output.cards),
        turnId: b.turnId,
      };
    }
    return null;
  }, [bubbles]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setMessage('');
    void sendTurn({ intent: 'freeform', message: text });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }

  async function onConfirm() {
    if (!confirmTurn?.turn_id || !idempotencyKey) return;
    setBusy(true);
    setError('');
    try {
      await commitCeoAction(token, {
        turn_id: confirmTurn.turn_id,
        idempotency_key: idempotencyKey,
      });
      setConfirmTurn(null);
      await loadThread();
    } catch (e) {
      setError(ceoCommandErrorMessage(String((e as Error).message ?? 'Commit thất bại')));
    } finally {
      setBusy(false);
    }
  }

  async function onRate(turnId: string, rating: 'up' | 'down') {
    setRatingBusy(turnId);
    try {
      await rateCeoTurn(token, turnId, rating);
    } finally {
      setRatingBusy(null);
    }
  }

  function openConfirm(output: CeoTurnOutput) {
    setConfirmTurn(output);
    setIdempotencyKey(crypto.randomUUID());
  }

  const chatBubbles = useMemo(
    () =>
      bubbles.filter((b) => {
        if (b.role !== 'assistant' || !b.output) return true;
        return !isBriefingIntent(b.output.intent);
      }),
    [bubbles],
  );

  return (
    <div className="ceo-command-panel stack-gap">
      <header className="ceo-command-header">
        <div>
          <h2 className="ceo-command-header__title">Điều hành RNOSAI</h2>
          <p className="ceo-command-header__meta">
            {staffName ?? 'GDKD'} · nguồn <span className="ceo-command-badge">{badge}</span>
            {badge === 'Stub' ? (
              <span className="ceo-command-header__hint">
                {' '}
                — số liệu thật từ DB, chưa có LLM tóm tắt
              </span>
            ) : null}
          </p>
        </div>
        <Link href="/crm/ceo/learn" className="btn btn-sm btn-secondary">
          Kho Learn
        </Link>
      </header>

      {latestBriefing ? (
        <CeoBriefingInbox
          intent={latestBriefing.intent}
          summary={latestBriefing.summary}
          cards={latestBriefing.cards}
          turnId={latestBriefing.turnId}
          ratingBusy={ratingBusy}
          onRate={(turnId, rating) => void onRate(turnId, rating)}
        />
      ) : null}

      <div className="ceo-command-layout">
        <div className="ceo-command-chat page-card">
          <h3 className="ceo-command-chat__title">Hỏi số &amp; hành động</h3>
          <div className="ceo-command-chat__thread">
            {chatBubbles.length === 0 ? (
              <p className="muted">Gõ câu hỏi hoặc bấm chip bên phải để tra số.</p>
            ) : (
              chatBubbles.map((b, idx) => (
                <div
                  key={`${b.turnId ?? idx}-${b.role}`}
                  className={`ceo-command-bubble ceo-command-bubble--${b.role}`}
                >
                  <div className="ceo-command-bubble__body">
                    {b.text}
                    {b.role === 'assistant' && b.output ? (
                      <>
                        {b.output.rows?.length ? (
                          <div className="ceo-command-table-wrap">
                            <table className="data-table data-table--compact">
                              <tbody>
                                {rowsToTable(b.output.rows).map((row, ri) => (
                                  <tr key={ri}>
                                    {Object.entries(row).map(([k, v]) => (
                                      <td key={k}>
                                        <span className="muted">{k}: </span>
                                        {v}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {b.output.drill_href ? (
                              <Link href={b.output.drill_href} className="ceo-command-drill">
                                Xem đầy đủ →
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                        {b.output.result_kind === 'chart' &&
                        Array.isArray(
                          (b.output.facts_json as { chart?: { series?: Array<{ values?: number[] }> } })
                            ?.chart?.series,
                        ) ? (
                          <svg width={120} height={32} className="ceo-command-spark">
                            <polyline
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              points={sparkPoints(
                                ((b.output.facts_json as { chart?: { series?: Array<{ values?: number[] }> } })
                                  .chart?.series?.[0]?.values ?? []) as number[],
                              )}
                            />
                          </svg>
                        ) : null}
                        {b.output.proposed_action?.can_confirm ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => openConfirm(b.output!)}
                          >
                            Xác nhận
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={onSubmit} className="ceo-command-compose">
            <textarea
              className="ceo-command-compose__input"
              rows={2}
              placeholder="Hỏi số, gõ việc cần làm, hoặc bấm chip bên phải…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
            <p className="ceo-command-compose__hint">Nội bộ — không gửi khách</p>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>

        <aside className="ceo-command-sidebar">
          <div className="page-card ceo-command-chip-panel">
            <h3 className="ceo-command-chip-panel__title">Briefing</h3>
            <div className="ceo-command-chips">
              {CHIPS_A.map((c) => (
                <button
                  key={c.intent}
                  type="button"
                  className="btn btn-xs btn-secondary"
                  disabled={busy}
                  onClick={() => void sendTurn({ intent: c.intent })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="page-card ceo-command-chip-panel">
            <h3 className="ceo-command-chip-panel__title">Số liệu</h3>
            <div className="ceo-command-chips">
              {CHIPS_B.map((c) => (
                <button
                  key={c.intent_id}
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={busy}
                  onClick={() => void sendTurn({ intent: 'nl_query', intent_id: c.intent_id })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {confirmTurn?.proposed_action ? (
        <CeoActionConfirmDialog
          copy={confirmCopy(confirmTurn.proposed_action)}
          busy={busy}
          onCancel={() => setConfirmTurn(null)}
          onConfirm={() => void onConfirm()}
        />
      ) : null}
    </div>
  );
}
