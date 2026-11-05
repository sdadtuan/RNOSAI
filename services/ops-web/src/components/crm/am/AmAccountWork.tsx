'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAmWorkQueue, type AmWorkQueueItem } from '@/lib/crm/am-api';
import { amWorkDash } from '@/lib/crm/am-work-queue.util';
import { useAmPage } from './AmShell';

export function AmAccountWork({ agencyClientId }: { agencyClientId: string }) {
  const { token, scope } = useAmPage();
  const [items, setItems] = useState<AmWorkQueueItem[] | null>(null);
  const [error, setError] = useState('');
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const generation = ++loadGenerationRef.current;
    setError('');
    try {
      const out = await fetchAmWorkQueue(token, {
        agency_client_id: agencyClientId,
        inbox: 'all',
        scope,
      });
      if (generation !== loadGenerationRef.current) return;
      setItems(out.items);
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setItems(null);
      setError('Không tải được công việc.');
    }
  }, [token, agencyClientId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="am-360__panel">
        <p className="am-muted">{error}</p>
        <button type="button" className="am-btn" onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  if (!items) return <p className="am-muted">Đang tải…</p>;
  if (items.length === 0) return <p className="am-muted">—</p>;

  return (
    <div className="am-360__panel">
      <table className="am-table">
        <thead>
          <tr>
            <th>Việc</th>
            <th>Status</th>
            <th>Hạn</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/crm/account-management/work/${row.id}`}>{row.title}</Link>
              </td>
              <td>{row.status}</td>
              <td>{amWorkDash(row.due_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
