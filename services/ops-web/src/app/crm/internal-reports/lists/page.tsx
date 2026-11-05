'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { createIwrList, fetchIwrLists, type IwrListRow } from '@/lib/crm/iwr-api';

export default function IwrListsPage() {
  const { user, token, error, setError, logout } = useIwrPageAuth('lists');
  const [items, setItems] = useState<IwrListRow[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrLists(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải danh sách phân phối thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    if (!token || !code.trim() || !name.trim()) return;
    try {
      await createIwrList(token, {
        code: code.trim(),
        name_vi: name.trim(),
        kind: 'static',
        rule_json: {},
        active: true,
      });
      setCode('');
      setName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo danh sách thất bại');
    }
  }

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user}>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Danh sách phân phối</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/crm/internal-reports/schedules" className="iwr-link">Lịch</Link>
        {' · '}
        <Link href="/crm/internal-reports/builder" className="iwr-link">Builder</Link>
      </div>
      <IwrCard className="mb-4 max-w-lg space-y-2">
        <div className="text-sm font-medium">Tạo danh sách tĩnh</div>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Mã (code)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Tên hiển thị"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="iwr-btn iwr-btn--primary" onClick={() => void handleCreate()}>
          Tạo
        </button>
      </IwrCard>
      <div className="space-y-2">
        {items.map((row) => (
          <IwrCard key={row.id}>
            <div className="font-medium">{row.name_vi}</div>
            <div className="text-xs text-slate-500">
              {row.code} · {row.kind} · {row.active ? 'Đang dùng' : 'Tắt'}
            </div>
          </IwrCard>
        ))}
        {!items.length && <div className="py-8 text-center text-sm text-slate-500">Chưa có danh sách</div>}
      </div>
      <Link href="/crm/internal-reports" className="iwr-link">
        ← BC của tôi
      </Link>
    </IwrAppShell>
  );
}
