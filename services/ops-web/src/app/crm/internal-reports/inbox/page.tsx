'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import {
  IWR_STATUS_LABELS,
  fetchIwrInbox,
  formatIwrWhen,
  type IwrInboxBox,
  type IwrReportRow,
} from '@/lib/crm/iwr-api';

const TABS: { id: IwrInboxBox; label: string }[] = [
  { id: 'action', label: 'Cần xử lý' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'inbox', label: 'Đã nhận' },
  { id: 'sent', label: 'Đã gửi' },
];

export default function IwrInboxPage() {
  const { user, token, error, setError, logout } = useIwrPageAuth('view');
  const [box, setBox] = useState<IwrInboxBox>('action');
  const [items, setItems] = useState<IwrReportRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrInbox(token, box);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hộp thư thất bại');
    }
  }, [token, box, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user}>
      <PageToolbar title="Hộp thư BC" subtitle="Báo cáo công việc nội bộ" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`px-3 py-1.5 rounded text-sm border ${box === t.id ? 'bg-slate-800 text-white' : 'bg-white'}`}
            onClick={() => setBox(t.id)}
          >
            {t.label}
          </button>
        ))}
        <Link href="/crm/internal-reports" className="px-3 py-1.5 rounded border text-sm ml-auto">
          Danh sách của tôi
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((row) => (
          <Link
            key={row.id}
            href={`/crm/internal-reports/${row.id}`}
            className="block rounded border p-3 hover:bg-slate-50"
          >
            <div className="font-medium">{row.title}</div>
            <div className="text-xs text-slate-500 mt-1">
              {IWR_STATUS_LABELS[row.status]} · {row.author_name ?? row.author_staff_id} ·{' '}
              {formatIwrWhen(row.submitted_at)}
            </div>
          </Link>
        ))}
        {!items.length && <div className="text-slate-500 text-sm py-8 text-center">Không có báo cáo trong mục này</div>}
      </div>
    </StaffPageShell>
  );
}
