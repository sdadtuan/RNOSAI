'use client';

// Parity: msos-head, msos-spine, msos-gate, msos-layout, msos-t
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { canEnableLiveButton } from '@/lib/crm/msos-gates-ui';
import { msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type MediaLine = {
  id: string;
  display_code: string;
  package_id: string;
  io_id: string | null;
  client_id: string;
  commercial_ref: string | null;
  status: string;
};

type IoRow = {
  id: string;
  display_code: string;
  status: string;
  partner_confirmed_at: string | null;
};

type Traffic = {
  id: string;
  display_code: string;
  status: string;
  creative_id: string | null;
  click_url: string | null;
  weight_kb: number | null;
  backup_attached: boolean;
};

type Gate = { id: string; pass: boolean; level: 'pass' | 'fail' | 'warning'; detail: string };

export function MsosCampaigns() {
  const [lines, setLines] = useState<MediaLine[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [gates, setGates] = useState<Gate[]>([]);
  const [canLive, setCanLive] = useState(false);
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [ios, setIos] = useState<IoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [trafficModal, setTrafficModal] = useState(false);
  const [lineModal, setLineModal] = useState(false);
  const [liveModal, setLiveModal] = useState(false);
  const [packages, setPackages] = useState<Array<{ id: string; display_code: string }>>([]);
  const [trafficForm, setTrafficForm] = useState({
    creative_id: '',
    click_url: '',
    width_px: '',
    height_px: '',
    weight_kb: '',
    backup_attached: false,
  });
  const [lineForm, setLineForm] = useState({ package_id: '', io_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ml, ioList, pkgs] = await Promise.all([
        msosGet<MediaLine[]>('/media-lines'),
        msosGet<IoRow[]>('/insertion-orders'),
        msosGet<Array<{ id: string; display_code: string }>>('/packages'),
      ]);
      setLines(ml);
      setIos(ioList);
      setPackages(pkgs);
      if (ml.length && !selected) setSelected(ml[0].id);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const loadLineDetail = useCallback(async (lineId: string) => {
    if (!lineId) return;
    try {
      const [g, t] = await Promise.all([
        msosGet<{ canLive: boolean; gates: Gate[] }>(`/media-lines/${lineId}/gates`),
        msosGet<Traffic | null>(`/media-lines/${lineId}/traffic`).catch(() => null),
      ]);
      setGates(g.gates);
      setCanLive(g.canLive);
      setTraffic(t);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) void loadLineDetail(selected);
  }, [selected, loadLineDetail]);

  async function saveTraffic() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/traffic`, {
        method: 'PUT',
        body: JSON.stringify({
          creative_id: trafficForm.creative_id || null,
          click_url: trafficForm.click_url || null,
          width_px: trafficForm.width_px ? Number(trafficForm.width_px) : null,
          height_px: trafficForm.height_px ? Number(trafficForm.height_px) : null,
          weight_kb: trafficForm.weight_kb ? Number(trafficForm.weight_kb) : null,
          backup_attached: trafficForm.backup_attached,
        }),
      });
      await msosMutate(`/media-lines/${selected}/traffic/submit`, { method: 'POST', body: '{}' });
      setTrafficModal(false);
      await loadLineDetail(selected);
      setToast('Đã lưu traffic pack');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function createLine() {
    try {
      await msosMutate('/media-lines', {
        method: 'POST',
        body: JSON.stringify({
          package_id: lineForm.package_id,
          io_id: lineForm.io_id || null,
        }),
      });
      setLineModal(false);
      await load();
      setToast('Đã tạo media line');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function goLive() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/live`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, actor: 'human' }),
      });
      setLiveModal(false);
      await load();
      await loadLineDetail(selected);
      setToast('Line đã Live');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function overrideP03() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/p03-override`, { method: 'POST', body: '{}' });
      await loadLineDetail(selected);
      setToast('Đã override GT-P03');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function approveTraffic() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/traffic/approve`, { method: 'POST', body: '{}' });
      await loadLineDetail(selected);
      setToast('Traffic approved (GT-P02)');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function confirmPartnerIo() {
    const line = lines.find((l) => l.id === selected);
    if (!line?.io_id) return;
    try {
      await msosMutate(`/insertion-orders/${line.io_id}/partner-confirm`, {
        method: 'POST',
        body: JSON.stringify({ ref: 'pilot-email-confirm', actor: 'human' }),
      });
      await load();
      await loadLineDetail(selected);
      setToast('IO partner confirmed (GT-P03)');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Campaigns…</p>;

  if (lines.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Campaign Media Lines</h1>
            <p>Media lines, traffic pack và Publisher Live Gate.</p>
          </div>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setLineModal(true)}>
            ＋ Media line
          </button>
        </header>
        <MsosSpine />
        <MsosEmpty title="Campaigns" copy={MSOS_EMPTY.campaigns} />
        {lineModal ? (
          <LineModal
            packages={packages}
            ios={ios}
            form={lineForm}
            setForm={setLineForm}
            onClose={() => setLineModal(false)}
            onSubmit={() => void createLine()}
          />
        ) : null}
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  const selectedLine = lines.find((l) => l.id === selected);
  const io = ios.find((i) => i.id === selectedLine?.io_id);
  const liveEnabled = canEnableLiveButton(gates);

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Campaign Media Lines</h1>
          <p>Publisher Live Gate = GT-P01 + GT-P02; GT-P03 cần override người.</p>
        </div>
        <div className="msos-actions">
          <button type="button" className="msos-btn" onClick={() => setTrafficModal(true)}>
            Mở traffic pack
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setLineModal(true)}>
            ＋ Media line
          </button>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-card" style={{ marginBottom: 14 }}>
        <div className="msos-table-scroll">
          <table className="msos-t">
            <thead>
              <tr>
                <th>Media line</th>
                <th>CRM / IO</th>
                <th>Traffic</th>
                <th>Gate Live</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} onClick={() => setSelected(line.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="name">{line.display_code}</span>
                    <span className="dep">{line.commercial_ref ?? line.package_id.slice(0, 8)}</span>
                  </td>
                  <td>
                    <Link className="msos-link" href={`/crm/clients/${line.client_id}`}>
                      {line.client_id.slice(0, 8)}…
                    </Link>
                    <br />
                    <span className="dep">
                      {ios.find((i) => i.id === line.io_id)?.display_code ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`msos-tag ${
                        line.id === selected && traffic?.status === 'approved_by_partner'
                          ? 'green'
                          : line.id === selected && traffic?.status === 'rejected'
                            ? 'red'
                            : 'gray'
                      }`}
                    >
                      {line.id === selected ? (traffic?.status ?? 'draft') : '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`msos-tag ${line.status === 'live' ? 'green' : 'amber'}`}>
                      {line.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="msos-btn msos-btn--small"
                      disabled={line.id !== selected || !liveEnabled}
                      onClick={() => setLiveModal(true)}
                    >
                      Live (người)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedLine ? (
        <div className="msos-layout">
          <div className="msos-card msos-pad">
            <h3>Publisher Live Gate · {selectedLine.display_code}</h3>
            {gates.map((gate) => (
              <div className="msos-gate" key={gate.id}>
                <span
                  className={`gdot ${gate.level === 'pass' ? 'ok' : gate.level === 'warning' ? 'warn' : 'fail'}`}
                >
                  {gate.pass ? '✓' : gate.level === 'warning' ? '!' : '✕'}
                </span>
                <div>
                  <b>{gate.id}</b>
                  <span className="dep">{gate.detail}</span>
                </div>
              </div>
            ))}
            <div className="msos-notice warn">
              Nút Live khóa đến khi GT-P02 pass. AI không có nút.
            </div>
            <div className="msos-actions">
              <button type="button" className="msos-btn" onClick={() => setTrafficModal(true)}>
                Sửa traffic pack
              </button>
              {traffic && traffic.status !== 'approved_by_partner' ? (
                <button type="button" className="msos-btn" onClick={() => void approveTraffic()}>
                  Approve traffic (partner)
                </button>
              ) : null}
              {io && !io.partner_confirmed_at ? (
                <button type="button" className="msos-btn" onClick={() => void confirmPartnerIo()}>
                  Xác nhận IO partner
                </button>
              ) : null}
              <button type="button" className="msos-btn" onClick={() => void overrideP03()}>
                Override GT-P03
              </button>
              <button
                type="button"
                className="msos-btn msos-btn--blue"
                disabled={!liveEnabled || !canLive}
                onClick={() => setLiveModal(true)}
              >
                Live (người)
              </button>
            </div>
          </div>
          <aside>
            <div className="msos-card msos-pad">
              <h3>Traffic pack</h3>
              {traffic ? (
                <>
                  <div className="msos-row">
                    <span>Status</span>
                    <b>{traffic.status}</b>
                  </div>
                  <div className="msos-row">
                    <span>Creative</span>
                    <b>{traffic.creative_id?.slice(0, 8) ?? '—'}</b>
                  </div>
                  <Link className="msos-link" href="/crm/creative-os">
                    Mở Creative OS
                  </Link>
                </>
              ) : (
                <p className="msos-desc">Chưa có traffic pack.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
      {trafficModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Traffic pack</h2>
            <label className="msos-field">
              Creative UUID
              <input
                className="msos-input"
                value={trafficForm.creative_id}
                onChange={(e) => setTrafficForm({ ...trafficForm, creative_id: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Click URL (https)
              <input
                className="msos-input"
                value={trafficForm.click_url}
                onChange={(e) => setTrafficForm({ ...trafficForm, click_url: e.target.value })}
              />
            </label>
            <label className="msos-field">
              Weight KB
              <input
                className="msos-input"
                type="number"
                value={trafficForm.weight_kb}
                onChange={(e) => setTrafficForm({ ...trafficForm, weight_kb: e.target.value })}
              />
            </label>
            <label className="msos-field">
              <input
                type="checkbox"
                checked={trafficForm.backup_attached}
                onChange={(e) => setTrafficForm({ ...trafficForm, backup_attached: e.target.checked })}
              />{' '}
              Backup attached
            </label>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setTrafficModal(false)}>
                Hủy
              </button>
              <button type="button" className="msos-btn msos-btn--blue" onClick={() => void saveTraffic()}>
                Lưu &amp; submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {lineModal ? (
        <LineModal
          packages={packages}
          ios={ios}
          form={lineForm}
          setForm={setLineForm}
          onClose={() => setLineModal(false)}
          onSubmit={() => void createLine()}
        />
      ) : null}
      {liveModal ? (
        <div className="msos-modalback show">
          <div className="msos-modal" role="dialog">
            <h2>Xác nhận Live</h2>
            <p className="msos-desc">Chỉ người vận hành có thể Live. GT-P01 + GT-P02 phải pass.</p>
            <div className="msos-modal-foot">
              <button type="button" className="msos-btn" onClick={() => setLiveModal(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="msos-btn msos-btn--blue"
                disabled={!liveEnabled}
                onClick={() => void goLive()}
              >
                Xác nhận Live
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function LineModal({
  packages,
  ios,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  packages: Array<{ id: string; display_code: string }>;
  ios: IoRow[];
  form: { package_id: string; io_id: string };
  setForm: (f: typeof form) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="msos-modalback show">
      <div className="msos-modal" role="dialog">
        <h2>Tạo media line</h2>
        <label className="msos-field">
          Package
          <select
            className="msos-input"
            value={form.package_id}
            onChange={(e) => setForm({ ...form, package_id: e.target.value })}
          >
            <option value="">Chọn package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_code}
              </option>
            ))}
          </select>
        </label>
        <label className="msos-field">
          IO (optional)
          <select
            className="msos-input"
            value={form.io_id}
            onChange={(e) => setForm({ ...form, io_id: e.target.value })}
          >
            <option value="">—</option>
            {ios.map((io) => (
              <option key={io.id} value={io.id}>
                {io.display_code}
              </option>
            ))}
          </select>
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
