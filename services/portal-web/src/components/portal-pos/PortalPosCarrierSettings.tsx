'use client';

import { useCallback, useEffect, useState } from 'react';
import { PortalPageShell } from '@/components/PortalPageShell';
import { POS_CARRIER_LABEL, posGet, posPost } from '@/lib/portal-pos-api';

type CarrierId = 'ghn' | 'ghtk' | 'vtp';
const CARRIERS: CarrierId[] = ['ghn', 'ghtk', 'vtp'];

type Account = {
  id: string;
  carrier: CarrierId;
  label: string;
  shop_id: string;
  test_mode: boolean;
  active: boolean;
  has_token: boolean;
};

const EMPTY = { carrier: 'ghn' as CarrierId, label: '', shop_id: '', token: '', test_mode: true, active: true };

function maskHint(has: boolean): string {
  return has ? 'Đã lưu (••••••••) — nhập lại chỉ khi muốn đổi' : 'Chưa có mã kết nối';
}

export function PortalPosCarrierSettings() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Đơn hàng', href: '/crm/orders' }, { label: 'Cài đặt vận chuyển' }]}>
      {({ token, user }) =>
        user.role === 'staff' ? (
          <p className="pos-error">Chỉ chủ tài khoản hoặc quản lý mới xem và sửa tài khoản vận chuyển.</p>
        ) : (
          <CarrierBody token={token} />
        )
      }
    </PortalPageShell>
  );
}

function CarrierBody({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [testMsg, setTestMsg] = useState('');

  const load = useCallback(async () => {
    const res = await posGet<{ accounts: Account[] }>(token, '/api/portal/pos/carriers');
    setAccounts(res.accounts ?? []);
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được tài khoản vận chuyển'));
  }, [load]);

  function startNew() {
    setEditing('new');
    setForm(EMPTY);
    setTestMsg('');
    setInfo('');
  }

  function startEdit(row: Account) {
    setEditing(row.id);
    setForm({
      carrier: row.carrier,
      label: row.label,
      shop_id: row.shop_id,
      token: '',
      test_mode: row.test_mode,
      active: row.active,
    });
    setTestMsg('');
    setInfo('');
  }

  async function save() {
    setError('');
    setInfo('');
    if (!form.test_mode) {
      if (form.carrier === 'ghn' && !form.shop_id.trim()) {
        setError('Cần mã cửa hàng GHN khi chạy chế độ thật. Bật chế độ thử nghiệm nếu bạn chỉ muốn kiểm tra.');
        return;
      }
      const existingHasToken =
        editing !== 'new' && accounts.find((a) => a.id === editing)?.has_token === true;
      if (!form.token.trim() && !existingHasToken) {
        setError('Cần mã kết nối (token) khi chạy chế độ thật. Bật chế độ thử nghiệm nếu bạn chỉ muốn kiểm tra.');
        return;
      }
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        carrier: form.carrier,
        label: form.label || POS_CARRIER_LABEL[form.carrier] || form.carrier,
        shop_id: form.carrier === 'ghn' ? form.shop_id : '',
        test_mode: form.test_mode,
        active: form.active,
      };
      if (editing && editing !== 'new') body.id = editing;
      if (form.token.trim()) body.token = form.token.trim();
      await posPost(token, '/api/portal/pos/carriers', body);
      setInfo('Đã lưu tài khoản vận chuyển.');
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  }

  function testConnection(row?: Account) {
    const testMode = row ? row.test_mode : form.test_mode;
    const hasToken = row ? row.has_token : Boolean(form.token.trim());
    const carrier = POS_CARRIER_LABEL[(row?.carrier || form.carrier) as CarrierId] || 'Hãng';
    if (testMode) {
      setTestMsg(
        `Chế độ thử nghiệm đang bật — không gọi API thật của ${carrier}. Kết nối giả lập thành công.` +
          (hasToken ? ' Token đã được lưu (không gửi ra ngoài).' : ' Chưa có token; khi tắt chế độ thử nghiệm cần nhập token.'),
      );
    } else {
      setTestMsg(
        hasToken
          ? `Đã có token cho ${carrier}. Kiểm tra giả lập: cấu hình hợp lệ. Vận đơn thật chỉ được tạo khi máy chủ cho phép kết nối hãng và token hợp lệ.`
          : `Chưa có token cho ${carrier}. Nhập token rồi lưu trước khi kiểm tra.`,
      );
    }
  }

  return (
    <div className="pos">
      <header className="pos-page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1>Cài đặt vận chuyển</h1>
          <p className="pos-hint">Tài khoản GHN, GHTK và Viettel Post. Mã kết nối chỉ ghi, không hiện lại sau khi lưu. Chế độ thử nghiệm mặc định bật — không tạo vận đơn thật.</p>
        </div>
        <button type="button" className="pos-btn pos-btn--teal" onClick={startNew}>Thêm tài khoản</button>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      {info ? <p className="pos-ok" style={{ color: '#0f766e', fontWeight: 600 }}>{info}</p> : null}

      <div className="pos-card portal-table-wrap" style={{ marginTop: 12 }}>
        <table className="pos-table">
          <thead>
            <tr>
              <th>Hãng</th>
              <th>Tên gợi nhớ</th>
              <th>Mã cửa hàng</th>
              <th>Mã kết nối</th>
              <th>Chế độ</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={7}><p className="pos-hint">Chưa có tài khoản. Thêm GHN, GHTK hoặc Viettel Post — mặc định ở chế độ thử nghiệm.</p></td></tr>
            ) : (
              accounts.map((row) => (
                <tr key={row.id}>
                  <td>{POS_CARRIER_LABEL[row.carrier] || row.carrier}</td>
                  <td>{row.label || '—'}</td>
                  <td>{row.carrier === 'ghn' ? (row.shop_id || '—') : '—'}</td>
                  <td>{row.has_token ? '••••••••' : 'Chưa có'}</td>
                  <td>{row.test_mode ? <span className="pos-badge pos-badge--warn">Thử nghiệm</span> : 'Thật'}</td>
                  <td>{row.active ? 'Bật' : 'Tắt'}</td>
                  <td>
                    <button type="button" className="pos-btn pos-btn--sm" onClick={() => startEdit(row)}>Sửa</button>
                    {' '}
                    <button type="button" className="pos-btn pos-btn--sm" onClick={() => testConnection(row)}>Kiểm tra kết nối</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <form
          className="pos-card"
          style={{ marginTop: 16, display: 'grid', gap: 10, maxWidth: 520 }}
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{editing === 'new' ? 'Thêm tài khoản' : 'Sửa tài khoản'}</h2>
          <label className="pos-field">
            Hãng
            <select
              className="pos-input"
              value={form.carrier}
              disabled={editing !== 'new'}
              onChange={(e) => setForm((c) => ({ ...c, carrier: e.target.value as CarrierId }))}
            >
              {CARRIERS.map((id) => (
                <option key={id} value={id}>{POS_CARRIER_LABEL[id] || id}</option>
              ))}
            </select>
          </label>
          <label className="pos-field">
            Tên gợi nhớ
            <input className="pos-input" value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} placeholder={POS_CARRIER_LABEL[form.carrier]} />
          </label>
          {form.carrier === 'ghn' ? (
            <label className="pos-field">
              Mã cửa hàng (GHN)
              <input className="pos-input" value={form.shop_id} onChange={(e) => setForm((c) => ({ ...c, shop_id: e.target.value }))} placeholder="Mã cửa hàng GHN" />
            </label>
          ) : null}
          <label className="pos-field">
            Mã kết nối
            <input
              className="pos-input"
              type="password"
              autoComplete="new-password"
              value={form.token}
              onChange={(e) => setForm((c) => ({ ...c, token: e.target.value }))}
              placeholder={maskHint(editing !== 'new' && accounts.find((a) => a.id === editing)?.has_token === true)}
            />
          </label>
          <label className="pos-field" style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row' }}>
            <input type="checkbox" checked={form.test_mode} onChange={(e) => setForm((c) => ({ ...c, test_mode: e.target.checked }))} />
            Chế độ thử nghiệm (mặc định bật)
          </label>
          {form.test_mode ? (
            <p className="pos-warn" style={{ margin: 0 }}>
              Chế độ thử nghiệm đang bật. Hệ thống chỉ tạo vận đơn giả lập, không gọi API hãng và không phát sinh phí thật.
            </p>
          ) : (
            <p className="pos-warn is-block" style={{ margin: 0 }}>
              Bạn đang tắt chế độ thử nghiệm. Vận đơn thật chỉ được tạo khi máy chủ cho phép kết nối hãng và token hợp lệ.
            </p>
          )}
          <label className="pos-field" style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
            Tài khoản đang dùng
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="pos-btn pos-btn--teal" disabled={busy}>Lưu</button>
            <button type="button" className="pos-btn" onClick={() => testConnection()}>Kiểm tra kết nối</button>
            <button type="button" className="pos-btn pos-btn--sm" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      ) : null}

      {testMsg ? <p className="pos-hint" style={{ marginTop: 12, fontWeight: 600, color: '#115e59' }}>{testMsg}</p> : null}
    </div>
  );
}
