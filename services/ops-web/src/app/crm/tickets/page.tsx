'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  createCrmTicket,
  fetchCrmStaffList,
  fetchCrmTickets,
  fetchCustomers,
  patchCrmTicket,
  staffMe,
  staffRefresh,
  type CrmTicketRow,
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

const TICKET_TYPES = [
  { value: 'phan_nan', label: 'Phàn nàn' },
  { value: 'phan_anh', label: 'Phản ánh' },
  { value: 'khieu_nai', label: 'Khiếu nại' },
  { value: 'ho_tro_ky_thuat', label: 'Hỗ trợ kỹ thuật' },
  { value: 'yeu_cau_dich_vu', label: 'Yêu cầu dịch vụ' },
  { value: 'khac', label: 'Khác' },
];

const TICKET_STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'moi', label: 'Mới' },
  { value: 'dang_xu_ly', label: 'Đang xử lý' },
  { value: 'cho_khach', label: 'Chờ phản hồi KH' },
  { value: 'da_xu_ly', label: 'Đã xử lý' },
  { value: 'dong', label: 'Đóng' },
];

const TICKET_PRIORITIES = [
  { value: 'thap', label: 'Thấp' },
  { value: 'binh_thuong', label: 'Bình thường' },
  { value: 'cao', label: 'Cao' },
  { value: 'khan_cap', label: 'Khẩn cấp' },
];

const TICKET_CHANNELS = [
  { value: 'dien_thoai', label: 'Điện thoại' },
  { value: 'email', label: 'Email' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'truc_tiep', label: 'Trực tiếp' },
  { value: 'khac', label: 'Khác' },
];

export default function CrmTicketsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<CrmTicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    ticket_type: 'phan_anh',
    priority: 'binh_thuong',
    channel: 'khac',
    title: '',
    description: '',
    assigned_staff_id: '',
  });

  const canEdit = hasCap(user, 'crm_board', 'edit');

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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền xem ticket CS');
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

  const reload = useCallback(
    async (access: string) => {
      const data = await fetchCrmTickets(access, {
        q: query || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setRows(data.tickets);
      setTotal(data.total);
    },
    [query, statusFilter],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const [cust, staff] = await Promise.all([
          fetchCustomers(access, { limit: 200 }),
          fetchCrmStaffList(access),
        ]);
        setCustomers(cust.map((c) => ({ id: c.id, name: c.name ?? `#${c.id}` })));
        setStaffOptions(
          (staff.staff ?? []).map((s) => ({ id: s.id, name: s.name ?? `#${s.id}` })),
        );
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải tickets thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canEdit) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await createCrmTicket(access, {
        customer_id: Number(form.customer_id),
        ticket_type: form.ticket_type,
        priority: form.priority,
        channel: form.channel,
        title: form.title,
        description: form.description,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
      });
      setForm({
        customer_id: '',
        ticket_type: 'phan_anh',
        priority: 'binh_thuong',
        channel: 'khac',
        title: '',
        description: '',
        assigned_staff_id: '',
      });
      await reload(access);
      setMsg('Đã tạo ticket');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(row: CrmTicketRow, status: string) {
    const access = getAccessToken();
    if (!access || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      await patchCrmTicket(access, row.id, { status });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main className="kpi-page" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={() => { clearSession(); router.push('/login'); }} />
      <div className="card">
        <div className="kpi-page__head">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Ticket CS lite</h2>
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              Quản lý phản ánh / hỗ trợ khách hàng · {total} ticket
            </p>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="kpi-page__filters" style={{ marginBottom: '1rem' }}>
          <input
            className="kpi-input"
            placeholder="Tìm title / KH / mô tả"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="kpi-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {TICKET_STATUSES.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQuery(q)}>
            Lọc
          </button>
        </div>

        {canEdit ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
            <h3 className="kpi-section-title">Tạo ticket mới</h3>
            <div className="admin-crm-form__grid">
              <select
                className="kpi-select"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                required
              >
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.ticket_type}
                onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}
              >
                {TICKET_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {TICKET_PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {TICKET_CHANNELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                placeholder="Tiêu đề ticket"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <select
                className="kpi-select"
                value={form.assigned_staff_id}
                onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
              >
                <option value="">Chưa gán</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="kpi-input"
              placeholder="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            />
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Tạo ticket'}
            </button>
          </form>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền crm_board edit để tạo/sửa.</p>
        )}

        <div className="crm-leads-table-wrap" style={{ marginTop: '1.25rem' }}>
          <table className="perf-table crm-tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>KH</th>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Owner</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Chưa có ticket
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <Link href={`/crm/customers/${row.customer_id}`}>{row.customer_name}</Link>
                    </td>
                    <td>{row.title}</td>
                    <td>{row.ticket_type_label}</td>
                    <td>{row.priority_label}</td>
                    <td>
                      {canEdit ? (
                        <select
                          className="kpi-select crm-tickets-table__status"
                          value={row.status}
                          disabled={busy}
                          onChange={(e) => void updateStatus(row, e.target.value)}
                        >
                          {TICKET_STATUSES.filter((item) => item.value).map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.status_label
                      )}
                    </td>
                    <td>{row.assigned_staff_name}</td>
                    <td className="muted">{row.updated_at || row.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
