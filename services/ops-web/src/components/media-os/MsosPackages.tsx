'use client';

// Parity: msos-head, msos-spine, msos-t, msos-layout, msos-ai
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { formatVnd, msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type PackageRow = {
  id: string;
  display_code: string;
  client_id: string;
  sell_vnd: number;
  commercial_ref: string | null;
};

type IoRow = {
  id: string;
  display_code: string;
  package_id: string;
  status: string;
};

type Placement = { id: string; name: string; inventory_id: string };
type PackageDetail = PackageRow & {
  lines?: Array<{
    placement_id: string;
    rate_version_id: string;
    qty: number;
    period_start: string;
    period_end: string;
  }>;
};

export function MsosPackages() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [ios, setIos] = useState<IoRow[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [pkgModal, setPkgModal] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    placement_id: '',
    rate_version_id: '',
    qty: '1',
    period_start: '',
    period_end: '',
  });
  const [draft, setDraft] = useState<{ text: string } | null>(null);

  const ioByPackage = useMemo(() => {
    const map = new Map<string, IoRow>();
    for (const io of ios) map.set(io.package_id, io);
    return map;
  }, [ios]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, ioList, pl] = await Promise.all([
        msosGet<PackageRow[]>('/packages'),
        msosGet<IoRow[]>('/insertion-orders'),
        msosGet<Placement[]>('/placements'),
      ]);
      setPackages(pkgs);
      setIos(ioList);
      setPlacements(pl);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPackage() {
    try {
      await msosMutate('/packages', {
        method: 'POST',
        body: JSON.stringify({
          client_id: form.client_id,
          lines: [
            {
              placement_id: form.placement_id,
              rate_version_id: form.rate_version_id,
              qty: Number(form.qty),
              period_start: form.period_start,
              period_end: form.period_end,
            },
          ],
        }),
      });
      setPkgModal(false);
      await load();
      setToast('Đã tạo package');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createAndIssueIo(pkgId: string) {
    try {
      const pkg = await msosGet<PackageDetail>(`/packages/${pkgId}`);
      const line = pkg.lines?.[0];
      if (!line) {
        setToast('package_lines_required');
        return;
      }
      const io = await msosMutate<IoRow>(`/packages/${pkgId}/io`, {
        method: 'POST',
        body: JSON.stringify({
          rate_version_id: line.rate_version_id,
          period_start: line.period_start,
          period_end: line.period_end,
          qty: line.qty,
          sell_vnd: pkg.sell_vnd,
        }),
      });
      await msosMutate(`/insertion-orders/${io.id}/issue`, { method: 'POST', body: '{}' });
      await load();
      setToast('Đã issue IO');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function loadDraft() {
    try {
      const ml = await msosGet<Array<{ id: string }>>('/media-lines');
      if (!ml.length) return;
      const d = await msosMutate<{ text: string }>('/drafts', {
        method: 'POST',
        body: JSON.stringify({ kind: 'io', media_line_id: ml[0].id }),
      });
      setDraft(d);
    } catch {
      setDraft(null);
    }
  }

  if (loading) return <p className="msos-status">Đang tải Packages…</p>;

  if (packages.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Packages &amp; Reservation</h1>
            <p>Package lines, reserve và tạo insertion order.</p>
          </div>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setPkgModal(true)}>
            ＋ Package
          </button>
        </header>
        <MsosSpine />
        <MsosEmpty title="Packages" copy={MSOS_EMPTY.packages} />
        {pkgModal ? (
          <PackageModal
            form={form}
            setForm={setForm}
            placements={placements}
            onClose={() => setPkgModal(false)}
            onSubmit={() => void createPackage()}
          />
        ) : null}
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Packages &amp; Reservation</h1>
          <p>Reserve sạch → Tạo IO. Cổng C không hiện che buy-side.</p>
        </div>
        <div className="msos-actions">
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setPkgModal(true)}>
            ＋ Package
          </button>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-card" style={{ marginBottom: 14 }}>
        <div className="msos-table-scroll">
          <table className="msos-t">
            <thead>
              <tr>
                <th>Package</th>
                <th>Client</th>
                <th>Sell</th>
                <th>Reserve</th>
                <th>IO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => {
                const io = ioByPackage.get(pkg.id);
                return (
                  <tr key={pkg.id}>
                    <td>
                      <span className="name">{pkg.display_code}</span>
                      <span className="dep">{pkg.commercial_ref ?? pkg.client_id.slice(0, 8)}</span>
                    </td>
                    <td>
                      <Link className="msos-link" href={`/crm/clients/${pkg.client_id}`}>
                        {pkg.client_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td>{formatVnd(pkg.sell_vnd)}</td>
                    <td>
                      <span className="msos-tag amber">Xem inventory</span>
                    </td>
                    <td>
                      {io ? (
                        <span className={`msos-tag ${io.status === 'issued' ? 'green' : 'gray'}`}>
                          {io.display_code}
                        </span>
                      ) : (
                        <span className="msos-tag gray">—</span>
                      )}
                    </td>
                    <td>
                      {io ? (
                        <Link className="msos-btn msos-btn--small" href="/crm/media-os/campaigns">
                          Mở line
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="msos-btn msos-btn--small"
                          onClick={() => void createAndIssueIo(pkg.id)}
                        >
                          Tạo IO
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="msos-grid2">
        <div className="msos-card msos-pad">
          <h3>Che buy-side (Cổng C)</h3>
          <p className="msos-desc">Wave 1: khóa. WIN không mở reseller.</p>
          <div className="msos-row">
            <span>Ẩn buy cost</span>
            <span className="msos-tag lock">Disabled</span>
          </div>
          <button type="button" className="msos-btn off" disabled>
            Bật white-label
          </button>
        </div>
        {draft ? (
          <div className="msos-ai">
            <b>✦ IO composer · A1</b>
            <p>{draft.text}</p>
          </div>
        ) : (
          <div className="msos-ai">
            <b>✦ IO composer · A1</b>
            <p>Chọn media line để xem draft template từ facts thật.</p>
            <button type="button" className="msos-btn msos-btn--small" onClick={() => void loadDraft()}>
              Xem draft
            </button>
          </div>
        )}
      </div>
      {pkgModal ? (
        <PackageModal
          form={form}
          setForm={setForm}
          placements={placements}
          onClose={() => setPkgModal(false)}
          onSubmit={() => void createPackage()}
        />
      ) : null}
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function PackageModal({
  form,
  setForm,
  placements,
  onClose,
  onSubmit,
}: {
  form: {
    client_id: string;
    placement_id: string;
    rate_version_id: string;
    qty: string;
    period_start: string;
    period_end: string;
  };
  setForm: (f: typeof form) => void;
  placements: Placement[];
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="msos-modalback show">
      <div className="msos-modal" role="dialog">
        <h2>Tạo package</h2>
        <label className="msos-field">
          Client UUID (CRM)
          <input
            className="msos-input"
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            placeholder="00000000-0000-4000-8000-000000000001"
          />
        </label>
        <label className="msos-field">
          Placement
          <select
            className="msos-input"
            value={form.placement_id}
            onChange={(e) => setForm({ ...form, placement_id: e.target.value })}
          >
            <option value="">Chọn placement</option>
            {placements.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="msos-field">
          Rate version UUID
          <input
            className="msos-input"
            value={form.rate_version_id}
            onChange={(e) => setForm({ ...form, rate_version_id: e.target.value })}
          />
        </label>
        <label className="msos-field">
          Qty
          <input
            className="msos-input"
            type="number"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
          />
        </label>
        <label className="msos-field">
          Period start
          <input
            className="msos-input"
            type="date"
            value={form.period_start}
            onChange={(e) => setForm({ ...form, period_start: e.target.value })}
          />
        </label>
        <label className="msos-field">
          Period end
          <input
            className="msos-input"
            type="date"
            value={form.period_end}
            onChange={(e) => setForm({ ...form, period_end: e.target.value })}
          />
        </label>
        <div className="msos-modal-foot">
          <button type="button" className="msos-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={onSubmit}>
            Tạo
          </button>
        </div>
      </div>
    </div>
  );
}
