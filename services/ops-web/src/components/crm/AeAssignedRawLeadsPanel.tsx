'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchLeadB2bProjectOptions } from '@/lib/api';
import {
  listMyRawLeadCare,
  promoteMyRawLeadToB2b,
  setMyRawLeadCareContact,
  type RawLead,
} from '@/lib/market-research-api';

type Props = {
  token: string;
};

type B2bProjectOpt = { id: string; code: string; name: string; status: string };

function careContactLabel(status: string | null | undefined): string {
  switch (String(status ?? 'pending')) {
    case 'contacted':
      return 'Liên lạc được';
    case 'unreachable':
      return 'Không liên lạc được';
    default:
      return 'Chưa cập nhật';
  }
}

function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const href = String(raw ?? '').trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^[\w.-]+\.[\w.-]+/.test(href)) return `https://${href}`;
  return null;
}

function googleMapsSearchUrl(lead: RawLead): string | null {
  const q = [lead.company_name, lead.address].map((s) => String(s ?? '').trim()).filter(Boolean).join(' ');
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function primaryCompanyUrl(lead: RawLead): { href: string; kind: 'maps' | 'website' | 'evidence' } | null {
  const evidence = normalizeHttpUrl(lead.evidence_url);
  if (evidence && /google\.[^/]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(evidence)) {
    return { href: evidence, kind: 'maps' };
  }
  const website = normalizeHttpUrl(lead.website);
  if (website) return { href: website, kind: 'website' };
  if (evidence) return { href: evidence, kind: 'evidence' };
  const maps = googleMapsSearchUrl(lead);
  if (maps) return { href: maps, kind: 'maps' };
  return null;
}

function friendlyCareError(message: string): string {
  const code = message.trim();
  switch (code) {
    case 'b2b_project_required':
      return 'Chọn dự án PTT trước khi chuyển vào Lead B2B.';
    case 'staff_required':
      return 'Không xác định được tài khoản AE — đăng nhập lại hoặc liên hệ admin.';
    case 'must_contact_first':
      return 'Cần ghi nhận «Liên lạc được» trước khi chuyển Lead B2B.';
    case 'not_your_assignment':
      return 'Lead này không thuộc phân công của bạn.';
    case 'already_in_crm':
      return 'Lead đã có trong CRM.';
    default:
      return message;
  }
}

export function AeAssignedRawLeadsPanel({ token }: Props) {
  const [leads, setLeads] = useState<RawLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [b2bProjects, setB2bProjects] = useState<B2bProjectOpt[]>([]);
  const [b2bProjectId, setB2bProjectId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await listMyRawLeadCare(token);
      setLeads(out.leads ?? []);
    } catch (err) {
      setError(
        friendlyCareError(err instanceof Error ? err.message : 'Không tải được Lead thô'),
      );
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void (async () => {
      try {
        const projects = await fetchLeadB2bProjectOptions(token, 'active');
        setB2bProjects(projects);
        if (projects.length === 1) setB2bProjectId(projects[0].id);
      } catch {
        setB2bProjects([]);
      }
    })();
  }, [token]);

  async function markContact(leadId: number, outcome: 'contacted' | 'unreachable') {
    setBusyId(leadId);
    setError('');
    setMsg('');
    try {
      await setMyRawLeadCareContact(token, leadId, { outcome });
      setMsg(
        outcome === 'contacted'
          ? 'Đã ghi nhận liên lạc được'
          : 'Đã ghi nhận không liên lạc được',
      );
      await reload();
    } catch (err) {
      setError(friendlyCareError(err instanceof Error ? err.message : 'Cập nhật thất bại'));
    } finally {
      setBusyId(null);
    }
  }

  async function promote(leadId: number) {
    if (!b2bProjectId.trim()) {
      setError(
        b2bProjects.length === 0
          ? 'Chưa có dự án PTT bạn được gán — nhờ admin thêm vào /crm/b2b-projects.'
          : 'Chọn dự án PTT trước khi chuyển Lead B2B.',
      );
      return;
    }
    setBusyId(leadId);
    setError('');
    setMsg('');
    try {
      const out = await promoteMyRawLeadToB2b(token, leadId, {
        b2b_project_id: b2bProjectId,
      });
      setMsg(`Đã chuyển vào Lead B2B #${out.crm_lead_id}`);
      await reload();
    } catch (err) {
      setError(
        friendlyCareError(err instanceof Error ? err.message : 'Chuyển Lead B2B thất bại'),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-card page-card--flat-top stack-gap">
      <div>
        <h2 className="kpi-section-title" style={{ marginBottom: 4 }}>
          Lead thô đã phân công
        </h2>
        <p className="form-hint">
          Chỉ hiện lead đang giao cho bạn. Cập nhật trạng thái liên lạc; nếu liên lạc được
          có thể chuyển vào danh sách Lead B2B (cần chọn dự án PTT). Bấm tên công ty /
          Website / Maps để mở nguồn.
        </p>
      </div>

      <label className="form-field" style={{ maxWidth: 360 }}>
        <span className="form-label">Dự án PTT khi chuyển Lead B2B</span>
        <select
          className="kpi-select"
          value={b2bProjectId}
          onChange={(e) => setB2bProjectId(e.target.value)}
          aria-label="Chọn dự án PTT"
        >
          <option value="">
            {b2bProjects.length ? 'Chọn dự án…' : 'Chưa có dự án được gán'}
          </option>
          {b2bProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {msg ? <div className="alert alert--ok">{msg}</div> : null}

      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : error && leads.length === 0 ? null : leads.length === 0 ? (
        <div className="rlh-empty">Chưa có Lead thô nào được phân công cho bạn.</div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table data-table--dense">
            <thead>
              <tr>
                <th>Công ty</th>
                <th>Ngành</th>
                <th>SĐT</th>
                <th>Email</th>
                <th>Địa chỉ</th>
                <th>Liên lạc</th>
                <th>Phân công</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const busy = busyId === lead.id;
                const contacted = lead.care_contact_status === 'contacted';
                const unreachable = lead.care_contact_status === 'unreachable';
                const primary = primaryCompanyUrl(lead);
                const website = normalizeHttpUrl(lead.website);
                const maps = googleMapsSearchUrl(lead);
                return (
                  <tr key={lead.id}>
                    <td>
                      {primary ? (
                        <a
                          href={primary.href}
                          target="_blank"
                          rel="noreferrer"
                          className="nav-link"
                          title={
                            primary.kind === 'website'
                              ? 'Mở website'
                              : primary.kind === 'maps'
                                ? 'Mở Google Maps'
                                : 'Mở nguồn'
                          }
                        >
                          <strong>{lead.company_name}</strong>
                        </a>
                      ) : (
                        <strong>{lead.company_name}</strong>
                      )}
                      {lead.contact_title ? (
                        <div className="muted rlh-sub">{lead.contact_title}</div>
                      ) : null}
                      <div className="rlh-toolbar" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {website ? (
                          <a
                            href={website}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            Website
                          </a>
                        ) : null}
                        {maps ? (
                          <a
                            href={maps}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            Google Maps
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="muted">{lead.industry_label || lead.industry_key || '—'}</td>
                    <td>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="muted">{lead.email || '—'}</td>
                    <td>
                      {maps && lead.address ? (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noreferrer"
                          className="muted rlh-sub"
                          style={{ textDecoration: 'underline' }}
                        >
                          {lead.address}
                        </a>
                      ) : (
                        <span className="muted">{lead.address || '—'}</span>
                      )}
                    </td>
                    <td>{careContactLabel(lead.care_contact_status)}</td>
                    <td className="muted">
                      {lead.assigned_at
                        ? new Date(lead.assigned_at).toLocaleString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      <div className="rlh-toolbar" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy || contacted}
                          onClick={() => void markContact(lead.id, 'contacted')}
                        >
                          Liên lạc được
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy || unreachable}
                          onClick={() => void markContact(lead.id, 'unreachable')}
                        >
                          Không liên lạc được
                        </button>
                        {contacted ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy || !b2bProjectId}
                            title={
                              b2bProjectId
                                ? 'Tạo Lead B2B và gắn dự án PTT đã chọn'
                                : 'Chọn dự án PTT ở trên trước'
                            }
                            onClick={() => void promote(lead.id)}
                          >
                            Chuyển Lead B2B
                          </button>
                        ) : null}
                        {lead.crm_lead_id ? (
                          <Link
                            href={`/crm/leads/${lead.crm_lead_id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            Mở CRM
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
