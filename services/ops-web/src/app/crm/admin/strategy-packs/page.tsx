'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { fetchStrategyPacks, patchStrategyPack, type StrategyPackRow } from '@/lib/crm/strategy-packs-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

function canAdmin(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'ai_admin', 'view') ||
    hasCap(user, 'crm_mkt_ai', 'approve') ||
    hasCap(user, 'crm_board', 'configure')
  );
}

export default function StrategyPacksAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<Array<StrategyPackRow & { kind: 'industry' | 'service' }>>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      const me = await staffMe(out.access_token);
      setUser(me);
      return out.access_token;
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const data = await fetchStrategyPacks(access);
        const next = [
          ...data.industry_packs.map((row) => ({ ...row, kind: 'industry' as const })),
          ...data.service_packs.map((row) => ({ ...row, kind: 'service' as const })),
        ];
        setRows(next);
        setDrafts(Object.fromEntries(next.map((row) => [`${row.kind}:${row.key}`, JSON.stringify(row.defaults_json, null, 2)])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải pack');
      }
    })();
  }, [ensureAuth]);

  async function save(row: StrategyPackRow & { kind: 'industry' | 'service' }, patch: { is_active?: boolean }) {
    const access = getAccessToken();
    if (!access || !canAdmin(user)) return;
    setError('');
    setMessage('');
    try {
      const raw = drafts[`${row.kind}:${row.key}`] ?? '{}';
      const defaults_json = JSON.parse(raw) as Record<string, unknown>;
      const updated = await patchStrategyPack(access, row.kind, row.key, {
        defaults_json,
        is_active: patch.is_active ?? row.is_active,
        name_vi: row.name_vi,
      });
      setRows((prev) => prev.map((item) => (item.kind === row.kind && item.key === row.key ? { ...item, ...updated } : item)));
      setMessage(`Đã lưu ${row.key} · v${updated.version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu pack thất bại');
    }
  }

  return (
    <StaffPageShell user={user} onLogout={() => { clearSession(); router.push('/login'); }}>
      <p className="muted">Catalog ngành và gói dịch vụ. Sửa defaults không được ghi số tiền hoặc KPI giả.</p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}
      {!user ? <p className="muted">Đang tải…</p> : null}
      {user && !canAdmin(user) ? <p className="muted">Bạn chỉ xem được catalog. Sửa pack cần quyền admin.</p> : null}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {rows.map((row) => (
          <article key={`${row.kind}:${row.key}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <strong>
                {row.name_vi} · {row.key}
              </strong>
              <span className="muted">
                {row.kind} · v{row.version} · {row.is_active ? 'active' : 'inactive'}
              </span>
            </header>
            {row.journey_focus ? <p className="muted">{row.journey_focus}</p> : null}
            <textarea
              rows={8}
              value={drafts[`${row.kind}:${row.key}`] ?? ''}
              disabled={!canAdmin(user)}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [`${row.kind}:${row.key}`]: e.target.value }))}
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={!canAdmin(user)} onClick={() => void save(row, {})}>
                Lưu và tăng version
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!canAdmin(user)}
                onClick={() => void save(row, { is_active: !row.is_active })}
              >
                {row.is_active ? 'Tắt' : 'Bật'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </StaffPageShell>
  );
}
