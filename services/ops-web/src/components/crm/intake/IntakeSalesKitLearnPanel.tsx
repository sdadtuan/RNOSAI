'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  approveSalesKitLearnCandidate,
  fetchSalesKitDownTurns,
  fetchSalesKitLearnCandidates,
  fetchSalesKitLearnMetrics,
  proposeSalesKitLearnFromTurn,
  rejectSalesKitLearnCandidate,
  type IntakeSalesKitTurnRow,
  type SalesKitLearnCandidateRow,
} from '@/lib/api';

export type IntakeSalesKitLearnPanelProps = {
  token: string;
};

export function IntakeSalesKitLearnPanel({ token }: IntakeSalesKitLearnPanelProps) {
  const [candidates, setCandidates] = useState<SalesKitLearnCandidateRow[]>([]);
  const [downTurns, setDownTurns] = useState<IntakeSalesKitTurnRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [cand, down, met] = await Promise.all([
        fetchSalesKitLearnCandidates(token),
        fetchSalesKitDownTurns(token, 30),
        fetchSalesKitLearnMetrics(token),
      ]);
      setCandidates(cand.candidates ?? []);
      setDownTurns(down.turns ?? []);
      setMetrics(met);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải vòng nuôi thất bại');
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onPropose(turnId: string) {
    setBusy(true);
    setError('');
    try {
      await proposeSalesKitLearnFromTurn(token, turnId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đề xuất thất bại');
      setBusy(false);
    }
  }

  async function onApprove(id: string) {
    setBusy(true);
    setError('');
    try {
      await approveSalesKitLearnCandidate(token, id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
      setBusy(false);
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt('Lý do từ chối (≥3 ký tự):')?.trim() ?? '';
    if (reason.length < 3) return;
    setBusy(true);
    setError('');
    try {
      await rejectSalesKitLearnCandidate(token, id, reason);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối thất bại');
      setBusy(false);
    }
  }

  return (
    <div className="sales-kit-learn">
      <header className="sales-kit-learn__head">
        <Link href="/crm/intake/sales-kit" className="btn btn-secondary btn-sm">
          ← Kho file
        </Link>
        <p className="muted">
          Pending 7d: {metrics.pending_7d ?? 0} · Up 30d: {metrics.up_pct_30d ?? 0}% · Down 30d:{' '}
          {metrics.down_pct_30d ?? 0}%
        </p>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section>
        <h3>Lượt 👎 (30 ngày)</h3>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Câu hỏi</th>
                <th>Trả lời</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {downTurns.length === 0 ? (
                <tr>
                  <td colSpan={3}>{busy ? 'Đang tải…' : 'Chưa có lượt down.'}</td>
                </tr>
              ) : (
                downTurns.map((row) => (
                  <tr key={row.id}>
                    <td>{row.user_text || row.intent}</td>
                    <td>{row.reply_vi.slice(0, 120)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void onPropose(row.id)}
                      >
                        Đề xuất Q&A
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Candidate chờ duyệt</h3>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>Câu hỏi</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={4}>{busy ? 'Đang tải…' : 'Chưa có candidate.'}</td>
                </tr>
              ) : (
                candidates.map((row) => (
                  <tr key={row.id}>
                    <td>{row.folder_key}</td>
                    <td>{row.question.slice(0, 80)}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.status === 'pending_review' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void onApprove(row.id)}
                          >
                            Duyệt → file pending
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => void onReject(row.id)}
                          >
                            Từ chối
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
