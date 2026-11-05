'use client';

// Parity: msos-head, msos-spine, msos-cal, msos-t, msos-layout
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { formatVnd, msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type Partner = { id: string; display_code: string; legal_name: string };
type Inventory = {
  id: string;
  display_code: string;
  name: string;
  owner_kind: string;
  partner_id: string | null;
  property_host: string | null;
};
type Placement = {
  id: string;
  inventory_id: string;
  name: string;
  format: string;
  unit_kind: string;
  brand_safety_tier: string;
};
type RateCard = {
  id: string;
  display_code: string;
  published_version: number | null;
  published_unit_price_vnd: number | null;
  draft_version: number | null;
};
type CalendarDay = {
  date: string;
  total: number;
  reserved_hard: number;
  reserved_soft: number;
  conflict: boolean;
};

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
}

export function MsosInventory() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [selectedPlacement, setSelectedPlacement] = useState<string>('');
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'partner' | 'inventory' | 'placement' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const invMap = useMemo(
    () => new Map(inventories.map((i) => [i.id, i])),
    [inventories],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, inv, pl, rc] = await Promise.all([
        msosGet<Partner[]>('/partners'),
        msosGet<Inventory[]>('/inventory'),
        msosGet<Placement[]>('/placements'),
        msosGet<RateCard[]>('/rate-cards'),
      ]);
      setPartners(p);
      setInventories(inv);
      setPlacements(pl);
      setRateCards(rc);
      if (pl.length && !selectedPlacement) setSelectedPlacement(pl[0].id);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedPlacement]);

  const loadCalendar = useCallback(async (placementId: string) => {
    if (!placementId) return;
    const { from, to } = weekRange();
    try {
      const days = await msosGet<CalendarDay[]>(
        `/placements/${placementId}/calendar?from=${from}&to=${to}`,
      );
      setCalendar(days);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedPlacement) void loadCalendar(selectedPlacement);
  }, [selectedPlacement, loadCalendar]);

  async function submitModal() {
    try {
      if (modal === 'partner') {
        await msosMutate('/partners', {
          method: 'POST',
          body: JSON.stringify({ legal_name: form.legal_name }),
        });
      } else if (modal === 'inventory') {
        await msosMutate('/inventory', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            owner_kind: form.owner_kind || 'ptt',
            partner_id: form.partner_id || null,
            property_host: form.property_host || null,
          }),
        });
      } else if (modal === 'placement') {
        await msosMutate('/placements', {
          method: 'POST',
          body: JSON.stringify({
            inventory_id: form.inventory_id,
            name: form.name,
            format: form.format,
            unit_kind: form.unit_kind || 'slot_day',
            backup_required: form.backup_required === 'true',
            max_weight_kb: form.max_weight_kb ? Number(form.max_weight_kb) : null,
          }),
        });
      }
      setModal(null);
      setForm({});
      await load();
      setToast('Đã tạo thành công');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Inventory…</p>;

  if (placements.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Inventory &amp; Rate Card</h1>
            <p>Placement, capacity calendar và rate card published.</p>
          </div>
          <div className="msos-actions">
            <button type="button" className="msos-btn" onClick={() => setModal('partner')}>
              ＋ Partner
            </button>
            <button type="button" className="msos-btn" onClick={() => setModal('inventory')}>
              ＋ Inventory
            </button>
            <button type="button" className="msos-btn msos-btn--blue" onClick={() => setModal('placement')}>
              ＋ Placement
            </button>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Inventory & Rate" copy={MSOS_EMPTY.inventory} />
        {modal ? (
          <div className="msos-modalback show">
            <div className="msos-modal" role="dialog">
              <h2>Tạo {modal}</h2>
              {modal === 'partner' ? (
                <label className="msos-field">
                  Tên pháp lý
                  <input
                    className="msos-input"
                    value={form.legal_name ?? ''}
                    onChange={(e) => setForm({ legal_name: e.target.value })}
                  />
                </label>
              ) : null}
              {modal === 'inventory' ? (
                <>
                  <label className="msos-field">
                    Tên
                    <input
                      className="msos-input"
                      value={form.name ?? ''}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </label>
                  <label className="msos-field">
                    Owner
                    <select
                      className="msos-input"
                      value={form.owner_kind ?? 'ptt'}
                      onChange={(e) => setForm({ ...form, owner_kind: e.target.value })}
                    >
                      <option value="ptt">PTT</option>
                      <option value="partner">Partner</option>
                    </select>
                  </label>
                  {form.owner_kind === 'partner' ? (
                    <label className="msos-field">
                      Partner
                      <select
                        className="msos-input"
                        value={form.partner_id ?? ''}
                        onChange={(e) => setForm({ ...form, partner_id: e.target.value })}
                      >
                        <option value="">Chọn partner</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.legal_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="msos-field">
                    Property host
                    <input
                      className="msos-input"
                      value={form.property_host ?? ''}
                      onChange={(e) => setForm({ ...form, property_host: e.target.value })}
                      placeholder="example.com"
                    />
                  </label>
                </>
              ) : null}
              {modal === 'placement' ? (
                <>
                  <label className="msos-field">
                    Inventory
                    <select
                      className="msos-input"
                      value={form.inventory_id ?? ''}
                      onChange={(e) => setForm({ ...form, inventory_id: e.target.value })}
                    >
                      <option value="">Chọn inventory</option>
                      {inventories.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.display_code} · {i.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="msos-field">
                    Tên placement
                    <input
                      className="msos-input"
                      value={form.name ?? ''}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </label>
                  <label className="msos-field">
                    Format
                    <input
                      className="msos-input"
                      value={form.format ?? ''}
                      onChange={(e) => setForm({ ...form, format: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
              <div className="msos-modal-foot">
                <button type="button" className="msos-btn" onClick={() => setModal(null)}>
                  Hủy
                </button>
                <button type="button" className="msos-btn msos-btn--blue" onClick={() => void submitModal()}>
                  Tạo
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  const selected = placements.find((p) => p.id === selectedPlacement);
  const selectedInv = selected ? invMap.get(selected.inventory_id) : undefined;
  const conflictCount = calendar.filter((d) => d.conflict).length;

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Inventory &amp; Rate Card</h1>
          <p>Property publisher + capacity tuần + conflict.</p>
        </div>
        <div className="msos-actions">
          <button type="button" className="msos-btn" onClick={() => setModal('placement')}>
            ＋ Placement
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setModal('inventory')}>
            ＋ Inventory
          </button>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-card" style={{ marginBottom: 14 }}>
        <div className="msos-filter">
          <select
            className="msos-input"
            value={selectedPlacement}
            onChange={(e) => setSelectedPlacement(e.target.value)}
          >
            {placements.map((p) => {
              const inv = invMap.get(p.inventory_id);
              return (
                <option key={p.id} value={p.id}>
                  {inv?.display_code ?? p.inventory_id} · {p.name}
                </option>
              );
            })}
          </select>
        </div>
        <div className="msos-table-scroll">
          <table className="msos-t">
            <thead>
              <tr>
                <th>Inventory / Placement</th>
                <th>Chủ</th>
                <th>Unit</th>
                <th>Capacity · tuần</th>
                <th>Rate published</th>
                <th>Safety</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((p) => {
                const inv = invMap.get(p.inventory_id);
                const rc = rateCards[0];
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="name">
                        {inv?.display_code ?? '—'} · {p.name}
                      </span>
                      <span className="dep">
                        {inv?.property_host ?? inv?.name ?? '—'} · {p.format}
                      </span>
                    </td>
                    <td>{inv?.owner_kind === 'partner' ? 'Partner' : 'PTT'}</td>
                    <td>{p.unit_kind}</td>
                    <td>
                      {calendar.length} ngày ·{' '}
                      {conflictCount > 0 ? (
                        <b className="down">{conflictCount} conflict</b>
                      ) : (
                        'OK'
                      )}
                    </td>
                    <td>
                      {rc?.published_version
                        ? `${rc.display_code} v${rc.published_version} · ${formatVnd(rc.published_unit_price_vnd ?? 0)}`
                        : '—'}
                    </td>
                    <td>
                      <span className="msos-tag green">Tier {p.brand_safety_tier}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? (
        <div className="msos-card msos-pad" style={{ marginBottom: 14 }}>
          <h3>Capacity tuần · {selectedInv?.display_code ?? selected.name}</h3>
          <p className="msos-desc">Hard = lock. Soft hết hạn 24h. Overbook hiện conflict.</p>
          <div className="msos-cal">
            <b />
            {calendar.map((d) => (
              <b key={`h-${d.date}`}>{d.date.slice(5)}</b>
            ))}
            <b>{selected.name}</b>
            {calendar.map((d) => (
              <span key={d.date}>
                {d.reserved_hard > 0 ? (
                  <em className={`slot hard${d.conflict ? ' conflict' : ''}`}>hard {d.reserved_hard}</em>
                ) : null}
                {d.reserved_soft > 0 ? (
                  <em className={`slot soft${d.conflict ? ' conflict' : ''}`}>soft {d.reserved_soft}</em>
                ) : null}
                {!d.reserved_hard && !d.reserved_soft ? '—' : null}
              </span>
            ))}
          </div>
          {conflictCount > 0 ? (
            <div className="msos-notice danger">GT-P0 overbook: calendar có conflict — xử lý trước khi Tạo IO.</div>
          ) : null}
        </div>
      ) : null}
      <div className="msos-grid2">
        <div className="msos-card msos-pad">
          <h3>Rate cards</h3>
          {rateCards.length === 0 ? (
            <p className="msos-desc">Chưa có rate card.</p>
          ) : (
            rateCards.map((rc) => (
              <div className="msos-row" key={rc.id}>
                <span>
                  {rc.display_code}
                  {rc.published_version ? ` v${rc.published_version} published` : ''}
                </span>
                <span className={`msos-tag ${rc.published_version ? 'green' : 'gray'}`}>
                  {rc.published_version ? 'IO được bind' : 'GT-01 fail'}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="msos-card msos-pad">
          <h3>Partners</h3>
          {partners.length === 0 ? (
            <p className="msos-desc">Chưa có partner.</p>
          ) : (
            partners.map((p) => (
              <div className="msos-row" key={p.id}>
                <span>{p.display_code}</span>
                <b>{p.legal_name}</b>
              </div>
            ))
          )}
          <div className="msos-row">
            <span>Reseller C</span>
            <span className="msos-tag lock">Khóa</span>
          </div>
        </div>
      </div>
      {modal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Tạo {modal}</h2>
            {modal === 'inventory' ? (
              <>
                <label className="msos-field">
                  Tên
                  <input
                    className="msos-input"
                    value={form.name ?? ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="msos-field">
                  Owner
                  <select
                    className="msos-input"
                    value={form.owner_kind ?? 'ptt'}
                    onChange={(e) => setForm({ ...form, owner_kind: e.target.value })}
                  >
                    <option value="ptt">PTT</option>
                    <option value="partner">Partner</option>
                  </select>
                </label>
                {form.owner_kind === 'partner' ? (
                  <label className="msos-field">
                    Partner
                    <select
                      className="msos-input"
                      value={form.partner_id ?? ''}
                      onChange={(e) => setForm({ ...form, partner_id: e.target.value })}
                    >
                      <option value="">Chọn partner</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.legal_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="msos-field">
                  Property host
                  <input
                    className="msos-input"
                    value={form.property_host ?? ''}
                    onChange={(e) => setForm({ ...form, property_host: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            {modal === 'placement' ? (
              <>
                <label className="msos-field">
                  Inventory
                  <select
                    className="msos-input"
                    value={form.inventory_id ?? ''}
                    onChange={(e) => setForm({ ...form, inventory_id: e.target.value })}
                  >
                    <option value="">Chọn inventory</option>
                    {inventories.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.display_code} · {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="msos-field">
                  Tên placement
                  <input
                    className="msos-input"
                    value={form.name ?? ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="msos-field">
                  Format
                  <input
                    className="msos-input"
                    value={form.format ?? ''}
                    onChange={(e) => setForm({ ...form, format: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void submitModal()}>
                Tạo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}
