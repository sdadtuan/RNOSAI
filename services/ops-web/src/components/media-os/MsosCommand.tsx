'use client';

// Parity: msos-head, msos-spine, msos-kpi5, msos-layout, msos-notice
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet } from '@/lib/crm/msos-client';
import { msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type ExceptionRow = {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  kind: string;
  title: string;
  evidence_text: string;
};

type MediaLineRow = {
  id: string;
  display_code: string;
  status: string;
};

type MakeGoodRow = {
  id: string;
  qty: number;
  value_vnd: number;
  closed_at: string | null;
};

export function MsosCommand() {
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [lines, setLines] = useState<MediaLineRow[]>([]);
  const [makeGoods, setMakeGoods] = useState<MakeGoodRow[]>([]);
  const [health, setHealth] = useState<{ reseller: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ex, ml, mg, h] = await Promise.all([
        msosGet<ExceptionRow[]>('/exceptions'),
        msosGet<MediaLineRow[]>('/media-lines'),
        msosGet<MakeGoodRow[]>('/make-goods'),
        msosGet<{ reseller: boolean }>('/health'),
      ]);
      setExceptions(ex);
      setLines(ml);
      setMakeGoods(mg);
      setHealth(h);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const live = lines.filter((l) => l.status === 'live').length;
    const waiting = lines.filter((l) => l.status !== 'live' && l.status !== 'ended').length;
    const p0 = exceptions.filter((e) => e.priority === 'P0').length;
    const openMg = makeGoods.filter((m) => !m.closed_at).length;
    const mgQty = makeGoods.reduce((sum, m) => sum + m.qty, 0);
    return { live, waiting, p0, openMg, mgQty, lineCount: lines.length };
  }, [exceptions, lines, makeGoods]);

  if (loading) {
    return <p className="msos-status">Đang tải Command Center…</p>;
  }

  if (exceptions.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Media Command Center</h1>
            <p>Hàng đợi ngoại lệ publisher: overbook, evidence pack, make-good.</p>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Command Center" copy={MSOS_EMPTY.command} />
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Media Command Center</h1>
          <p>Hàng đợi thắng: overbook, evidence pack, make-good. Không clone AR aging CRM.</p>
        </div>
        <div className="msos-actions">
          <Link className="msos-btn" href="/crm/media-os/campaigns">
            Mở Publisher Live Gate
          </Link>
          <Link className="msos-btn msos-btn--blue" href="/crm/media-os/packages">
            ＋ Tạo IO từ reserve
          </Link>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-kpi5">
        <div className="msos-card msos-kpi">
          <small>PUBLISHER LINES</small>
          <b>{kpis.lineCount}</b>
          <span>
            {kpis.live} Live · {kpis.waiting} chờ traffic
          </span>
        </div>
        <div className="msos-card msos-kpi">
          <small>EXCEPTIONS</small>
          <b>{exceptions.length}</b>
          <span>{exceptions.filter((e) => e.priority === 'P1').length} P1</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>OVERBOOK P0</small>
          <b className="down">{kpis.p0}</b>
          <span>Capacity / evidence</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>MAKE-GOOD MỞ</small>
          <b>{kpis.openMg}</b>
          <span className="down">{kpis.mgQty > 0 ? `−${kpis.mgQty.toLocaleString('vi-VN')} qty` : '—'}</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>CỔNG C</small>
          <b>{health?.reseller ? 'Mở' : 'Khóa'}</b>
          <span>Eligibility Wave 1</span>
        </div>
      </div>
      <div className="msos-layout">
        <div className="msos-card msos-pad">
          <h3>Exception queue · publisher</h3>
          <p className="msos-desc">P0 capacity / evidence trước P1 traffic. Không vanity KPI.</p>
          <div className="msos-table-scroll">
            <table className="msos-t">
              <thead>
                <tr>
                  <th>Ưu tiên</th>
                  <th>Ngoại lệ</th>
                  <th>Evidence</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span
                        className={`msos-tag ${row.priority === 'P0' ? 'red' : row.priority === 'P1' ? 'amber' : 'gray'}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td>
                      <span className="name">{row.title}</span>
                      <span className="dep">{row.kind}</span>
                    </td>
                    <td>{row.evidence_text}</td>
                    <td>
                      {row.kind.includes('capacity') ? (
                        <Link className="msos-btn msos-btn--small" href="/crm/media-os/inventory">
                          Mở calendar
                        </Link>
                      ) : row.kind.includes('evidence') ? (
                        <Link className="msos-btn msos-btn--small" href="/crm/media-os/evidence">
                          Mở pack
                        </Link>
                      ) : row.kind.includes('traffic') ? (
                        <Link className="msos-btn msos-btn--small" href="/crm/media-os/campaigns">
                          Mở traffic
                        </Link>
                      ) : (
                        <Link className="msos-btn msos-btn--small" href="/crm/media-os/evidence">
                          Mở discrepancy
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside>
          <div className="msos-card msos-pad">
            <h3>Tổng quan booking</h3>
            <p className="msos-desc">Số liệu từ API thật — không seed demo.</p>
            <div className="msos-row">
              <span>Media lines</span>
              <b>{kpis.lineCount}</b>
            </div>
            <div className="msos-row">
              <span>Exceptions mở</span>
              <b>{exceptions.length}</b>
            </div>
            <Link className="msos-btn msos-btn--small" href="/crm/media-os/campaigns">
              Mở campaigns
            </Link>
          </div>
        </aside>
      </div>
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}
