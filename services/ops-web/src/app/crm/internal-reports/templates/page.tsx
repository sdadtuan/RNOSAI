'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { fetchIwrTemplates, updateIwrTemplate, type IwrTemplateRow } from '@/lib/crm/iwr-api';

export default function IwrTemplatesPage() {
  const { user, token, error, setError, logout, canManage } = useIwrPageAuth('manage');
  const [items, setItems] = useState<IwrTemplateRow[]>([]);
  const [busyId, setBusyId] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrTemplates(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải mẫu thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveName(row: IwrTemplateRow, name_vi: string) {
    if (!token || !canManage) return;
    setBusyId(row.id);
    try {
      await updateIwrTemplate(token, row.id, { name_vi });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu mẫu thất bại');
    } finally {
      setBusyId('');
    }
  }

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canManage}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Mẫu báo cáo</h1>
      <p className="mb-5 text-sm text-slate-500">Chỉ đổi tên hiển thị ở W1</p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Link href="/crm/internal-reports" className="iwr-link">
        ← BC công việc
      </Link>
      <div className="space-y-4">
        {items.map((row) => (
          <IwrCard key={row.id} className="space-y-2">
            <div className="text-xs text-slate-500">{row.code} · {row.kind}</div>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              defaultValue={row.name_vi}
              disabled={!canManage || busyId === row.id}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== row.name_vi) void saveName(row, v);
              }}
            />
            <div className="text-xs text-slate-500">
              Sections: {row.sections_json.join(', ')}
            </div>
          </IwrCard>
        ))}
      </div>
    </IwrAppShell>
  );
}
