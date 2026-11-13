'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { DiscoveryOptionsPayload, IntakeSessionRow, LeadRow } from '@/lib/api';
import { saveDiscoveryBrief, saveDiscoveryService, submitDiscoveryBrief,
  reopenIntakeSession } from '@/lib/api';
import {
  DISCOVERY_REQUIRED_FIELDS,
  authorityLabel,
  budgetLabel,
  channelLabels,
  discoveryProgress,
  emptySalesDiscoveryBrief,
  isDiscoveryComplete,
  normalizeSalesDiscoveryBrief,
  optionLabel,
  prefillSalesDiscovery,
  temperatureLabel,
  timelineLabel,
  toggleDiscoveryChannel,
  type SalesDiscoveryBrief,
} from '@/lib/crm/sales-discovery';
import './sales-discovery.css';

const STEPS = [
  { id: 1, label: '1. Khách hàng' },
  { id: 2, label: '2. Nhu cầu' },
  { id: 3, label: '3. Bàn giao' },
] as const;

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <span className="sd-label">
      {children}
      {required ? <span className="sd-req">*</span> : null}
    </span>
  );
}

function serviceName(options: DiscoveryOptionsPayload | null, slug: string): string {
  if (!options) return slug;
  for (const group of options.service_groups) {
    const found = group.services.find((row) => row.slug === slug);
    if (found) return found.name;
  }
  return slug;
}

export function SalesDiscoveryWizard({
  token,
  lead,
  session,
  options,
  canEdit,
  onSessionChange,
  historicalSessions = [],
  embedded = false,
  handoffStatus = '',
}: {
  token: string;
  lead: LeadRow | null;
  session: IntakeSessionRow;
  options: DiscoveryOptionsPayload | null;
  canEdit: boolean;
  onSessionChange: (session: IntakeSessionRow) => void;
  historicalSessions?: IntakeSessionRow[];
  embedded?: boolean;
  handoffStatus?: string;
}) {
  const completed = session.status === 'completed';
  const returned = String(handoffStatus || '').toLowerCase() === 'returned';
  const [revising, setRevising] = useState(false);
  const readOnly = (completed && !revising) || !canEdit;
  const [brief, setBrief] = useState<SalesDiscoveryBrief>(() =>
    prefillSalesDiscovery({
      company_name: lead?.company_name,
      full_name: lead?.full_name,
      phone: lead?.phone,
      email: lead?.email,
      need: (lead as { need?: string | null } | null | undefined)?.need,
      industry: (lead as { industry?: string } | null)?.industry,
      session,
    }),
  );
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [handoffOk, setHandoffOk] = useState(false);
  const draftTimer = useRef<number | null>(null);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  useEffect(() => {
    setBrief(
      prefillSalesDiscovery({
        company_name: lead?.company_name,
        full_name: lead?.full_name,
        phone: lead?.phone,
        email: lead?.email,
        need: (lead as { need?: string | null } | null | undefined)?.need,
        session,
      }),
    );
    if (session.status !== 'completed') setRevising(false);
  }, [session.id, session.status, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => discoveryProgress(brief), [brief]);
  const complete = progress.filled === progress.total;
  const industries = options?.industries ?? [];
  const jobTitles = options?.job_titles ?? [];
  const budgets = options?.budgets ?? [];
  const timelines = options?.timelines ?? [];
  const channels = options?.channels ?? [];
  const authorities = options?.authorities ?? [];
  const temperatures = options?.temperatures ?? [];
  const groups = options?.service_groups ?? [];

  function patch(partial: Partial<SalesDiscoveryBrief>, opts?: { immediate?: boolean }) {
    setBrief((prev) => {
      const next = normalizeSalesDiscoveryBrief({ ...prev, ...partial });
      briefRef.current = next;
      return next;
    });
    setError('');
    if (readOnly) return;
    if (opts?.immediate) {
      void persistDraft();
      return;
    }
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      void persistDraft();
    }, 700);
  }

  async function persistDraft() {
    if (readOnly) return;
    setSaving(true);
    try {
      const saved = await saveDiscoveryBrief(token, session.id, briefRef.current);
      onSessionChange(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được bản nháp.');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleService(slug: string, selected: boolean) {
    if (readOnly) return;
    setError('');
    try {
      const saved = await saveDiscoveryService(token, session.id, selected ? 'remove' : 'add', slug);
      onSessionChange(saved);
      const next = prefillSalesDiscovery({ session: saved, company_name: lead?.company_name, full_name: lead?.full_name, phone: lead?.phone, email: lead?.email, need: (lead as { need?: string | null } | null | undefined)?.need });
      // Keep other in-progress fields; only take services from server.
      setBrief((prev) => normalizeSalesDiscoveryBrief({ ...prev, services: next.services }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được dịch vụ.');
    }
  }

  async function onSubmit() {
    if (!complete || readOnly) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
      const out = await submitDiscoveryBrief(token, session.id, briefRef.current);
      if (out.session) onSessionChange(out.session);
      if (out.ok) {
        setHandoffOk(true);
        setMessage('Đã Submit to AM. Lead đang ở Chờ Solutions.');
      } else {
        setError(out.handoff_error || 'Đã lưu Discovery nhưng chưa giao được Solution.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-discovery-lead-${session.lead_id ?? session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handoffPending = String(handoffStatus || '').toLowerCase() === 'pending' || handoffOk;
  const badge = returned ? (
    <span className="sd-badge sd-badge--pending" data-testid="sd-badge">AM trả về — cần bổ sung</span>
  ) : completed ? (
    <span className={`sd-badge ${handoffPending ? 'sd-badge--pending' : 'sd-badge--done'}`} data-testid="sd-badge">
      {handoffPending ? 'Đã nộp — chờ AM' : 'Đã nộp'}
    </span>
  ) : (
    <span className="sd-badge sd-badge--draft" data-testid="sd-badge">Draft</span>
  );

  async function onRevise() {
    if (!canEdit || !returned || revising) return;
    setError('');
    try {
      const next = await reopenIntakeSession(token, session.id);
      onSessionChange(next);
      setRevising(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở lại phiên để sửa.');
    }
  }

  return (
    <div className={`sd-page${embedded ? ' sd-page--embed' : ''}`} data-testid="sales-discovery-wizard">
      <div className="sd-card">
        <header className={`sd-head${embedded ? ' sd-head--embed' : ''}`}>
          {embedded ? null : (
          <div>
            <h1 className="sd-title">CRM – Sales Discovery</h1>
            <p className="sd-kicker">
              {lead?.company_name || brief.company_name || '?'}
              {lead?.full_name ? ` · ${lead.full_name}` : ''}
            </p>
          </div>
          )}
          <div className="sd-head-meta">
            {badge}
            {completed && returned && canEdit && !revising ? (
              <button type="button" className="btn btn-secondary sd-revise" data-testid="sd-revise" onClick={() => void onRevise()}>
                Sửa
              </button>
            ) : null}
            <span className={`sd-progress${complete ? ' sd-progress--full' : ''}`} data-testid="sd-progress">
              {progress.filled}/{progress.total} trường cốt lõi
            </span>
          </div>
        </header>

        <div className="sd-steps" role="tablist">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sd-step${step === item.id ? ' is-active' : ''}${item.id < step ? ' is-done' : ''}`}
              onClick={() => setStep(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {step === 1 ? (
          <>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">A. Thông tin doanh nghiệp</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field sd-field--wide">
                  <FieldLabel required>Tên DN / thương hiệu</FieldLabel>
                  <input
                    className="sd-input"
                    value={brief.company_name}
                    disabled={readOnly}
                    onChange={(e) => patch({ company_name: e.target.value })}
                    data-testid="sd-company"
                  />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Ngành nghề</FieldLabel>
                  <select
                    className="sd-select"
                    value={brief.industry}
                    disabled={readOnly}
                    onChange={(e) => patch({ industry: e.target.value })}
                    data-testid="sd-industry"
                  >
                    <option value="">Chọn ngành nghề</option>
                    {industries.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <FieldLabel required>Sản phẩm / dịch vụ chủ lực</FieldLabel>
                  <input
                    className="sd-input"
                    value={brief.flagship_product}
                    disabled={readOnly}
                    onChange={(e) => patch({ flagship_product: e.target.value })}
                    data-testid="sd-flagship"
                  />
                </label>
                <label className="sd-field sd-field--wide">
                  <FieldLabel>Website / Fanpage / TikTok</FieldLabel>
                  <input
                    className="sd-input"
                    value={brief.websites}
                    disabled={readOnly}
                    placeholder="URL, cách nhau bởi khoảng trắng"
                    data-testid="sd-websites"
                    onChange={(e) => patch({ websites: e.target.value })}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      if (value !== briefRef.current.websites) patch({ websites: value });
                    }}
                  />
                </label>
              </div>
            </section>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">B. Người liên hệ</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field">
                  <FieldLabel required>Họ tên</FieldLabel>
                  <input className="sd-input" value={brief.contact_name} disabled={readOnly} onChange={(e) => patch({ contact_name: e.target.value })} data-testid="sd-contact" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>SĐT</FieldLabel>
                  <input className="sd-input" value={brief.phone} disabled={readOnly} onChange={(e) => patch({ phone: e.target.value })} data-testid="sd-phone" />
                </label>
                <label className="sd-field">
                  <FieldLabel>Email</FieldLabel>
                  <input className="sd-input" value={brief.email} disabled={readOnly} onChange={(e) => patch({ email: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel>Chức vụ</FieldLabel>
                  <select className="sd-select" value={brief.job_title} disabled={readOnly} onChange={(e) => patch({ job_title: e.target.value })}>
                    <option value="">Chọn chức vụ</option>
                    {jobTitles.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sd-field sd-field--wide">
                  <FieldLabel>Quyền quyết định ngân sách</FieldLabel>
                  <div className="sd-radios">
                    {authorities.map((row) => (
                      <label key={row.value} className="sd-radio">
                        <input
                          type="radio"
                          name="sd-authority"
                          value={row.value}
                          disabled={readOnly}
                          checked={brief.budget_authority === row.value}
                          onChange={() => patch({ budget_authority: row.value as SalesDiscoveryBrief['budget_authority'] })}
                        />
                        {row.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">C. Nhu cầu Marketing</h2>
                <div className="sd-svc-wrap">
                  <button
                    type="button"
                    className={brief.services.length ? 'sd-svc-btn' : 'sd-svc-btn sd-svc-btn--ghost'}
                    onClick={() => setListOpen((open) => !open)}
                    data-testid="sd-service-list-btn"
                  >
                    Danh sách dịch vụ ({brief.services.length})
                  </button>
                  {listOpen ? (
                    <div className="sd-svc-panel" data-testid="sd-service-list">
                      {brief.services.length === 0 ? (
                        <p className="sd-svc-empty">Chưa chọn dịch vụ. Bấm + bên dưới để thêm (lưu ngay).</p>
                      ) : (
                        brief.services.map((slug) => (
                          <div key={slug} className="sd-svc-item">
                            <span>{serviceName(options, slug)}</span>
                            {readOnly ? null : (
                              <button type="button" className="sd-svc-remove" onClick={() => void onToggleService(slug, true)} aria-label="Gỡ dịch vụ">
                                ?
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="sd-field" style={{ marginBottom: 14 }}>
                <FieldLabel required>Dịch vụ khách hàng quan tâm</FieldLabel>
                <p className="sd-hint">Bấm + để thêm — lưu ngay, không cần nút Save.</p>
                <div className="sd-picker" data-testid="sd-service-picker">
                  {groups.map((group) => (
                    <div key={group.key} className="sd-picker__group">
                      <p className="sd-picker__group-title">{group.title}</p>
                      {group.services.map((svc) => {
                        const on = brief.services.includes(svc.slug);
                        return (
                          <div key={svc.slug} className="sd-picker__row">
                            <button
                              type="button"
                              className={`sd-plus${on ? ' is-on' : ''}`}
                              disabled={readOnly}
                              title={on ? 'Đã thêm — bấm để gỡ' : 'Thêm dịch vụ'}
                              onClick={() => void onToggleService(svc.slug, on)}
                            >
                              {on ? '×' : '+'}
                            </button>
                            <span className="sd-picker__name">{svc.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="sd-grid sd-grid--1">
                <label className="sd-field">
                  <FieldLabel required>Vấn đề lớn nhất</FieldLabel>
                  <textarea className="sd-textarea" value={brief.biggest_problem} disabled={readOnly} onChange={(e) => patch({ biggest_problem: e.target.value })} data-testid="sd-problem" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Mục tiêu Marketing</FieldLabel>
                  <textarea className="sd-textarea" value={brief.marketing_goal} disabled={readOnly} onChange={(e) => patch({ marketing_goal: e.target.value })} data-testid="sd-goal" />
                </label>
                <label className="sd-field">
                  <FieldLabel>Sản phẩm ưu tiên quảng bá</FieldLabel>
                  <input className="sd-input" value={brief.priority_product} disabled={readOnly} onChange={(e) => patch({ priority_product: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Khách hàng mục tiêu</FieldLabel>
                  <input className="sd-input" value={brief.target_customers} disabled={readOnly} onChange={(e) => patch({ target_customers: e.target.value })} data-testid="sd-audience" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Khu vực triển khai</FieldLabel>
                  <input className="sd-input" value={brief.region} disabled={readOnly} onChange={(e) => patch({ region: e.target.value })} data-testid="sd-region" />
                </label>
              </div>
            </section>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">D. Hiện trạng Marketing</h2>
              </div>
              <div className="sd-field" style={{ marginBottom: 12 }}>
                <FieldLabel>Kênh đang dùng</FieldLabel>
                <div className="sd-chips">
                  {channels.map((row) => (
                    <button
                      key={row.value}
                      type="button"
                      className={`sd-chip${brief.channels.includes(row.value) ? ' is-on' : ''}`}
                      disabled={readOnly}
                      onClick={() => patch({ channels: toggleDiscoveryChannel(brief.channels, row.value) })}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sd-grid">
                <label className="sd-field">
                  <FieldLabel>Kết quả Marketing hiện tại</FieldLabel>
                  <textarea className="sd-textarea" value={brief.current_results} disabled={readOnly} onChange={(e) => patch({ current_results: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel>Khó khăn / nguyên nhân chưa hiệu quả</FieldLabel>
                  <textarea className="sd-textarea" value={brief.difficulties} disabled={readOnly} onChange={(e) => patch({ difficulties: e.target.value })} />
                </label>
              </div>
            </section>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">E. Ngân sách & thời điểm</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field">
                  <FieldLabel required>Ngân sách Marketing dự kiến</FieldLabel>
                  <select className="sd-select" value={brief.budget_band} disabled={readOnly} onChange={(e) => patch({ budget_band: e.target.value })} data-testid="sd-budget">
                    <option value="">Chọn mức ngân sách</option>
                    {budgets.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <FieldLabel required>Thời gian mong muốn triển khai</FieldLabel>
                  <select className="sd-select" value={brief.timeline_band} disabled={readOnly} onChange={(e) => patch({ timeline_band: e.target.value })} data-testid="sd-timeline">
                    <option value="">Chọn thời điểm</option>
                    {timelines.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">F. Ghi chú & mức độ sẵn sàng</h2>
              </div>
              <div className="sd-grid sd-grid--1">
                <label className="sd-field">
                  <FieldLabel required>Ghi chú nội dung cuộc gọi</FieldLabel>
                  <textarea className="sd-textarea" value={brief.call_notes} disabled={readOnly} onChange={(e) => patch({ call_notes: e.target.value })} data-testid="sd-notes" />
                </label>
                <div className="sd-field">
                  <FieldLabel required>Mức độ sẵn sàng</FieldLabel>
                  <div className="sd-radios">
                    {temperatures.map((row) => (
                      <label key={row.value} className="sd-radio">
                        <input
                          type="radio"
                          name="sd-temp"
                          value={row.value}
                          disabled={readOnly}
                          checked={brief.temperature === row.value}
                          onChange={() => patch({ temperature: row.value as SalesDiscoveryBrief['temperature'] })}
                        />
                        {row.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="sd-check" data-testid="sd-checklist">
              <div className="sd-check__head">
                <h3>Kiểm tra trước khi Submit</h3>
                <span>{complete ? 'Đủ 14 mục' : `Thiếu ${progress.missing.length} mục`}</span>
              </div>
              {complete ? (
                <p className="sd-check__list is-ok">Đã đủ {progress.total} trường cốt lõi.</p>
              ) : (
                <ul className="sd-check__list">
                  {progress.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}

        {error ? <p className="sd-msg sd-msg--err">{error}</p> : null}
        {message ? (
          <p className="sd-msg sd-msg--ok">
            {message}{' '}
            <Link href="/crm/solution/queue" className="nav-link">
              Mở Chờ Solutions →
            </Link>
          </p>
        ) : null}
        {saving && !readOnly ? <p className="sd-hint">Đang lưu nháp…</p> : null}

        <div className="sd-actions">
          <button type="button" className="btn btn-secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Quay lại
          </button>
          <div className="sd-actions__right">
            <button type="button" className="btn btn-secondary" onClick={() => void persistDraft()} disabled={readOnly || saving} data-testid="sd-draft">
              Lưu bản nháp
            </button>
            <button type="button" className="btn btn-secondary" onClick={exportJson} data-testid="sd-export">
              Xuất dữ liệu
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="sd-next"
                onClick={() => {
                  if (draftTimer.current) window.clearTimeout(draftTimer.current);
                  void persistDraft().finally(() => setStep((s) => Math.min(3, s + 1)));
                }}
              >
                Tiếp theo
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary sd-submit"
                disabled={!complete || readOnly || submitting}
                onClick={() => void onSubmit()}
                data-testid="sd-submit"
                title={!complete ? 'Điền hết các trường * trước khi Submit' : undefined}
              >
                {submitting ? 'Đang nộp…' : 'Submit to AM'}
              </button>
            )}
          </div>
        </div>
      </div>

      {!embedded && historicalSessions.length > 0 ? (
        <div className="sd-history">
          <h3>Phiên cũ (chỉ xem)</h3>
          {historicalSessions.map((row) => (
            <details key={row.id}>
              <summary>
                #{row.id} · {row.status} · {row.decision || '—'} · {row.updated_at}
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                {JSON.stringify(row.answers_json ?? {}, null, 2).slice(0, 4000)}
              </pre>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function discoverySummaryLines(brief: SalesDiscoveryBrief, options?: DiscoveryOptionsPayload | null): Array<{ label: string; value: string }> {
  return [
    { label: 'Tên DN / thương hiệu', value: brief.company_name },
    { label: 'Ngành nghề', value: optionLabel(options?.industries ?? [], brief.industry) || brief.industry },
    { label: 'Sản phẩm chủ lực', value: brief.flagship_product },
    { label: 'Người liên hệ', value: [brief.contact_name, brief.phone, brief.email].filter(Boolean).join(' · ') },
    { label: 'Chức vụ', value: optionLabel(options?.job_titles ?? [], brief.job_title) || brief.job_title },
    { label: 'Quyền quyết định NS', value: authorityLabel(brief.budget_authority) },
    { label: 'Dịch vụ quan tâm', value: brief.services.map((s) => serviceName(options ?? null, s)).join(', ') },
    { label: 'Vấn đề lớn nhất', value: brief.biggest_problem },
    { label: 'Mục tiêu Marketing', value: brief.marketing_goal },
    { label: 'KH mục tiêu', value: brief.target_customers },
    { label: 'Khu vực', value: brief.region },
    { label: 'Kênh đang dùng', value: channelLabels(brief.channels) },
    { label: 'Ngân sách', value: budgetLabel(brief.budget_band) },
    { label: 'Thời điểm', value: timelineLabel(brief.timeline_band) },
    { label: 'Ghi chú cuộc gọi', value: brief.call_notes },
    { label: 'Mức độ sẵn sàng', value: temperatureLabel(brief.temperature) },
  ].filter((row) => row.value);
}

export { emptySalesDiscoveryBrief, isDiscoveryComplete };
