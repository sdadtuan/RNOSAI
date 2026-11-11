'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgencyHubPageShell } from '@/components/agency/AgencyHubPageShell';
import { AgencyReadOnlyBadge, canAgencyWrite } from '@/components/AgencyReadOnlyBadge';
import {
  fetchMetaBusinessPages,
  fetchMetaBusinessTokenStatus,
  saveMetaBusinessToken,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

type BusinessPage = { id: string; name: string };

function tokenError(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'business_token_missing') return 'Chưa lưu token Business Manager chung.';
  if (code === 'invalid_business_token') return 'Token quá ngắn.';
  if (code === 'vault_not_configured') return 'Kho mã hóa token chưa được cấu hình trên API.';
  if (code === 'business_token_rejected') return 'Meta từ chối token này.';
  if (code === 'business_token_unreachable') return 'Không gọi được Meta để lấy danh sách Page.';
  if (code === 'business_token_unreadable') return 'Token đã lưu không đọc được. Dán lại token.';
  return code || 'Không lưu được token';
}

export default function AgencyMetaTokenPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [access, setAccess] = useState('');
  const [configured, setConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [accounts, setAccounts] = useState<BusinessPage[]>([]);
  const [tokenValue, setTokenValue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const canWrite = canAgencyWrite(user);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(token);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_agency', 'view')) return null;
      return token;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      return out.access_token;
    }
  }, [router]);

  const loadPages = useCallback(async (token: string) => {
    const out = await fetchMetaBusinessPages(token);
    setPages(out.pages ?? []);
    setAccounts(out.ad_accounts ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await ensureAuth();
      if (!token) return;
      setAccess(token);
      try {
        const status = await fetchMetaBusinessTokenStatus(token);
        setConfigured(status.configured);
        setUpdatedAt(status.updated_at);
        if (status.configured) await loadPages(token);
      } catch (err) {
        setError(tokenError(err));
      }
    })();
  }, [ensureAuth, loadPages]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !access) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await saveMetaBusinessToken(access, tokenValue);
      setTokenValue('');
      setConfigured(true);
      setUpdatedAt(out.updated_at);
      setMessage('Đã lưu token chung. Token không hiện lại trên màn hình.');
      await loadPages(access);
    } catch (err) {
      setError(tokenError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AgencyHubPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      title="Token Business Manager chung"
      subtitle="Một System User token của Business Manager PTT, dùng cho toàn bộ Client. Page gắn vào từng Client phải nằm trong danh sách Page của token này."
      actions={<AgencyReadOnlyBadge user={user} />}
      breadcrumb={[
        { label: 'Agency', href: '/agency' },
        { label: 'Token Business Manager' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}
      <p>
        Trạng thái: <strong>{configured ? 'Đã lưu' : 'Chưa có token'}</strong>
        {updatedAt ? ` · ${new Date(updatedAt).toLocaleString('vi-VN')}` : ''}
      </p>
      {canWrite ? (
        <form onSubmit={(e) => void save(e)} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
          <label>
            System User token
            <input
              type="password"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Dán token Business Manager"
            />
          </label>
          <button type="submit" className="btn btn-sm" disabled={busy}>
            Lưu token chung
          </button>
        </form>
      ) : (
        <p className="muted">Chỉ Super Admin mới lưu token này.</p>
      )}
      <h2 style={{ fontSize: '1rem' }}>Page của token chung ({pages.length})</h2>
      {pages.length === 0 ? <p className="muted">Chưa có Page. Lưu token để CRM lấy danh sách từ Meta.</p> : null}
      {pages.length > 0 ? (
        <table className="perf-table">
          <thead>
            <tr>
              <th>Tên Page</th>
              <th>Page ID</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id}>
                <td>{page.name || '—'}</td>
                <td><code>{page.id}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <h2 style={{ fontSize: '1rem' }}>Account ID của token chung ({accounts.length})</h2>
      {accounts.length === 0 ? <p className="muted">Chưa có Account ID. Token phải có quyền đọc ad account.</p> : null}
      {accounts.length > 0 ? (
        <table className="perf-table">
          <thead>
            <tr>
              <th>Tên account</th>
              <th>Account ID</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name || '—'}</td>
                <td><code>{account.id}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </AgencyHubPageShell>
  );
}
