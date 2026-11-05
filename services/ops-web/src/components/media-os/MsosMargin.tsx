'use client';

// Parity: msos-head, msos-spine, msos-layout, msos-row
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { canEnableInvoiceButton } from '@/lib/crm/msos-gates-ui';
import { formatBps, formatVnd, msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type MediaLine = { id: string; display_code: string };

type MarginDto = {
  gross_sell_vnd: number;
  discount_vnd: number;
  media_cost_vnd: number;
  make_good_cost_vnd: number;
  rebate_accrued_vnd: number;
  service_cost_vnd: number;
  contribution_vnd: number;
  contribution_bps: number;
  closed: boolean;
};

type Discrepancy = { media_line_id: string; material: boolean; status: string };

type EvidencePack = { status: string };

export function MsosMargin() {
  const [lines, setLines] = useState<MediaLine[]>([]);
  const [selected, setSelected] = useState('');
  const [margin, setMargin] = useState<MarginDto | null>(null);
  const [packOfficial, setPackOfficial] = useState(false);
  const [discrepancyBlock, setDiscrepancyBlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ml = await msosGet<MediaLine[]>('/media-lines');
      setLines(ml);
      if (ml.length && !selected) setSelected(ml[0].id);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const loadMargin = useCallback(async (lineId: string) => {
    if (!lineId) return;
    try {
      const [m, packs, dcs] = await Promise.all([
        msosGet<MarginDto>(`/media-lines/${lineId}/margin`),
        msosGet<Array<EvidencePack & { media_line_id: string }>>('/evidence-packs').catch(
          () => [] as Array<EvidencePack & { media_line_id: string }>,
        ),
        msosGet<Discrepancy[]>(`/discrepancy-cases`).catch(() => [] as Discrepancy[]),
      ]);
      setMargin(m);
      setPackOfficial(packs.some((p) => p.media_line_id === lineId && p.status === 'official'));
      const materialOpen = dcs.some(
        (d) => d.media_line_id === lineId && d.material && d.status === 'open',
      );
      setDiscrepancyBlock(materialOpen);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) void loadMargin(selected);
  }, [selected, loadMargin]);

  async function requestInvoice() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/finance-request`, { method: 'POST', body: '{}' });
      setToast('Đã gửi finance request — deep-link Finance, không tạo invoice MSOS');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  async function submitMargin() {
    if (!selected) return;
    try {
      await msosMutate(`/media-lines/${selected}/margin/submit`, { method: 'POST', body: '{}' });
      await loadMargin(selected);
      setToast('Đã submit margin snapshot');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Margin…</p>;

  if (lines.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Margin Waterfall &amp; Deal Wallet</h1>
            <p>Waterfall và request Finance.</p>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Margin & Deal" copy={MSOS_EMPTY.margin} />
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  const selectedLine = lines.find((l) => l.id === selected);
  const netRevenue = margin
    ? margin.gross_sell_vnd - margin.discount_vnd
    : 0;
  const invoiceEnabled = canEnableInvoiceButton({ packOfficial, discrepancyBlock });

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Margin Waterfall &amp; Deal Wallet</h1>
          <p>Dòng make-good hiện rõ. Request invoice chỉ khi GT-P04 + GT-P05 pass.</p>
        </div>
        <div className="msos-actions">
          <button
            type="button"
            className="msos-btn"
            disabled={!invoiceEnabled}
            onClick={() => void requestInvoice()}
          >
            Request invoice
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => void submitMargin()}>
            Submit (GT-06)
          </button>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-filter" style={{ marginBottom: 14 }}>
        <select className="msos-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.display_code}
            </option>
          ))}
        </select>
      </div>
      <div className="msos-layout">
        <div className="msos-card msos-pad">
          <h3>Waterfall · {selectedLine?.display_code ?? '—'} · Internal</h3>
          {margin ? (
            <>
              <div className="msos-row">
                <span>Client gross sell</span>
                <b>{formatVnd(margin.gross_sell_vnd)}</b>
              </div>
              <div className="msos-row">
                <span>Discount</span>
                <b className="down">− {formatVnd(margin.discount_vnd)}</b>
              </div>
              <div className="msos-row">
                <span>Net media revenue</span>
                <b>{formatVnd(netRevenue)}</b>
              </div>
              <div className="msos-row">
                <span>Partner delivery cost (IO)</span>
                <b className="down">− {formatVnd(margin.media_cost_vnd)}</b>
              </div>
              {margin.make_good_cost_vnd > 0 ? (
                <div className="msos-row">
                  <span>Make-good cost (accrued)</span>
                  <b className="down">− {formatVnd(margin.make_good_cost_vnd)}</b>
                </div>
              ) : null}
              <div className="msos-row">
                <span>Rebate accrued</span>
                <b>{formatVnd(margin.rebate_accrued_vnd)}</b>
              </div>
              <div className="msos-row">
                <span>Service cost (ref Finance)</span>
                <b className="down">− {formatVnd(margin.service_cost_vnd)}</b>
              </div>
              <div className="msos-row">
                <b>Contribution margin</b>
                <b className="up">
                  {formatVnd(margin.contribution_vnd)} · {formatBps(margin.contribution_bps)}
                </b>
              </div>
            </>
          ) : (
            <p className="msos-desc">Chưa có dữ liệu margin.</p>
          )}
          {!invoiceEnabled ? (
            <div className="msos-notice danger">
              GT-P10 chặn request: pack chưa official hoặc discrepancy material mở.
            </div>
          ) : null}
        </div>
        <aside>
          <div className="msos-card msos-pad">
            <h3>Invoice</h3>
            <p className="msos-desc">MSOS không số invoice. Chỉ finance request.</p>
            <Link className="msos-link" href="/crm/financials">
              Mở Finance Core
            </Link>
          </div>
        </aside>
      </div>
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}
