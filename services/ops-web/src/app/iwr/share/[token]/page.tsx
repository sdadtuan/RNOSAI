'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export default function IwrPublicSharePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch(`${API_BASE}/api/crm/iwr/public/shares/${params.token}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json()) as Record<string, unknown> & { error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Link không hợp lệ');
        setData(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [params.token]);

  const report = (data?.report ?? null) as Record<string, unknown> | null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded border p-6">
        <h1 className="text-lg font-semibold mb-2">Báo cáo nội bộ (secure link)</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!error && !report && <p className="text-slate-500 text-sm">Đang tải…</p>}
        {report && (
          <>
            <p className="text-sm text-slate-600 mb-4">
              {String(report.title ?? '')} · {String(report.period_start ?? '')}
            </p>
            <pre className="text-xs overflow-auto whitespace-pre-wrap bg-slate-50 p-3 rounded">
              {JSON.stringify(report.sections_json, null, 2)}
            </pre>
          </>
        )}
      </div>
    </main>
  );
}
