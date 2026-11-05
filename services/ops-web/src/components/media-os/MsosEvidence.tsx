'use client';

// Parity: msos-head, msos-spine, msos-t, msos-grid2
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type EvidencePack = {
  id: string;
  display_code: string;
  media_line_id: string;
  status: 'draft' | 'official';
  official_at: string | null;
};

type MediaLine = { id: string; display_code: string };

type Placement = { id: string; name: string; inventory_id: string };

type Discrepancy = {
  id: string;
  display_code: string;
  media_line_id: string;
  io_qty: number;
  report_qty: number | null;
  material: boolean;
  hypothesis: string | null;
  status: string;
};

type MakeGood = {
  id: string;
  display_code: string;
  media_line_id: string;
  qty: number;
  value_vnd: number;
  capacity_reserved: boolean;
  closed_at: string | null;
};

export function MsosEvidence() {
  const [packs, setPacks] = useState<EvidencePack[]>([]);
  const [lines, setLines] = useState<MediaLine[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [makeGoods, setMakeGoods] = useState<MakeGood[]>([]);
  const [selectedDcId, setSelectedDcId] = useState('');
  const [selectedMgId, setSelectedMgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [packModal, setPackModal] = useState(false);
  const [dcModal, setDcModal] = useState(false);
  const [mgModal, setMgModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);
  const [packForm, setPackForm] = useState({
    media_line_id: '',
    source: 'publisher-report',
    hash: '',
    captured_at: new Date().toISOString().slice(0, 10),
  });
  const [dcForm, setDcForm] = useState({ media_line_id: '', report_qty: '', hypothesis: '' });
  const [mgForm, setMgForm] = useState({ discrepancy_id: '', qty: '', value_vnd: '' });
  const [reserveForm, setReserveForm] = useState({ placement_id: '', bucket_date: '' });

  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ml, pl, dc, mg] = await Promise.all([
        msosGet<EvidencePack[]>('/evidence-packs'),
        msosGet<MediaLine[]>('/media-lines'),
        msosGet<Placement[]>('/placements'),
        msosGet<Discrepancy[]>('/discrepancy-cases'),
        msosGet<MakeGood[]>('/make-goods'),
      ]);
      setPacks(p);
      setLines(ml);
      setPlacements(pl);
      setDiscrepancies(dc);
      setMakeGoods(mg);
      setSelectedDcId((prev) => prev || dc[0]?.id || '');
      setSelectedMgId((prev) => prev || mg[0]?.id || '');
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDc = discrepancies.find((d) => d.id === selectedDcId) ?? discrepancies[0] ?? null;
  const selectedMg = makeGoods.find((m) => m.id === selectedMgId) ?? makeGoods[0] ?? null;

  async function createPackWithEvidence() {
    if (!packForm.media_line_id || !packForm.hash.trim()) {
      setToast('Chọn media line và nhập hash evidence');
      return;
    }
    try {
      const pack = await msosMutate<EvidencePack>('/evidence-packs', {
        method: 'POST',
        body: JSON.stringify({ media_line_id: packForm.media_line_id }),
      });
      const evidence = await msosMutate<{ id: string }>('/evidence', {
        method: 'POST',
        body: JSON.stringify({
          media_line_id: packForm.media_line_id,
          source: packForm.source.trim(),
          hash: packForm.hash.trim(),
          captured_at: `${packForm.captured_at}T12:00:00+07:00`,
        }),
      });
      await msosMutate(`/evidence-packs/${pack.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ evidence_id: evidence.id }),
      });
      setPackModal(false);
      await load();
      setToast(`Đã tạo pack ${pack.display_code} + evidence`);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createDiscrepancy() {
    if (!dcForm.media_line_id || !dcForm.report_qty) {
      setToast('Chọn line và report qty');
      return;
    }
    try {
      await msosMutate(`/media-lines/${dcForm.media_line_id}/discrepancy`, {
        method: 'POST',
        body: JSON.stringify({
          report_qty: Number(dcForm.report_qty),
          hypothesis: dcForm.hypothesis.trim() || null,
        }),
      });
      setDcModal(false);
      await load();
      setToast('Đã tạo discrepancy case');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function waiveDiscrepancy() {
    if (!selectedDc) return;
    try {
      await msosMutate(`/discrepancy/${selectedDc.id}/waive`, { method: 'POST', body: '{}' });
      await load();
      setToast('DC đã waived — GT-P10 có thể mở nếu không còn material open');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createMakeGood() {
    if (!mgForm.discrepancy_id || !mgForm.qty) {
      setToast('Chọn discrepancy và qty');
      return;
    }
    try {
      await msosMutate(`/discrepancy/${mgForm.discrepancy_id}/make-good`, {
        method: 'POST',
        body: JSON.stringify({
          qty: Number(mgForm.qty),
          value_vnd: Number(mgForm.value_vnd) || 0,
        }),
      });
      setMgModal(false);
      await load();
      setToast('Đã tạo make-good');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function reserveMakeGood() {
    if (!selectedMg || !reserveForm.placement_id || !reserveForm.bucket_date) {
      setToast('Chọn placement và ngày reserve');
      return;
    }
    try {
      await msosMutate(`/make-goods/${selectedMg.id}/reserve-capacity`, {
        method: 'POST',
        body: JSON.stringify({
          placement_id: reserveForm.placement_id,
          bucket_date: reserveForm.bucket_date,
        }),
      });
      setReserveModal(false);
      await load();
      setToast('Make-good capacity reserved');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function closeMakeGood() {
    if (!selectedMg) return;
    try {
      await msosMutate(`/make-goods/${selectedMg.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'human' }),
      });
      await load();
      setToast('Make-good đã close (người)');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function officialPack(packId: string) {
    try {
      await msosMutate(`/evidence-packs/${packId}/official`, { method: 'POST', body: '{}' });
      await load();
      setToast('Pack đã official');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Evidence…</p>;

  if (lines.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Delivery Evidence</h1>
            <p>Evidence pack, discrepancy và make-good.</p>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Evidence" copy={MSOS_EMPTY.evidence} />
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  const showGuidedEmpty = packs.length === 0 && discrepancies.length === 0;

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Delivery Evidence</h1>
          <p>Pack official (GT-P04) + discrepancy (GT-P05) + make-good (GT-P06).</p>
        </div>
        <div className="msos-actions">
          <button type="button" className="msos-btn" onClick={() => setPackModal(true)}>
            ＋ Evidence pack
          </button>
          <button type="button" className="msos-btn" onClick={() => setDcModal(true)}>
            ＋ Discrepancy
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setMgModal(true)}>
            ＋ Make-good
          </button>
        </div>
      </header>
      <MsosSpine />
      {showGuidedEmpty ? (
        <div className="msos-card msos-pad" style={{ marginBottom: 14 }}>
          <h3>Chưa có evidence pack</h3>
          <p className="msos-desc">
            Chọn media line live → tạo pack + evidence item (hash + source) → Official để mở Finance.
          </p>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setPackModal(true)}>
            Tạo evidence pack đầu tiên
          </button>
        </div>
      ) : null}
      {packs.length > 0 ? (
        <div className="msos-card" style={{ marginBottom: 14 }}>
          <div className="msos-table-scroll">
            <table className="msos-t">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Line</th>
                  <th>Official</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packs.map((pack) => {
                  const line = lineMap.get(pack.media_line_id);
                  return (
                    <tr key={pack.id}>
                      <td>
                        <span className="name">{pack.display_code}</span>
                      </td>
                      <td>{line?.display_code ?? pack.media_line_id.slice(0, 8)}</td>
                      <td>
                        <span className={`msos-tag ${pack.status === 'official' ? 'green' : 'red'}`}>
                          {pack.status}
                        </span>
                      </td>
                      <td>
                        {pack.status === 'draft' ? (
                          <button
                            type="button"
                            className="msos-btn msos-btn--small"
                            onClick={() => void officialPack(pack.id)}
                          >
                            Official
                          </button>
                        ) : (
                          <Link className="msos-btn msos-btn--small" href="/crm/media-os/margin">
                            Dùng margin
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="msos-grid2">
        <div className="msos-card msos-pad">
          <h3>Discrepancy lite {selectedDc ? `· ${selectedDc.display_code}` : ''}</h3>
          {discrepancies.length > 1 ? (
            <label className="msos-field">
              Chọn case
              <select
                className="msos-input"
                value={selectedDc?.id ?? ''}
                onChange={(e) => setSelectedDcId(e.target.value)}
              >
                {discrepancies.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_code} · {d.status}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedDc ? (
            <>
              <p className="msos-desc">
                IO {selectedDc.io_qty.toLocaleString('vi-VN')} · report{' '}
                {selectedDc.report_qty?.toLocaleString('vi-VN') ?? '—'}
              </p>
              <div className="msos-row">
                <span>Status</span>
                <span className={`msos-tag ${selectedDc.status === 'open' ? 'amber' : 'green'}`}>
                  {selectedDc.status}
                </span>
              </div>
              <div className="msos-row">
                <span>Material</span>
                <span className={`msos-tag ${selectedDc.material ? 'red' : 'green'}`}>
                  {selectedDc.material ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="msos-row">
                <span>Ghi actual = plan</span>
                <span className="msos-tag red">Cấm GT-P06</span>
              </div>
              {selectedDc.status === 'open' && selectedDc.material ? (
                <button type="button" className="msos-btn msos-btn--small" onClick={() => void waiveDiscrepancy()}>
                  Waive DC (GT-P10)
                </button>
              ) : null}
            </>
          ) : (
            <p className="msos-desc">Chưa có discrepancy case.</p>
          )}
        </div>
        <div className="msos-card msos-pad">
          <h3>Make-good {selectedMg ? `· ${selectedMg.display_code}` : ''}</h3>
          {makeGoods.length > 1 ? (
            <label className="msos-field">
              Chọn MG
              <select
                className="msos-input"
                value={selectedMg?.id ?? ''}
                onChange={(e) => setSelectedMgId(e.target.value)}
              >
                {makeGoods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_code}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedMg ? (
            <>
              <p className="msos-desc">
                Bù {selectedMg.qty.toLocaleString('vi-VN')} qty · value{' '}
                {selectedMg.value_vnd.toLocaleString('vi-VN')}
              </p>
              <div className="msos-row">
                <span>Capacity bù</span>
                <span className={`msos-tag ${selectedMg.capacity_reserved ? 'green' : 'amber'}`}>
                  {selectedMg.capacity_reserved ? 'Reserved' : 'Chưa reserve'}
                </span>
              </div>
              <div className="msos-row">
                <span>Closed</span>
                <span className={`msos-tag ${selectedMg.closed_at ? 'green' : 'gray'}`}>
                  {selectedMg.closed_at ? 'Yes' : 'Open'}
                </span>
              </div>
              <div className="msos-actions">
                {!selectedMg.capacity_reserved && !selectedMg.closed_at ? (
                  <button type="button" className="msos-btn msos-btn--small" onClick={() => setReserveModal(true)}>
                    Reserve capacity
                  </button>
                ) : null}
                {!selectedMg.closed_at ? (
                  <button type="button" className="msos-btn msos-btn--small" onClick={() => void closeMakeGood()}>
                    Close (người)
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="msos-desc">Chưa có make-good.</p>
          )}
        </div>
      </div>
      {packModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Tạo evidence pack</h2>
            <label className="msos-field">
              Media line
              <select
                className="msos-input"
                value={packForm.media_line_id}
                onChange={(e) => setPackForm({ ...packForm, media_line_id: e.target.value })}
              >
                <option value="">Chọn line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.display_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="msos-field">
              Source
              <input
                className="msos-input"
                value={packForm.source}
                onChange={(e) => setPackForm({ ...packForm, source: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Hash (SHA-256)
              <input
                className="msos-input"
                value={packForm.hash}
                onChange={(e) => setPackForm({ ...packForm, hash: e.target.value })}
                placeholder="64-char hex"
              />
            </label>
            <label className="msos-field">
              Captured at
              <input
                className="msos-input"
                type="date"
                value={packForm.captured_at}
                onChange={(e) => setPackForm({ ...packForm, captured_at: e.target.value })}
              />
            </label>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setPackModal(false)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void createPackWithEvidence()}>
                Tạo pack + evidence
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {dcModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Tạo discrepancy</h2>
            <label className="msos-field">
              Media line
              <select
                className="msos-input"
                value={dcForm.media_line_id}
                onChange={(e) => setDcForm({ ...dcForm, media_line_id: e.target.value })}
              >
                <option value="">Chọn line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.display_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="msos-field">
              Report qty
              <input
                className="msos-input"
                type="number"
                value={dcForm.report_qty}
                onChange={(e) => setDcForm({ ...dcForm, report_qty: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Hypothesis
              <input
                className="msos-input"
                value={dcForm.hypothesis}
                onChange={(e) => setDcForm({ ...dcForm, hypothesis: e.target.value })}
              />
            </label>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setDcModal(false)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void createDiscrepancy()}>
                Tạo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {mgModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Tạo make-good</h2>
            <label className="msos-field">
              Discrepancy
              <select
                className="msos-input"
                value={mgForm.discrepancy_id}
                onChange={(e) => setMgForm({ ...mgForm, discrepancy_id: e.target.value })}
              >
                <option value="">Chọn DC</option>
                {discrepancies.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="msos-field">
              Qty
              <input
                className="msos-input"
                type="number"
                value={mgForm.qty}
                onChange={(e) => setMgForm({ ...mgForm, qty: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Value VND
              <input
                className="msos-input"
                type="number"
                value={mgForm.value_vnd}
                onChange={(e) => setMgForm({ ...mgForm, value_vnd: e.target.value })}
              />
            </label>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setMgModal(false)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void createMakeGood()}>
                Tạo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {reserveModal && selectedMg ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Reserve make-good capacity</h2>
            <p className="msos-desc">Hard reserve ngày khác · qty {selectedMg.qty}</p>
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
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setReserveModal(false)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void reserveMakeGood()}>
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
