'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import {
  IWR_STATUS_LABELS,
  createIwrList,
  fetchIwrLists,
  type IwrListRow,
} from '@/lib/crm/iwr-api';

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
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user}>
      <PageToolbar title="Danh sách phân phối" subtitle="BC công việc nội bộ" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="rounded border p-4 mb-4 space-y-2 max-w-lg">
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
        <button type="button" className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm" onClick={() => void handleCreate()}>
          Tạo
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => (
          <div key={row.id} className="rounded border p-3">
            <div className="font-medium">{row.name_vi}</div>
            <div className="text-xs text-slate-500">
              {row.code} · {row.kind} · {row.active ? 'Đang dùng' : 'Tắt'}
            </div>
          </div>
        ))}
        {!items.length && <div className="text-slate-500 text-sm py-8 text-center">Chưa có danh sách</div>}
      </div>
      <Link href="/crm/internal-reports" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
        ← BC của tôi
      </Link>
    </StaffPageShell>
  );
}
