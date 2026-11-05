'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  activateBrandHero,
  deleteBrandHero,
  fetchAdminBrand,
  staffMe,
  staffRefresh,
  uploadBrandHero,
  uploadBrandLogo,
  type AdminBrandResponse,
} from '@/lib/api';
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

export default function AdminBrandPage() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [brand, setBrand] = useState<AdminBrandResponse | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền CRM data config');
        return null;
      }
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
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const data = await fetchAdminBrand(access);
    setBrand(data);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được brand');
      }
    })();
  }, [ensureAuth, reload]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  const onLogoPick = async (file: File | undefined) => {
    if (!file) return;
    const access = await ensureAuth();
    if (!access || !canConfigure) return;
    await withBusy(async () => {
      await uploadBrandLogo(access, file);
      await reload(access);
      setMsg('Đã cập nhật logo — mọi logo trong hệ thống sẽ đổi theo.');
    });
  };

  const onHeroPick = async (file: File | undefined) => {
    if (!file) return;
    const access = await ensureAuth();
    if (!access || !canConfigure) return;
    await withBusy(async () => {
      await uploadBrandHero(access, file);
      await reload(access);
      setMsg('Đã thêm ảnh hero mới.');
    });
  };

  const onActivate = async (id: string) => {
    const access = await ensureAuth();
    if (!access || !canConfigure) return;
    await withBusy(async () => {
      await activateBrandHero(access, id);
      await reload(access);
      setMsg('Đã đặt làm ảnh login.');
    });
  };

  const onDelete = async (id: string, active: boolean) => {
    if (active) return;
    const access = await ensureAuth();
    if (!access || !canConfigure) return;
    await withBusy(async () => {
      await deleteBrandHero(access, id);
      await reload(access);
      setMsg('Đã xóa ảnh hero.');
    });
  };

  return (
    <AdminPageShell
      section="crm-config"
      title="Hình ảnh & logo"
      user={user}
      onLogout={logout}
    >
      <div data-testid="admin-brand" className="admin-brand-page">
        {error ? <p className="text-danger">{error}</p> : null}
        {msg ? <p className="text-success">{msg}</p> : null}

        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Logo hệ thống</h2>
          <p className="muted">Thay logo ở đây sẽ đổi mọi logo trong hệ thống.</p>
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt="Logo hiện tại"
              style={{ maxWidth: 160, marginBottom: '0.75rem', display: 'block' }}
            />
          ) : null}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => void onLogoPick(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canConfigure || busy}
            onClick={() => logoInputRef.current?.click()}
          >
            Thay logo
          </button>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Ảnh hero login</h2>
          <p className="muted">Chọn ảnh dùng làm nền cột trái màn hình đăng nhập.</p>
          {brand?.hero_url ? (
            <img
              src={brand.hero_url}
              alt="Hero login hiện tại"
              style={{ maxWidth: 280, marginBottom: '0.75rem', display: 'block', borderRadius: 8 }}
            />
          ) : null}
          <input
            ref={heroInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void onHeroPick(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canConfigure || busy}
            onClick={() => heroInputRef.current?.click()}
            style={{ marginBottom: '1rem' }}
          >
            Thêm ảnh hero
          </button>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(brand?.heroes ?? []).map((hero) => (
              <li
                key={hero.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <img src={hero.url} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                <span style={{ flex: 1 }}>{hero.filename}</span>
                {hero.active ? (
                  <span className="badge badge-success">Đang dùng làm ảnh login</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={!canConfigure || busy}
                      onClick={() => void onActivate(hero.id)}
                    >
                      Dùng làm ảnh login
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={!canConfigure || busy}
                      onClick={() => void onDelete(hero.id, hero.active)}
                    >
                      Xóa
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminPageShell>
  );
}
