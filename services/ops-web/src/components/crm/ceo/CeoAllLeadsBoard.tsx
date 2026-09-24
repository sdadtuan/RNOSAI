'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  bulkAssignLeads,
  fetchCrmStaffList,
  fetchLeads,
  type CrmStaffRow,
  type LeadRow,
} from '@/lib/api';
import {
  CEO_LEAD_STATUS_FILTERS,
  ceoLeadListParams,
  type CeoLeadFlowFilter,
  type CeoLeadSituationFilter,
} from '@/lib/crm/ceo-lead-control.util';
import { leadFlowKindLabel, resolveLeadFlowKindFromLead } from '@/lib/crm/lead-flow-kind';
import { leadStatusLabel } from '@/lib/crm/lead-status';

const PAGE_SIZE = 50;

const FLOW_OPTIONS: Array<{ id: CeoLeadFlowFilter; label: string }> = [
  { id: 'all', label: 'Mọi luồng' },
  { id: 'b2b_prospect', label: 'B2B Sales' },
  { id: 'spa_operational', label: 'CSKH vận hành' },
];

const SITUATION_OPTIONS: Array<{ id: CeoLeadSituationFilter; label: string }> = [
  { id: 'all', label: 'Mọi tình trạng' },
  { id: 'review', label: 'Phải tra soát' },
  { id: 'unassigned', label: 'Chưa owner' },
  { id: 'assigned', label: 'Đang giữ' },
];

export function CeoAllLeadsBoard({ token }: { token: string }) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [statusId, setStatusId] = useState('all');
  const [flow, setFlow] = useState<CeoLeadFlowFilter>('all');
  const [situation, setSituation] = useState<CeoLeadSituationFilter>('all');
  const [staff, setStaff] = useState<CrmStaffRow[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeads(
        token,
        ceoLeadListParams({
          q: query,
          statusId,
          flow,
          situation,
          limit: PAGE_SIZE,
          offset,
        }),
      );
      setRows(data.leads);
      setTotal(data.total);
      setSelected([]);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Không tải được lead');
    } finally {
      setLoading(false);
    }
  }, [token, query, statusId, flow, situation, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchCrmStaffList(token)
      .then((out) => setStaff(out.staff ?? []))
      .catch(() => setStaff([]));
  }, [token]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }

  async function assignSelected() {
    const owner = Number(ownerId);
    if (!Number.isFinite(owner) || owner <= 0 || selected.length === 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await bulkAssignLeads(token, {
        lead_ids: selected,
        owner_id: owner,
        reason: 'CEO điều hành — gán owner',
      });
      setMessage(`Đã gán ${out.assigned} lead.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gán owner thất bại');
    } finally {
      setBusy(false);
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const receivers = staff.filter((row) => row.active !== 0 && row.can_receive_leads !== false);

  return (
    <section className="page-card stack-gap ceo-lead-desk" data-testid="ceo-all-leads">
      <header className="ceo-lead-desk__head">
        <div>
          <h2 className="ceo-tower-section-title">Toàn bộ lead</h2>
          <p className="ceo-lead-desk__sub">
            CEO và Admin thấy mọi luồng, mọi trạng thái, kể cả Phải tra soát và lead chưa owner.
            {loading ? '' : ` ${total.toLocaleString('vi-VN')} lead.`}
          </p>
        </div>
      </header>

      <form
        className="ceo-lead-desk__search"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setQuery(q);
        }}
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Tìm tên, SĐT, email"
          aria-label="Tìm lead"
        />
        <button type="submit" className="btn btn-sm btn-secondary">
          Tìm
        </button>
      </form>

      <div className="ceo-lead-desk__filters" role="group" aria-label="Luồng lead">
        {FLOW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`btn btn-xs ${flow === option.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFlow(option.id);
              setOffset(0);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="ceo-lead-desk__filters" role="group" aria-label="Tình trạng lead">
        {SITUATION_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`btn btn-xs ${situation === option.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setSituation(option.id);
              setOffset(0);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="ceo-lead-desk__filters" role="group" aria-label="Trạng thái lead">
        {CEO_LEAD_STATUS_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`btn btn-xs ${statusId === option.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setStatusId(option.id);
              setOffset(0);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="ceo-lead-desk__assign">
        <select
          className="kpi-select"
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          aria-label="Owner nhận lead"
        >
          <option value="">Gán cho…</option>
          {receivers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy || selected.length === 0 || !ownerId}
          onClick={() => void assignSelected()}
        >
          Gán {selected.length || ''} lead
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Đang tải lead…</p> : null}

      {!loading && rows.length === 0 ? <p className="muted">Không có lead khớp bộ lọc.</p> : null}

      {rows.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>Lead</th>
                <th>SĐT</th>
                <th>Trạng thái</th>
                <th>Luồng</th>
                <th>Tình trạng</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const flowKind = lead.lead_flow_kind === 'spa_operational' || lead.lead_flow_kind === 'b2b_prospect'
                  ? lead.lead_flow_kind
                  : resolveLeadFlowKindFromLead(lead);
                const situationLabel = lead.review_queue?.active
                  ? 'Phải tra soát'
                  : lead.owner_id
                    ? 'Đang giữ'
                    : 'Chưa owner';
                return (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(lead.id)}
                        onChange={() => toggle(lead.id)}
                        aria-label={`Chọn ${lead.full_name || lead.id}`}
                      />
                    </td>
                    <td>
                      <div className="ceo-lead-desk__name">{lead.full_name || '—'}</div>
                      <div className="muted">#{lead.id}</div>
                    </td>
                    <td>{lead.phone || '—'}</td>
                    <td>{leadStatusLabel(lead.status)}</td>
                    <td>{leadFlowKindLabel(flowKind)}</td>
                    <td>{situationLabel}</td>
                    <td>{lead.owner_name || (lead.owner_id ? `#${lead.owner_id}` : 'Chưa phân')}</td>
                    <td>
                      <Link href={`/crm/leads/${lead.id}`} className="btn btn-xs btn-secondary">
                        Mở
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="ceo-lead-desk__pager">
        <button
          type="button"
          className="btn btn-xs btn-secondary"
          disabled={offset === 0 || loading}
          onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
        >
          Trước
        </button>
        <span className="muted">
          Trang {page} / {pages}
        </span>
        <button
          type="button"
          className="btn btn-xs btn-secondary"
          disabled={loading || offset + PAGE_SIZE >= total}
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Sau
        </button>
      </div>
    </section>
  );
}
