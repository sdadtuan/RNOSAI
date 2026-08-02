'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  ApiError,
  createLead,
  fetchAgencyClients,
  fetchCrmStaffList,
  staffMe,
  staffRefresh,
  type AgencyClient,
  type CrmStaffRow,
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

const STATUS_OPTIONS = [
  { value: 'moi', label: 'Mới' },
  { value: 'da_lien_he', label: 'Đã liên hệ' },
  { value: 'dang_tu_van', label: 'Đang tư vấn' },
  { value: 'hen_gap', label: 'Hẹn gặp' },
  { value: 'chot', label: 'Chốt' },
  { value: 'lost', label: 'Lost' },
] as const;

export default function NewLeadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClientId = searchParams.get('client_id') ?? '';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('manual');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('moi');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    const cached = getStoredUser();
    if (cached) setUser(cached);

    void (async () => {
      let currentToken = access;
      try {
        const me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'crm_leads', 'edit')) {
          setError('Không có quyền tạo lead');
          return;
        }
        setOwnerId((prev) => prev || (me.id ? String(me.id) : ''));
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        currentToken = out.access_token;
        setToken(currentToken);
        const me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
        setOwnerId((prev) => prev || (me.id ? String(me.id) : ''));
      }

      const [clientOut, staffOut] = await Promise.all([
        fetchAgencyClients(currentToken).catch(() => ({ clients: [] as AgencyClient[] })),
        fetchCrmStaffList(currentToken).catch(() => ({ staff: [] as CrmStaffRow[], summary: {} })),
      ]);
      setClients(clientOut.clients ?? []);
      setStaffOptions(staffOut.staff ?? []);
      if (presetClientId) {
        setClientId(presetClientId);
      }
    })();
  }, [presetClientId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !user || !canCreate) return;
    if (!fullName.trim()) {
      setError('Họ tên là bắt buộc');
      return;
    }
    if (!clientId) {
      setError('Chọn khách hàng agency (client)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lead = await createLead(access, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        client_id: clientId,
        source: source.trim() || 'manual',
        channel: channel.trim() || undefined,
        status,
        owner_id: ownerId ? Number(ownerId) : undefined,
      });
      router.push(`/crm/leads/${lead.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          'Không ghi được lead — kiểm tra PTT_LEADS_WRITE_ENABLED=1 trên API (ptt-crm-api).',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Tạo lead thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Tạo lead thủ công</h2>
          <Link href="/crm/leads" className="btn btn-sm btn-secondary">
            ← Danh sách
          </Link>
        </div>

        {!canCreate ? (
          <p className="error">Không có quyền tạo lead (crm_leads · edit).</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Họ tên *</span>
              <input
                className="kpi-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>SĐT</span>
                <input
                  className="kpi-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Email</span>
                <input
                  className="kpi-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Khách hàng agency *</span>
              <select
                className="kpi-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">— Chọn client —</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.code} · {client.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Nguồn</span>
                <input
                  className="kpi-input"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="manual"
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Kênh</span>
                <input
                  className="kpi-input"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="phone, walk-in, zalo…"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Trạng thái</span>
                <select
                  className="kpi-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Owner</span>
                <select
                  className="kpi-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">— Chưa gán —</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" disabled={saving || !token}>
                {saving ? 'Đang tạo…' : 'Tạo lead'}
              </button>
              <Link href="/crm/leads" className="btn btn-secondary">
                Hủy
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
