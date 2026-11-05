'use client';

// Parity: msos-head, msos-spine, msos-kpi5, msos-t
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { msosErrorMessage } from '@/lib/crm/msos-format';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type OutcomeLink = {
  id: string;
  display_code: string;
  media_line_id: string;
  lead_id: string | null;
  sale_id: string | null;
  model: string | null;
  match_status: 'matched' | 'unmatched';
};

type MediaLine = { id: string; display_code: string };

export function MsosOutcomes() {
  const [links, setLinks] = useState<OutcomeLink[]>([]);
  const [lines, setLines] = useState<MediaLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ media_line_id: '', lead_id: '', model: '' });

  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const kpis = useMemo(() => {
    const matched = links.filter((l) => l.match_status === 'matched').length;
    const unmatched = links.filter((l) => l.match_status === 'unmatched').length;
    const withLead = links.filter((l) => l.lead_id).length;
    const lineIds = new Set(links.map((l) => l.media_line_id));
    const unmatchedPct =
      links.length > 0 ? `${Math.round((unmatched / links.length) * 100)}%` : '—';
    return { matched, unmatched, withLead, lineCount: lineIds.size, unmatchedPct, total: links.length };
  }, [links]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ol, ml] = await Promise.all([
        msosGet<OutcomeLink[]>('/outcome-links'),
        msosGet<MediaLine[]>('/media-lines'),
      ]);
      setLinks(ol);
      setLines(ml);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    try {
      await msosMutate('/outcome-links', {
        method: 'POST',
        body: JSON.stringify({
          media_line_id: form.media_line_id,
          lead_id: form.lead_id || null,
          model: form.model || null,
        }),
      });
      setModal(false);
      await load();
      setToast('Đã tạo outcome link');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Outcomes…</p>;

  if (links.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Outcome Links</h1>
            <p>Trỏ Lead / Sale CRM. Unmatched để mở — cấm insert.</p>
          </div>
          <div className="msos-actions">
            <Link className="msos-btn" href="/crm/leads">
              Mở CRM Leads
            </Link>
            <button type="button" className="msos-btn msos-btn--blue" onClick={() => setModal(true)}>
              ＋ Link CRM ID
            </button>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Outcomes" copy={MSOS_EMPTY.outcomes} />
        {modal ? (
          <LinkModal form={form} setForm={setForm} lines={lines} onClose={() => setModal(false)} onSubmit={() => void createLink()} />
        ) : null}
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Outcome Links</h1>
          <p>Giữ v1.0: trỏ Lead / MQL / SQL / Sale CRM. Cấm insert leads.</p>
        </div>
        <div className="msos-actions">
          <Link className="msos-btn" href="/crm/leads">
            Mở CRM Leads
          </Link>
          <button type="button" className="msos-btn msos-btn--blue" onClick={() => setModal(true)}>
            ＋ Link CRM ID
          </button>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-kpi5">
        <div className="msos-card msos-kpi">
          <small>LINKED LEADS</small>
          <b>{kpis.withLead}</b>
          <span>Ref CRM · không sở hữu</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>MATCHED</small>
          <b>{kpis.matched}</b>
          <span>Status từ CRM ref</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>UNMATCHED</small>
          <b>{kpis.unmatched}</b>
          <span className="down">{kpis.unmatchedPct}</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>MEDIA LINES</small>
          <b>{kpis.lineCount}</b>
          <span>{kpis.total} links</span>
        </div>
        <div className="msos-card msos-kpi">
          <small>TOTAL LINKS</small>
          <b>{kpis.total}</b>
          <span>Outcome registry</span>
        </div>
      </div>
      <div className="msos-card">
        <div className="msos-table-scroll">
          <table className="msos-t">
            <thead>
              <tr>
                <th>Link</th>
                <th>Media line</th>
                <th>CRM object</th>
                <th>Model</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const line = lineMap.get(link.media_line_id);
                return (
                  <tr key={link.id}>
                    <td>{link.display_code}</td>
                    <td>{line?.display_code ?? link.media_line_id.slice(0, 8)}</td>
                    <td>
                      {link.lead_id ? (
                        <Link className="msos-link" href={`/crm/leads/${link.lead_id}`}>
                          {link.lead_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{link.model ?? '—'}</td>
                    <td>
                      <span className={`msos-tag ${link.match_status === 'matched' ? 'green' : 'red'}`}>
                        {link.match_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="msos-notice">MSOS không tạo Lead/Sale. Chỉ deep-link CRM ID đã có.</div>
      {modal ? (
        <LinkModal form={form} setForm={setForm} lines={lines} onClose={() => setModal(false)} onSubmit={() => void createLink()} />
      ) : null}
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function LinkModal({
  form,
  setForm,
  lines,
  onClose,
  onSubmit,
}: {
  form: { media_line_id: string; lead_id: string; model: string };
  setForm: (f: typeof form) => void;
  lines: MediaLine[];
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="msos-modalback show">
      <div className="msos-modal" role="dialog">
        <h2>Link CRM ID</h2>
        <label className="msos-field">
          Media line
          <select
            className="msos-input"
            value={form.media_line_id}
            onChange={(e) => setForm({ ...form, media_line_id: e.target.value })}
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
          Lead UUID (CRM)
          <input
            className="msos-input"
            value={form.lead_id}
            onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
          />
        </label>
        <label className="msos-field">
          Model
          <input
            className="msos-input"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </label>
        <div className="msos-modal-foot">
          <button type="button" className="msos-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="msos-btn msos-btn--blue" onClick={onSubmit}>
            Tạo link
          </button>
        </div>
      </div>
    </div>
  );
}
