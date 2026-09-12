'use client';

// Parity: msos-head, msos-spine, msos-t, msos-grid2
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
};

export function MsosEvidence() {
  const [packs, setPacks] = useState<EvidencePack[]>([]);
  const [lines, setLines] = useState<MediaLine[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [makeGoods, setMakeGoods] = useState<MakeGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [mgModal, setMgModal] = useState(false);
  const [dcForm, setDcForm] = useState({ media_line_id: '', report_qty: '' });
  const [mgForm, setMgForm] = useState({ discrepancy_id: '', qty: '', value_vnd: '' });

  const lineMap = new Map(lines.map((l) => [l.id, l]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ml, dc, mg] = await Promise.all([
        msosGet<EvidencePack[]>('/evidence-packs'),
        msosGet<MediaLine[]>('/media-lines'),
        msosGet<Discrepancy[]>('/discrepancy-cases'),
        msosGet<MakeGood[]>('/make-goods'),
      ]);
      setPacks(p);
      setLines(ml);
      setDiscrepancies(dc);
      setMakeGoods(mg);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDiscrepancy() {
    try {
      await msosMutate(`/media-lines/${dcForm.media_line_id}/discrepancy`, {
        method: 'POST',
        body: JSON.stringify({ report_qty: Number(dcForm.report_qty) }),
      });
      await load();
      setToast('Đã tạo discrepancy case');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createMakeGood() {
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

  if (packs.length === 0 && discrepancies.length === 0) {
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

  const primaryDc = discrepancies[0];
  const primaryMg = makeGoods[0];

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Delivery Evidence</h1>
          <p>Pack official (GT-P04) + discrepancy lite (GT-P05) + make-good (GT-P06).</p>
        </div>
        <div className="msos-actions">
          <button type="button" className="msos-btn" onClick={() => void createDiscrepancy()}>
            ＋ Discrepancy
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setMgModal(true)}>
            ＋ Make-good
          </button>
        </div>
      </header>
      <MsosSpine />
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
      <div className="msos-grid2">
        <div className="msos-card msos-pad">
          <h3>Discrepancy lite {primaryDc ? `· ${primaryDc.display_code}` : ''}</h3>
          {primaryDc ? (
            <>
              <p className="msos-desc">
                IO {primaryDc.io_qty.toLocaleString('vi-VN')} · report{' '}
                {primaryDc.report_qty?.toLocaleString('vi-VN') ?? '—'}
              </p>
              <div className="msos-row">
                <span>Material</span>
                <span className={`msos-tag ${primaryDc.material ? 'red' : 'green'}`}>
                  {primaryDc.material ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="msos-row">
                <span>Hypothesis</span>
                <b>{primaryDc.hypothesis ?? '—'}</b>
              </div>
              <div className="msos-row">
                <span>Ghi actual = plan</span>
                <span className="msos-tag red">Cấm GT-P06</span>
              </div>
            </>
          ) : (
            <p className="msos-desc">Chưa có discrepancy case.</p>
          )}
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
        </div>
        <div className="msos-card msos-pad">
          <h3>Make-good {primaryMg ? `· ${primaryMg.display_code}` : ''}</h3>
          {primaryMg ? (
            <>
              <p className="msos-desc">
                Bù {primaryMg.qty.toLocaleString('vi-VN')} qty · value {primaryMg.value_vnd.toLocaleString('vi-VN')}
              </p>
              <div className="msos-row">
                <span>Capacity bù</span>
                <span className={`msos-tag ${primaryMg.capacity_reserved ? 'green' : 'amber'}`}>
                  {primaryMg.capacity_reserved ? 'Reserved' : 'Chưa reserve'}
                </span>
              </div>
            </>
          ) : (
            <p className="msos-desc">Chưa có make-good.</p>
          )}
          <button type="button" className="msos-btn msos-btn--small off" disabled>
            §4.3 Workbench đầy đủ
          </button>
        </div>
      </div>
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
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}
