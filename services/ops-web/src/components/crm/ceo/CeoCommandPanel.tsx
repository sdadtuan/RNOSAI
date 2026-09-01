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
import { confirmCopy } from '@/lib/crm/ceo-command-confirm.util';
import { rowsToTable, sparkPoints } from '@/lib/crm/ceo-command-nl-render.util';
import {
  CHIPS_A,
  CHIPS_B,
  ceoBadge,
  parseCards,
  type CeoBriefingCard,
} from '@/lib/crm/ceo-command-thread.util';

type TurnBubble = {
  role: 'user' | 'assistant';
  text: string;
  turnId?: string | null;
  output?: CeoTurnOutput;
};

function severityClass(sev: CeoBriefingCard['severity']): string {
  if (sev === 'red') return 'badge badge-error';
  if (sev === 'amber') return 'badge badge-warning';
  return 'badge badge-success';
}

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
        setError(String((e as Error).message ?? 'Lỗi gửi lượt'));
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
      setError(String((e as Error).message ?? 'Commit thất bại'));
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

  return (
    <div className="ceo-command-panel stack-gap">
      <header className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h2 className="text-lg font-semibold">Điều hành RNOSAI</h2>
          <p className="muted text-sm">{staffName ?? 'GDKD'} · badge {badge}</p>
        </div>
        <Link href="/crm/ceo/learn" className="btn btn-sm btn-ghost">
          Kho Learn
        </Link>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 page-card p-4 min-h-[420px] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {bubbles.map((b, idx) => (
              <div
                key={`${b.turnId ?? idx}-${b.role}`}
                className={b.role === 'user' ? 'text-right' : 'text-left'}
              >
                <div
                  className={`inline-block max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    b.role === 'user' ? 'bg-primary/10' : 'bg-base-200'
                  }`}
                >
                  {b.text}
                  {b.role === 'assistant' && b.output ? (
                    <>
                      {parseCards(b.output.cards).map((card) => (
                        <div key={`${card.title}-${card.href}`} className="mt-2 p-2 border rounded text-left">
                          <span className={severityClass(card.severity)}>{card.severity}</span>{' '}
                          <Link href={card.href} className="link link-primary">
                            {card.title}
                          </Link>
                          {card.metric ? <div className="muted text-xs">{card.metric}</div> : null}
                        </div>
                      ))}
                      {b.output.rows?.length ? (
                        <div className="mt-2 overflow-x-auto">
                          <table className="table table-xs">
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
                            <Link href={b.output.drill_href} className="link text-xs">
                              Xem đầy đủ
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {b.output.result_kind === 'chart' &&
                      Array.isArray((b.output.facts_json as { chart?: { series?: Array<{ values?: number[] }> } })?.chart?.series) ? (
                        <svg width={120} height={32} className="mt-2">
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
                          className="btn btn-xs btn-primary mt-2"
                          onClick={() => openConfirm(b.output!)}
                        >
                          Xác nhận
                        </button>
                      ) : null}
                      {b.turnId ? (
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            disabled={ratingBusy === b.turnId}
                            onClick={() => void onRate(b.turnId!, 'up')}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            disabled={ratingBusy === b.turnId}
                            onClick={() => void onRate(b.turnId!, 'down')}
                          >
                            👎
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="border-t pt-3">
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={2}
              placeholder="Hỏi số, gõ việc cần làm, hoặc bấm Hôm nay…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
            <p className="muted text-xs mt-1">Nội bộ — không gửi khách</p>
          </form>
          {error ? <p className="error text-sm mt-2">{error}</p> : null}
        </div>

        <div className="xl:col-span-2 space-y-3">
          <div className="page-card p-3">
            <h3 className="font-medium text-sm mb-2">Briefing</h3>
            <div className="flex flex-wrap gap-1">
              {CHIPS_A.map((c) => (
                <button
                  key={c.intent}
                  type="button"
                  className="btn btn-xs btn-outline"
                  disabled={busy}
                  onClick={() => void sendTurn({ intent: c.intent })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="page-card p-3">
            <h3 className="font-medium text-sm mb-2">Số liệu</h3>
            <div className="flex flex-wrap gap-1">
              {CHIPS_B.map((c) => (
                <button
                  key={c.intent_id}
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void sendTurn({ intent: 'nl_query', intent_id: c.intent_id })
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
