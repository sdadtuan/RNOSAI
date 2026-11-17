'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createPortalStaff,
  deletePortalStaff,
  fetchPortalStaff,
  setPortalStaffActive,
  updatePortalStaff,
  type PortalStaffMember,
  type PortalStaffPageOption,
} from '@/lib/api';
import { SettingsSection } from './SettingsSection';

const TOAST_MS = 2000;

function staffErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  switch (raw) {
    case 'email_already_registered':
      return 'Email này đã được đăng ký.';
    case 'phone_already_registered':
      return 'Số điện thoại này đã được đăng ký.';
    case 'email_required_for_login':
      return 'Cần email để nhân viên đăng nhập Portal (email + mật khẩu).';
    case 'email_or_phone_required':
      return 'Cần email hoặc số điện thoại.';
    case 'invalid_email':
      return 'Email không hợp lệ.';
    case 'invalid_phone':
      return 'Số điện thoại không hợp lệ.';
    case 'invalid_role':
      return 'Vai trò phải là nhân viên hoặc chỉ xem.';
    case 'password_too_short':
      return 'Mật khẩu tối thiểu 8 ký tự.';
    case 'approver_only':
      return 'Chỉ quản trị viên mới thêm, sửa hoặc xóa nhân viên.';
    case 'cannot_change_self':
      return 'Không thể sửa hoặc xóa chính bạn.';
    case 'cannot_change_approver':
      return 'Không thể sửa hoặc xóa tài khoản quản trị viên.';
    case 'staff_not_found':
      return 'Không tìm thấy nhân viên.';
    case 'no_updates':
      return 'Không có thay đổi.';
    case 'page_not_found':
      return 'Có Page không thuộc tài khoản hoặc đã tắt. Tải lại trang rồi chọn lại.';
    case 'invalid_page_ids':
      return 'Danh sách Page không hợp lệ.';
    default:
      return raw || 'Không thực hiện được thao tác nhân viên';
  }
}

function roleLabel(role?: string): string {
  if (role === 'viewer') return 'Chỉ xem';
  if (role === 'approver') return 'Quản trị';
  return 'Nhân viên';
}

type StaffFormState = {
  name: string;
  email: string;
  phone: string;
  role: 'staff' | 'viewer';
  password: string;
  pageIds: string[];
};

const EMPTY_FORM: StaffFormState = { name: '', email: '', phone: '', role: 'staff', password: '', pageIds: [] };

function pageLabel(page: PortalStaffPageOption | undefined, id: string): string {
  const name = (page?.page_name || '').trim();
  if (name && name !== id) return name;
  return `Page …${id.slice(-4)}`;
}

/** Fixed-height checkbox list so the form never jumps while ticking Pages. */
function StaffPagePicker({
  id,
  pages,
  value,
  onChange,
  disabled,
}: {
  id: string;
  pages: PortalStaffPageOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  return (
    <div className="field portal-staff-pages">
      <span className="portal-staff-pages__label" id={`${id}_label`}>
        Page được phân <span className="muted">({value.length}/{pages.length})</span>
      </span>
      {pages.length === 0 ? (
        <p className="settings-form__hint muted">Chưa có Page nào đang gắn cho tài khoản này.</p>
      ) : (
        <div className="portal-staff-pages__box" role="group" aria-labelledby={`${id}_label`}>
          {pages.map((page) => (
            <label key={page.page_id} className="portal-staff-check portal-staff-pages__item">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.has(page.page_id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(page.page_id);
                  else next.delete(page.page_id);
                  onChange(pages.map((item) => item.page_id).filter((pid) => next.has(pid)));
                }}
              />
              <span className="portal-staff-pages__name">{pageLabel(page, page.page_id)}</span>
            </label>
          ))}
        </div>
      )}
      <p className="settings-form__hint muted">
        Nhân viên và tài khoản Chỉ xem chỉ thấy Lead, tin nhắn và bình luận của các Page được chọn. Không chọn Page nào thì
        sẽ không thấy gì.
      </p>
    </div>
  );
}

export function ClientStaffSettings({ token, canManage }: { token: string; canManage: boolean }) {
  const [staff, setStaff] = useState<PortalStaffMember[]>([]);
  const [pages, setPages] = useState<PortalStaffPageOption[]>([]);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortalStaffMember | null>(null);
  const [editForm, setEditForm] = useState<StaffFormState>(EMPTY_FORM);
  const [editReset, setEditReset] = useState(false);
  const [deleting, setDeleting] = useState<PortalStaffMember | null>(null);

  const load = useCallback(async () => {
    const out = await fetchPortalStaff(token);
    setStaff(out.staff ?? []);
    setPages(out.pages ?? []);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err: unknown) => setError(staffErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  function openEdit(item: PortalStaffMember) {
    setError('');
    setEditing(item);
    setEditReset(false);
    setEditForm({
      name: item.display_name ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      role: item.role === 'viewer' ? 'viewer' : 'staff',
      password: '',
      pageIds: item.page_ids ?? [],
    });
  }

  return (
    <SettingsSection
      title="Nhân viên"
      description="Tài khoản nhận lead và tin nhắn của khách hàng này. Đăng nhập bằng email và mật khẩu."
    >
      {!canManage ? (
        <p className="muted">Bạn chỉ có quyền xem danh sách — chỉ quản trị viên mới thêm, sửa hoặc xóa nhân viên.</p>
      ) : null}
      {canManage ? (
        <form
          className="settings-form portal-staff-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setTempPassword('');
            void createPortalStaff(token, {
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              role: form.role,
              password: form.password.trim() || undefined,
              page_ids: form.pageIds,
            })
              .then(async (out) => {
                setForm(EMPTY_FORM);
                if (out.temporary_password) setTempPassword(out.temporary_password);
                setToast('Đã tạo nhân viên');
                await load();
              })
              .catch((err: unknown) => setError(staffErrorMessage(err)))
              .finally(() => setBusy(false));
          }}
        >
          <div className="portal-staff-form__grid">
            <div className="field">
              <label htmlFor="staff_name">Tên</label>
              <input
                id="staff_name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                type="text"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="staff_email">Email</label>
              <input
                id="staff_email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                type="email"
                required
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="staff_phone">Số điện thoại</label>
              <input
                id="staff_phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                type="tel"
                autoComplete="off"
              />
              <p className="settings-form__hint muted">Không bắt buộc.</p>
            </div>
            <div className="field">
              <label htmlFor="staff_role">Vai trò</label>
              <select
                id="staff_role"
                className="portal-staff-form__select"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value === 'viewer' ? 'viewer' : 'staff' }))}
              >
                <option value="staff">Nhân viên</option>
                <option value="viewer">Chỉ xem</option>
              </select>
            </div>
            <div className="field portal-staff-form__password">
              <label htmlFor="staff_password">Mật khẩu</label>
              <input
                id="staff_password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                type="password"
                autoComplete="new-password"
              />
              <p className="settings-form__hint muted">Để trống sẽ tạo mật khẩu tạm, hiện một lần sau khi tạo.</p>
            </div>
            <StaffPagePicker
              id="staff_pages"
              pages={pages}
              value={form.pageIds}
              disabled={busy}
              onChange={(pageIds) => setForm((f) => ({ ...f, pageIds }))}
            />
          </div>
          <div className="portal-staff-form__actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Tạo nhân viên'}
            </button>
          </div>
        </form>
      ) : null}
      {tempPassword ? (
        <p className="portal-staff-temp">
          Mật khẩu tạm (chỉ hiện một lần): <code>{tempPassword}</code>
        </p>
      ) : null}
      {loading ? (
        <p className="muted">Đang tải nhân viên…</p>
      ) : staff.length === 0 ? (
        <p className="muted">Chưa có nhân viên.</p>
      ) : null}
      <ul className="portal-crm__list">
        {staff.map((item) => (
          <li key={item.id}>
            <span>
              {item.display_name ? <strong>{item.display_name} · </strong> : null}
              {item.email}
              {item.phone ? <span className="muted"> · {item.phone}</span> : null}
              <span className="muted">
                {' '}
                · {roleLabel(item.role)} · {item.active ? 'Đang nhận việc' : 'Đã tắt'}
              </span>
              <span className="portal-staff-pages__chips">
                {(item.page_ids ?? []).length === 0 ? (
                  <span className="portal-staff-pages__chip is-empty">Chưa được phân Page</span>
                ) : (
                  (item.page_ids ?? []).map((pid) => (
                    <span key={pid} className="portal-staff-pages__chip">
                      {pageLabel(
                        pages.find((page) => page.page_id === pid),
                        pid,
                      )}
                    </span>
                  ))
                )}
              </span>
            </span>
            {canManage && item.role !== 'approver' ? (
              <span className="portal-staff-row-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => openEdit(item)}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError('');
                    void setPortalStaffActive(token, item.id, !item.active)
                      .then(async () => {
                        setToast(item.active ? 'Đã tắt nhân viên' : 'Đã bật nhân viên');
                        await load();
                      })
                      .catch((err: unknown) => setError(staffErrorMessage(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  {item.active ? 'Tắt' : 'Bật'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setDeleting(item);
                  }}
                >
                  Xóa
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="portal-staff-modal-backdrop" role="presentation" onClick={() => !busy && setEditing(null)}>
          <div
            className="portal-staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="staff-edit-title" className="portal-staff-modal__title">
              Sửa nhân viên
            </h3>
            <p className="muted settings-form__hint">{editing.email}</p>
            <form
              className="settings-form portal-staff-form"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                setTempPassword('');
                void updatePortalStaff(token, editing.id, {
                  name: editForm.name.trim(),
                  email: editForm.email.trim(),
                  phone: editForm.phone.trim(),
                  role: editForm.role,
                  reset_password: editReset,
                  password: editForm.password.trim() || undefined,
                  page_ids: editForm.pageIds,
                })
                  .then(async (out) => {
                    setEditing(null);
                    setEditReset(false);
                    if (out.temporary_password) setTempPassword(out.temporary_password);
                    setToast('Đã cập nhật nhân viên');
                    await load();
                  })
                  .catch((err: unknown) => setError(staffErrorMessage(err)))
                  .finally(() => setBusy(false));
              }}
            >
              <div className="portal-staff-form__grid">
                <div className="field">
                  <label htmlFor="edit_staff_name">Tên</label>
                  <input
                    id="edit_staff_name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    type="text"
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit_staff_email">Email</label>
                  <input
                    id="edit_staff_email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    type="email"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit_staff_phone">Số điện thoại</label>
                  <input
                    id="edit_staff_phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    type="tel"
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit_staff_role">Vai trò</label>
                  <select
                    id="edit_staff_role"
                    className="portal-staff-form__select"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, role: e.target.value === 'viewer' ? 'viewer' : 'staff' }))
                    }
                  >
                    <option value="staff">Nhân viên</option>
                    <option value="viewer">Chỉ xem</option>
                  </select>
                </div>
                <div className="field portal-staff-form__password">
                  <label className="portal-staff-check">
                    <input
                      type="checkbox"
                      checked={editReset}
                      onChange={(e) => setEditReset(e.target.checked)}
                    />
                    Tạo mật khẩu tạm mới
                  </label>
                  <p className="settings-form__hint muted">
                    Mật khẩu tạm sẽ hiện một lần sau khi lưu. Nhân viên dùng mật khẩu này để đăng nhập.
                  </p>
                </div>
                <StaffPagePicker
                  id="edit_staff_pages"
                  pages={pages}
                  value={editForm.pageIds}
                  disabled={busy}
                  onChange={(pageIds) => setEditForm((f) => ({ ...f, pageIds }))}
                />
              </div>
              <div className="portal-staff-modal__actions">
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
                  Hủy
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="portal-staff-modal-backdrop" role="presentation" onClick={() => !busy && setDeleting(null)}>
          <div
            className="portal-staff-modal portal-staff-modal--danger"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="staff-delete-title" className="portal-staff-modal__title">
              Xóa nhân viên?
            </h3>
            <p>
              Xóa <strong>{deleting.display_name || deleting.email}</strong>
              {deleting.display_name ? <span className="muted"> ({deleting.email})</span> : null}? Các việc đang mở sẽ
              được trả về hàng chờ phân công tự động. Tài khoản mất quyền đăng nhập. Lịch sử và thông báo được giữ lại.
              Không thể hoàn tác.
            </p>
            <div className="portal-staff-modal__actions">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDeleting(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  setTempPassword('');
                  void deletePortalStaff(token, deleting.id)
                    .then(async () => {
                      setDeleting(null);
                      setToast('Đã xóa nhân viên');
                      await load();
                    })
                    .catch((err: unknown) => setError(staffErrorMessage(err)))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? 'Đang xóa…' : 'Xóa nhân viên'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="portal-staff-toast" role="status">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="portal-staff-error-popup" role="alert">
          <button
            type="button"
            className="portal-staff-error-popup__close"
            onClick={() => setError('')}
            aria-label="Đóng"
          >
            ×
          </button>
          {error}
        </div>
      ) : null}
    </SettingsSection>
  );
}
