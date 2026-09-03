'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { iwrAvatarTone, iwrInitials, iwrRagClass, iwrRagLabel } from '@/components/crm/iwr/iwr-format';
import {
  IWR_STATUS_LABELS,
  fetchIwrInbox,
  formatIwrWhen,
  type IwrInboxBox,
  type IwrReportRow,
} from '@/lib/crm/iwr-api';

const TABS: { id: IwrInboxBox; label: string }[] = [
  { id: 'action', label: 'Cần xử lý' },
  { id: 'waiting', label: 'Chờ xác nhận' },
  { id: 'needs_changes', label: 'Cần bổ sung' },
  { id: 'blockers', label: 'Blocker' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'inbox', label: 'Đã nhận' },
  { id: 'sent', label: 'Đã gửi' },
  { id: 'approvals', label: 'Phê duyệt' },
  { id: 'archived', label: 'Lưu trữ' },
];

const BOXES = new Set<IwrInboxBox>(TABS.map((t) => t.id));

export default function IwrInboxPage() {
  const params = useSearchParams();
  const initial = params.get('box') as IwrInboxBox | null;
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [box, setBox] = useState<IwrInboxBox>(initial && BOXES.has(initial) ? initial : 'action');
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
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canWrite}>
      <div className="iwr-pagehead">
        <h1 className="iwr-h1">Hộp thư báo cáo</h1>
        <Link href="/crm/internal-reports" className="iwr-link">
          Danh sách của tôi
        </Link>
      </div>
      {error && <p className="iwr-err">{error}</p>}
      <div className="iwr-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`iwr-tab${box === t.id ? ' is-active' : ''}`}
            onClick={() => setBox(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <IwrCard>
        <div className="space-y-1">
          {items.map((row) => (
            <Link
              key={row.id}
              href={`/crm/internal-reports/${row.id}`}
              className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${iwrAvatarTone(row.author_staff_id)}`}>
                {iwrInitials(row.author_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{row.title}</div>
                <div className="text-xs text-slate-500">
                  {IWR_STATUS_LABELS[row.status]} · {row.author_name ?? row.author_staff_id} · {formatIwrWhen(row.submitted_at)}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${iwrRagClass(row.rag)}`}>{iwrRagLabel(row.rag)}</span>
              {!row.first_viewed_at && <span className="h-2 w-2 rounded-full bg-[#0052CC]" />}
            </Link>
          ))}
          {!items.length && <div className="py-8 text-center text-sm text-slate-500">Không có báo cáo trong mục này</div>}
        </div>
      </IwrCard>
    </IwrAppShell>
  );
}
