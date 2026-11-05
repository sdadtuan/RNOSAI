'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import {
  approveCeoLearnCandidate,
  fetchCeoLearnCandidates,
  fetchCeoLearnDownTurns,
  proposeCeoLearnFromTurn,
  rejectCeoLearnCandidate,
  staffMe,
  staffRefresh,
  type CeoLearnCandidateRow,
  type CeoTurnRow,
} from '@/lib/api';
import { canSeeCeoNav } from '@/lib/crm/ceo-command-thread.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function CeoCommandLearnPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<CeoLearnCandidateRow[]>([]);
  const [downTurns, setDownTurns] = useState<CeoTurnRow[]>([]);
  const [busy, setBusy] = useState('');

  const canConfigure =
    user &&
    (hasCap(user, 'ceo_command', 'configure') ||
      hasCap(user, 'ai_admin', 'configure') ||
      hasCap(user, 'playbooks', 'configure'));

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    try {
      let me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
    }
    if (!canSeeCeoNav(getStoredUser())) {
      setError('Không có quyền (403)');
      return;
    }
    setToken(access);
  }, [router]);

  const reload = useCallback(async () => {
    if (!token || !canConfigure) return;
    const [c, d] = await Promise.all([
      fetchCeoLearnCandidates(token),
      fetchCeoLearnDownTurns(token),
    ]);
    setCandidates(c.candidates ?? []);
    setDownTurns(d.turns ?? []);
  }, [token, canConfigure]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Điều hành CEO', href: '/crm/ceo' },
        { label: 'Learn' },
      ]}
    >
      <PageToolbar
        title="CEO Command — Learn"
        subtitle="Candidate ceo_os pending — duyệt thủ công, không auto-ready."
        actions={
          <Link href="/crm/ceo" className="btn btn-sm btn-ghost">
            ← ChatBox
          </Link>
        }
      />
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {!canConfigure ? (
          <p className="muted">Cần cap configure để duyệt kho.</p>
        ) : (
          <>
            <section>
              <h3 className="font-medium mb-2">Lượt 👎 gần đây</h3>
              <ul className="space-y-2">
                {downTurns.map((t) => (
                  <li key={t.id} className="flex gap-2 items-start text-sm border-b pb-2">
                    <span className="flex-1">{t.user_text || t.reply_vi.slice(0, 80)}</span>
                    <button
                      type="button"
                      className="btn btn-xs"
                      disabled={busy === t.id}
                      onClick={async () => {
                        setBusy(t.id);
                        try {
                          await proposeCeoLearnFromTurn(token, t.id);
                          await reload();
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      Tạo candidate
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium mb-2">Pending review</h3>
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.id} className="border rounded p-2 text-sm">
                    <div className="font-medium">{c.question}</div>
                    <div className="muted">{c.answer.slice(0, 200)}</div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        disabled={busy === c.id}
                        onClick={async () => {
                          setBusy(c.id);
                          try {
                            await approveCeoLearnCandidate(token, c.id, {});
                            await reload();
                          } finally {
                            setBusy('');
                          }
                        }}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        disabled={busy === c.id}
                        onClick={async () => {
                          setBusy(c.id);
                          try {
                            await rejectCeoLearnCandidate(token, c.id, 'reject');
                            await reload();
                          } finally {
                            setBusy('');
                          }
                        }}
                      >
                        Từ chối
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </StaffPageShell>
  );
}
