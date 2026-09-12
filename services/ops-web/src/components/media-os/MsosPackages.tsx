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

type RateCard = {
  id: string;
  display_code: string;
  published_rate_version_id: string | null;
  published_version: number | null;
  published_unit_price_vnd: number | null;
};

type Reservation = {
  id: string;
  package_id: string;
  placement_id: string;
  bucket_date: string;
  kind: string;
  qty: number;
};

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
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [reservationsByPkg, setReservationsByPkg] = useState<Map<string, Reservation[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [pkgModal, setPkgModal] = useState(false);
  const [reserveModal, setReserveModal] = useState<PackageRow | null>(null);
  const [reserveForm, setReserveForm] = useState({
    placement_id: '',
    bucket_date: '',
    qty: '1',
  });
  const [form, setForm] = useState({
    client_id: '',
    placement_id: '',
    rate_version_id: '',
    qty: '1',
    period_start: '',
    period_end: '',
  });
  const [draft, setDraft] = useState<{ text: string } | null>(null);

  const publishedRates = useMemo(
    () => rateCards.filter((rc) => rc.published_rate_version_id),
    [rateCards],
  );

  const ioByPackage = useMemo(() => {
    const map = new Map<string, IoRow>();
    for (const io of ios) map.set(io.package_id, io);
    return map;
  }, [ios]);

  const loadReservations = useCallback(async (pkgs: PackageRow[]) => {
    const entries = await Promise.all(
      pkgs.map(async (pkg) => {
        try {
          const rows = await msosGet<Reservation[]>(`/packages/${pkg.id}/reservations`);
          return [pkg.id, rows] as const;
        } catch {
          return [pkg.id, []] as const;
        }
      }),
    );
    setReservationsByPkg(new Map(entries));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, ioList, pl, rc] = await Promise.all([
        msosGet<PackageRow[]>('/packages'),
        msosGet<IoRow[]>('/insertion-orders'),
        msosGet<Placement[]>('/placements'),
        msosGet<RateCard[]>('/rate-cards'),
      ]);
      setPackages(pkgs);
      setIos(ioList);
      setPlacements(pl);
      setRateCards(rc);
      await loadReservations(pkgs);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadReservations]);

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

  async function openReserveModal(pkg: PackageRow) {
    try {
      const detail = await msosGet<PackageDetail>(`/packages/${pkg.id}`);
      const line = detail.lines?.[0];
      setReserveForm({
        placement_id: line?.placement_id ?? '',
        bucket_date: line?.period_start ?? '',
        qty: '1',
      });
      setReserveModal(pkg);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function submitReserve() {
    if (!reserveModal) return;
    try {
      await msosMutate(`/packages/${reserveModal.id}/reserve`, {
        method: 'POST',
        body: JSON.stringify({
          placement_id: reserveForm.placement_id,
          bucket_date: reserveForm.bucket_date,
          kind: 'hard',
          qty: Number(reserveForm.qty),
        }),
      });
      setReserveModal(null);
      await load();
      setToast('Đã hard reserve');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createAndIssueIo(pkgId: string) {
    const reserves = reservationsByPkg.get(pkgId) ?? [];
    if (!reserves.some((r) => r.kind === 'hard' || r.kind === 'soft')) {
      setToast('Cần reserve trước khi tạo IO');
      return;
    }
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

  function reserveLabel(pkgId: string): { text: string; tone: 'green' | 'amber' | 'gray' } {
    const rows = reservationsByPkg.get(pkgId) ?? [];
    const hard = rows.filter((r) => r.kind === 'hard');
    if (hard.length) {
      const qty = hard.reduce((s, r) => s + Number(r.qty), 0);
      return { text: `hard ×${qty}`, tone: 'green' };
    }
    const soft = rows.filter((r) => r.kind === 'soft');
    if (soft.length) return { text: 'soft', tone: 'amber' };
    return { text: 'Chưa reserve', tone: 'gray' };
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
            publishedRates={publishedRates}
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
                const reserve = reserveLabel(pkg.id);
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
                      <span className={`msos-tag ${reserve.tone}`}>{reserve.text}</span>
                      {!io ? (
                        <button
                          type="button"
                          className="msos-btn msos-btn--small"
                          style={{ marginLeft: 8 }}
                          onClick={() => void openReserveModal(pkg)}
                        >
                          Reserve
                        </button>
                      ) : null}
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
          publishedRates={publishedRates}
          onClose={() => setPkgModal(false)}
          onSubmit={() => void createPackage()}
        />
      ) : null}
      {reserveModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Hard reserve · {reserveModal.display_code}</h2>
            <p className="msos-desc">Qty ≤ capacity/ngày trên calendar Inventory.</p>
            <label className="msos-field">
              Placement
              <select
                className="msos-input"
                value={reserveForm.placement_id}
                onChange={(e) => setReserveForm({ ...reserveForm, placement_id: e.target.value })}
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
              Bucket date
              <input
                className="msos-input"
                type="date"
                value={reserveForm.bucket_date}
                onChange={(e) => setReserveForm({ ...reserveForm, bucket_date: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Qty (hard)
              <input
                className="msos-input"
                type="number"
                min={1}
                value={reserveForm.qty}
                onChange={(e) => setReserveForm({ ...reserveForm, qty: e.target.value })}
              />
            </label>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setReserveModal(null)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void submitReserve()}>
                Reserve
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function PackageModal({
  form,
  setForm,
  placements,
  publishedRates,
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
  publishedRates: RateCard[];
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
          Rate published
          <select
            className="msos-input"
            value={form.rate_version_id}
            onChange={(e) => setForm({ ...form, rate_version_id: e.target.value })}
          >
            <option value="">Chọn rate</option>
            {publishedRates.map((rc) => (
              <option key={rc.published_rate_version_id!} value={rc.published_rate_version_id!}>
                {rc.display_code}
                {rc.published_version ? ` v${rc.published_version}` : ''}
                {rc.published_unit_price_vnd != null
                  ? ` · ${formatVnd(rc.published_unit_price_vnd)}`
                  : ''}
              </option>
            ))}
          </select>
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
