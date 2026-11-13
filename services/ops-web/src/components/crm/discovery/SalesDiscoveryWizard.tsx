'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { DiscoveryOptionsPayload, IntakeSessionRow, LeadRow } from '@/lib/api';
import { saveDiscoveryBrief, saveDiscoveryService, submitDiscoveryBrief } from '@/lib/api';
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
  { id: 1, label: '1. Kh?ch h?ng' },
  { id: 2, label: '2. Nhu c?u' },
  { id: 3, label: '3. B?n giao' },
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
}: {
  token: string;
  lead: LeadRow | null;
  session: IntakeSessionRow;
  options: DiscoveryOptionsPayload | null;
  canEdit: boolean;
  onSessionChange: (session: IntakeSessionRow) => void;
  historicalSessions?: IntakeSessionRow[];
}) {
  const completed = session.status === 'completed';
  const readOnly = completed || !canEdit;
  const [brief, setBrief] = useState<SalesDiscoveryBrief>(() =>
    prefillSalesDiscovery({
      company_name: lead?.company_name,
      full_name: lead?.full_name,
      phone: lead?.phone,
      email: lead?.email,
      need: lead?.need,
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
        need: lead?.need,
        session,
      }),
    );
  }, [session.id, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setError(err instanceof Error ? err.message : 'Kh?ng l?u ???c b?n nh?p.');
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
      const next = prefillSalesDiscovery({ session: saved, company_name: lead?.company_name, full_name: lead?.full_name, phone: lead?.phone, email: lead?.email, need: lead?.need });
      // Keep other in-progress fields; only take services from server.
      setBrief((prev) => normalizeSalesDiscoveryBrief({ ...prev, services: next.services }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kh?ng l?u ???c d?ch v?.');
    }
  }

  async function onSubmit() {
    if (!complete || readOnly) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const out = await submitDiscoveryBrief(token, session.id, briefRef.current);
      if (out.session) onSessionChange(out.session);
      if (out.ok) {
        setHandoffOk(true);
        setMessage('?? Submit to AM. Lead ?ang ? H?ng ch? Solution.');
      } else {
        setError(out.handoff_error || '?? l?u Discovery nh?ng ch?a giao ???c Solution.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit th?t b?i.');
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

  const badge = completed ? (
    <span className={`sd-badge ${handoffOk ? 'sd-badge--pending' : 'sd-badge--done'}`}>
      {handoffOk ? '?? n?p ? ch? AM' : '?? n?p'}
    </span>
  ) : (
    <span className="sd-badge sd-badge--draft">Draft</span>
  );

  return (
    <div className="sd-page" data-testid="sales-discovery-wizard">
      <div className="sd-card">
        <header className="sd-head">
          <div>
            <h1 className="sd-title">CRM ? Sales Discovery</h1>
            <p className="sd-kicker">
              {lead?.company_name || brief.company_name || '?'}
              {lead?.full_name ? ` ? ${lead.full_name}` : ''}
            </p>
          </div>
          <div className="sd-head-meta">
            {badge}
            <span className={`sd-progress${complete ? ' sd-progress--full' : ''}`} data-testid="sd-progress">
              {progress.filled}/{progress.total} tr??ng c?t l?i
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
                <h2 className="sd-section__title">A. Th?ng tin doanh nghi?p</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field sd-field--wide">
                  <FieldLabel required>T?n DN / th??ng hi?u</FieldLabel>
                  <input
                    className="sd-input"
                    value={brief.company_name}
                    disabled={readOnly}
                    onChange={(e) => patch({ company_name: e.target.value })}
                    data-testid="sd-company"
                  />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Ng?nh ngh?</FieldLabel>
                  <select
                    className="sd-select"
                    value={brief.industry}
                    disabled={readOnly}
                    onChange={(e) => patch({ industry: e.target.value })}
                    data-testid="sd-industry"
                  >
                    <option value="">Ch?n ng?nh ngh?</option>
                    {industries.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <FieldLabel required>S?n ph?m / d?ch v? ch? l?c</FieldLabel>
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
                    placeholder="URL, c?ch nhau b?i kho?ng tr?ng"
                    onChange={(e) => patch({ websites: e.target.value })}
                  />
                </label>
              </div>
            </section>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">B. Ng??i li?n h?</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field">
                  <FieldLabel required>H? t?n</FieldLabel>
                  <input className="sd-input" value={brief.contact_name} disabled={readOnly} onChange={(e) => patch({ contact_name: e.target.value })} data-testid="sd-contact" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>S?T</FieldLabel>
                  <input className="sd-input" value={brief.phone} disabled={readOnly} onChange={(e) => patch({ phone: e.target.value })} data-testid="sd-phone" />
                </label>
                <label className="sd-field">
                  <FieldLabel>Email</FieldLabel>
                  <input className="sd-input" value={brief.email} disabled={readOnly} onChange={(e) => patch({ email: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel>Ch?c v?</FieldLabel>
                  <select className="sd-select" value={brief.job_title} disabled={readOnly} onChange={(e) => patch({ job_title: e.target.value })}>
                    <option value="">Ch?n ch?c v?</option>
                    {jobTitles.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sd-field sd-field--wide">
                  <FieldLabel>Quy?n quy?t ??nh ng?n s?ch</FieldLabel>
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
                <h2 className="sd-section__title">C. Nhu c?u Marketing</h2>
                <div className="sd-svc-wrap">
                  <button
                    type="button"
                    className={brief.services.length ? 'sd-svc-btn' : 'sd-svc-btn sd-svc-btn--ghost'}
                    onClick={() => setListOpen((open) => !open)}
                    data-testid="sd-service-list-btn"
                  >
                    Danh s?ch d?ch v? ({brief.services.length})
                  </button>
                  {listOpen ? (
                    <div className="sd-svc-panel" data-testid="sd-service-list">
                      {brief.services.length === 0 ? (
                        <p className="sd-svc-empty">Ch?a ch?n d?ch v?. B?m + b?n d??i ?? th?m (l?u ngay).</p>
                      ) : (
                        brief.services.map((slug) => (
                          <div key={slug} className="sd-svc-item">
                            <span>{serviceName(options, slug)}</span>
                            {readOnly ? null : (
                              <button type="button" className="sd-svc-remove" onClick={() => void onToggleService(slug, true)} aria-label="G? d?ch v?">
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
                <FieldLabel required>D?ch v? kh?ch h?ng quan t?m</FieldLabel>
                <p className="sd-hint">B?m + ?? th?m ? l?u ngay, kh?ng c?n n?t Save.</p>
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
                              title={on ? '?? th?m ? b?m ?? g?' : 'Th?m d?ch v?'}
                              onClick={() => void onToggleService(svc.slug, on)}
                            >
                              {on ? '?' : '+'}
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
                  <FieldLabel required>V?n ?? l?n nh?t</FieldLabel>
                  <textarea className="sd-textarea" value={brief.biggest_problem} disabled={readOnly} onChange={(e) => patch({ biggest_problem: e.target.value })} data-testid="sd-problem" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>M?c ti?u Marketing</FieldLabel>
                  <textarea className="sd-textarea" value={brief.marketing_goal} disabled={readOnly} onChange={(e) => patch({ marketing_goal: e.target.value })} data-testid="sd-goal" />
                </label>
                <label className="sd-field">
                  <FieldLabel>S?n ph?m ?u ti?n qu?ng b?</FieldLabel>
                  <input className="sd-input" value={brief.priority_product} disabled={readOnly} onChange={(e) => patch({ priority_product: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Kh?ch h?ng m?c ti?u</FieldLabel>
                  <input className="sd-input" value={brief.target_customers} disabled={readOnly} onChange={(e) => patch({ target_customers: e.target.value })} data-testid="sd-audience" />
                </label>
                <label className="sd-field">
                  <FieldLabel required>Khu v?c tri?n khai</FieldLabel>
                  <input className="sd-input" value={brief.region} disabled={readOnly} onChange={(e) => patch({ region: e.target.value })} data-testid="sd-region" />
                </label>
              </div>
            </section>
            <section className="sd-section">
              <div className="sd-section__head">
                <h2 className="sd-section__title">D. Hi?n tr?ng Marketing</h2>
              </div>
              <div className="sd-field" style={{ marginBottom: 12 }}>
                <FieldLabel>K?nh ?ang d?ng</FieldLabel>
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
                  <FieldLabel>K?t qu? Marketing hi?n t?i</FieldLabel>
                  <textarea className="sd-textarea" value={brief.current_results} disabled={readOnly} onChange={(e) => patch({ current_results: e.target.value })} />
                </label>
                <label className="sd-field">
                  <FieldLabel>Kh? kh?n / nguy?n nh?n ch?a hi?u qu?</FieldLabel>
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
                <h2 className="sd-section__title">E. Ng?n s?ch & th?i ?i?m</h2>
              </div>
              <div className="sd-grid">
                <label className="sd-field">
                  <FieldLabel required>Ng?n s?ch Marketing d? ki?n</FieldLabel>
                  <select className="sd-select" value={brief.budget_band} disabled={readOnly} onChange={(e) => patch({ budget_band: e.target.value })} data-testid="sd-budget">
                    <option value="">Ch?n m?c ng?n s?ch</option>
                    {budgets.map((row) => (
                      <option key={row.value} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <FieldLabel required>Th?i gian mong mu?n tri?n khai</FieldLabel>
                  <select className="sd-select" value={brief.timeline_band} disabled={readOnly} onChange={(e) => patch({ timeline_band: e.target.value })} data-testid="sd-timeline">
                    <option value="">Ch?n th?i ?i?m</option>
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
                <h2 className="sd-section__title">F. Ghi ch? & m?c ?? s?n s?ng</h2>
              </div>
              <div className="sd-grid sd-grid--1">
                <label className="sd-field">
                  <FieldLabel required>Ghi ch? n?i dung cu?c g?i</FieldLabel>
                  <textarea className="sd-textarea" value={brief.call_notes} disabled={readOnly} onChange={(e) => patch({ call_notes: e.target.value })} data-testid="sd-notes" />
                </label>
                <div className="sd-field">
                  <FieldLabel required>M?c ?? s?n s?ng</FieldLabel>
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
                <h3>Ki?m tra tr??c khi Submit</h3>
                <span>{complete ? '?? 14 m?c' : `Thi?u ${progress.missing.length} m?c`}</span>
              </div>
              {complete ? (
                <p className="sd-check__list is-ok">?? ?? {progress.total} tr??ng c?t l?i.</p>
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
              M? H?ng ch? Solution ?
            </Link>
          </p>
        ) : null}
        {saving && !readOnly ? <p className="sd-hint">?ang l?u nh?p?</p> : null}

        <div className="sd-actions">
          <button type="button" className="btn btn-secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Quay l?i
          </button>
          <div className="sd-actions__right">
            <button type="button" className="btn btn-secondary" onClick={exportJson} data-testid="sd-export">
              Xu?t d? li?u
            </button>
            {step < 3 ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep((s) => Math.min(3, s + 1))} data-testid="sd-next">
                Ti?p theo
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary sd-submit"
                disabled={!complete || readOnly || submitting}
                onClick={() => void onSubmit()}
                data-testid="sd-submit"
                title={!complete ? '?i?n h?t c?c tr??ng * tr??c khi Submit' : undefined}
              >
                {submitting ? '?ang n?p?' : 'Submit to AM'}
              </button>
            )}
          </div>
        </div>
      </div>

      {historicalSessions.length > 0 ? (
        <div className="sd-history">
          <h3>Phi?n c? (ch? xem)</h3>
          {historicalSessions.map((row) => (
            <details key={row.id}>
              <summary>
                #{row.id} ? {row.status} ? {row.decision || '?'} ? BANT {row.bant_total ?? 0}/30 ? {row.updated_at}
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
    { label: 'T?n DN / th??ng hi?u', value: brief.company_name },
    { label: 'Ng?nh ngh?', value: optionLabel(options?.industries ?? [], brief.industry) || brief.industry },
    { label: 'S?n ph?m ch? l?c', value: brief.flagship_product },
    { label: 'Ng??i li?n h?', value: [brief.contact_name, brief.phone, brief.email].filter(Boolean).join(' ? ') },
    { label: 'Ch?c v?', value: optionLabel(options?.job_titles ?? [], brief.job_title) || brief.job_title },
    { label: 'Quy?n quy?t ??nh NS', value: authorityLabel(brief.budget_authority) },
    { label: 'D?ch v? quan t?m', value: brief.services.map((s) => serviceName(options ?? null, s)).join(', ') },
    { label: 'V?n ?? l?n nh?t', value: brief.biggest_problem },
    { label: 'M?c ti?u Marketing', value: brief.marketing_goal },
    { label: 'KH m?c ti?u', value: brief.target_customers },
    { label: 'Khu v?c', value: brief.region },
    { label: 'K?nh ?ang d?ng', value: channelLabels(brief.channels) },
    { label: 'Ng?n s?ch', value: budgetLabel(brief.budget_band) },
    { label: 'Th?i ?i?m', value: timelineLabel(brief.timeline_band) },
    { label: 'Ghi ch? cu?c g?i', value: brief.call_notes },
    { label: 'M?c ?? s?n s?ng', value: temperatureLabel(brief.temperature) },
  ].filter((row) => row.value);
}

export { emptySalesDiscoveryBrief, isDiscoveryComplete };
