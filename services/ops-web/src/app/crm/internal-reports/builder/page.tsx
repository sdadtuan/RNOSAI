'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import {
  createIwrSavedReport,
  fetchIwrSavedReports,
  runIwrSavedReport,
  type IwrSavedReport,
} from '@/lib/crm/iwr-api';

export default function IwrBuilderPage() {
  const { user, token, error, setError, logout } = useIwrPageAuth('view');
  const [items, setItems] = useState<IwrSavedReport[]>([]);
  const [name, setName] = useState('BC tuần này');
  const [runResult, setRunResult] = useState<{ rows: unknown[]; truncated: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrSavedReports(token);
      setItems(out.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải builder thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    if (!token) return;
    try {
      await createIwrSavedReport(token, {
        name_vi: name,
        viz: 'table',
        query_json: { template_codes: ['daily_work'], statuses: ['submitted', 'acknowledged'] },
      });
      setName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo báo cáo lưu thất bại');
    }
  }

  async function handleRun(id: string) {
    if (!token) return;
    setSelectedId(id);
    try {
      const out = await runIwrSavedReport(token, id);
      setRunResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chạy báo cáo thất bại');
    }
  }

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user}>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Report builder</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <IwrCard className="mb-4" data-testid="iwr-builder-create">
        <h2 className="text-sm font-semibold mb-2">Tạo saved report</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border rounded px-2 py-1 text-sm min-w-[220px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên báo cáo"
          />
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm"
            onClick={() => void handleCreate()}
          >
            Lưu
          </button>
        </div>
      </IwrCard>

      <IwrCard className="mb-4" data-testid="iwr-builder-list">
        <h2 className="text-sm font-semibold mb-2">Saved reports</h2>
        {items.length === 0 ? (
          <p className="text-slate-500 text-sm">Chưa có báo cáo lưu.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{it.name_vi}</span>
                <span className="text-slate-500">({it.viz})</span>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => void handleRun(it.id)}
                >
                  Chạy
                </button>
              </li>
            ))}
          </ul>
        )}
      </IwrCard>

      {runResult && selectedId && (
        <IwrCard data-testid="iwr-builder-run">
          <h2 className="text-sm font-semibold mb-2">
            Kết quả {runResult.truncated ? '(cắt 5000 dòng)' : ''}
          </h2>
          {runResult.rows.length === 0 ? (
            <p className="text-slate-500 text-sm">Không có dòng trong phạm vi quyền xem.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border px-2 py-1 text-left">Tiêu đề</th>
                    <th className="border px-2 py-1 text-left">Tác giả</th>
                    <th className="border px-2 py-1 text-left">Kỳ</th>
                    <th className="border px-2 py-1 text-left">Trạng thái</th>
                    <th className="border px-2 py-1 text-left">RAG</th>
                  </tr>
                </thead>
                <tbody>
                  {runResult.rows.map((row) => {
                    const r = row as {
                      id: string;
                      title: string;
                      author_name?: string;
                      period_start: string;
                      status: string;
                      rag: string | null;
                    };
                    return (
                      <tr key={r.id}>
                        <td className="border px-2 py-1">{r.title}</td>
                        <td className="border px-2 py-1">{r.author_name ?? '—'}</td>
                        <td className="border px-2 py-1">{r.period_start}</td>
                        <td className="border px-2 py-1">{r.status}</td>
                        <td className="border px-2 py-1">{r.rag ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </IwrCard>
      )}

      <Link href="/crm/internal-reports" className="mt-4 inline-block text-sm text-[#0052CC] hover:underline">
        ← BC của tôi
      </Link>
    </IwrAppShell>
  );
}
