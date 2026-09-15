'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCrmLeadLookups, type CrmLeadLookupOption } from '@/lib/api';
import { fetchVnProvinces, fetchVnWards, type VnProvinceOption, type VnWardOption } from '@/lib/vn-geo-api';
import {
  createRawLeadHarvest,
  exportRawLeads,
  fetchRawLeadHarvestProviders,
  getRawLeadHarvest,
  listRawLeadHarvests,
  listRawLeads,
  patchRawLead,
  pushRawLeadsToCrm,
  type HarvestProviderOption,
  type RawLead,
  type RawLeadHarvestJob,
} from '@/lib/market-research-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { RawLeadAcceptModal } from './RawLeadAcceptModal';

const FLAG_ON =
  String(process.env.NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST ?? '').trim() === '1';

const FEEDBACK_OPTS = [
  { value: 'bad_phone', label: 'Sai SĐT' },
  { value: 'bad_email', label: 'Sai email' },
  { value: 'fake_company', label: 'Công ty ảo' },
  { value: 'wrong_geo', label: 'Sai địa bàn' },
  { value: 'other', label: 'Khác' },
] as const;

const DIAL_OPTS = [
  { value: 'connected', label: 'Connected' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'email_bounced', label: 'Email bounced' },
  { value: 'out_of_business', label: 'Out of business' },
] as const;

/** Prefer harvest-oriented sources at the front of the chip grid. */
const HARVEST_SOURCE_PRIORITY = [
  'google_maps',
  'company_website',
  'yellow_pages',
  'industry_directory',
  'news',
  'website',
  'landing',
];

type Props = {
  projectId: number;
  token: string;
  user: StoredStaffUser | null;
};

function scoreBadge(score: number): string {
  if (score >= 70) return 'ok';
  if (score >= 50) return 'warn';
  return 'bad';
}

function jobStatusClass(status: string): string {
  if (status === 'succeeded') return 'job-status-done';
  if (status === 'failed') return 'job-status-dead';
  if (status === 'running' || status === 'queued') return 'job-status-pending';
  return 'job-status-running';
}

function leadStatusClass(status: string): string {
  if (status === 'accepted' || status === 'pushed') return 'rlh-status--ok';
  if (status === 'rejected' || status === 'auto_rejected') return 'rlh-status--bad';
  if (status === 'pending') return 'rlh-status--pending';
  return 'rlh-status--muted';
}

function classificationLabel(code: string | null | undefined): string {
  switch (code) {
    case 'pass':
      return 'Pass';
    case 'needs_review':
      return 'Cần review';
    case 'rejected_critic':
      return 'Critic reject';
    case 'rejected_gate':
      return 'Gate reject';
    case 'rejected_blacklist':
      return 'Blacklist';
    case 'rejected_dedupe':
      return 'Trùng';
    default:
      return code?.trim() ? code : '—';
  }
}

function sortLookups(options: CrmLeadLookupOption[], priority: string[]): CrmLeadLookupOption[] {
  const rank = new Map(priority.map((k, i) => [k, i]));
  return [...options].sort((a, b) => {
    const ra = rank.has(a.option_key) ? (rank.get(a.option_key) as number) : 1000;
    const rb = rank.has(b.option_key) ? (rank.get(b.option_key) as number) : 1000;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, 'vi');
  });
}

function ChipMultiSelect({
  options,
  selected,
  onChange,
  emptyHint,
}: {
  options: CrmLeadLookupOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}) {
  if (!options.length) {
    return <p className="form-hint">{emptyHint ?? 'Chưa có option Admin.'}</p>;
  }
  return (
    <div className="rlh-chip-grid" role="group">
      {options.map((o) => {
        const on = selected.includes(o.option_key);
        return (
          <button
            key={o.option_key}
            type="button"
            className={`rlh-chip${on ? ' is-selected' : ''}`}
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? selected.filter((k) => k !== o.option_key) : [...selected, o.option_key],
              )
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RawLeadHarvestPanel({ projectId, token, user }: Props) {
  const canRun = hasCap(user, 'crm_research', 'run');
  const canExport = hasCap(user, 'crm_research', 'export') || canRun;
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [industries, setIndustries] = useState<CrmLeadLookupOption[]>([]);
  const [titles, setTitles] = useState<CrmLeadLookupOption[]>([]);
  const [sources, setSources] = useState<CrmLeadLookupOption[]>([]);
  const [channels, setChannels] = useState<CrmLeadLookupOption[]>([]);
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [providers, setProviders] = useState<HarvestProviderOption[]>([]);

  const [industryKey, setIndustryKey] = useState('');
  const [titleKey, setTitleKey] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [sourceKeys, setSourceKeys] = useState<string[]>([]);
  const [channelKeys, setChannelKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<'quality' | 'volume' | 'marketing'>('quality');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [crossCheck, setCrossCheck] = useState(false);
  const [targetCount, setTargetCount] = useState<number | ''>(10);
  const [notes, setNotes] = useState('');

  const [jobs, setJobs] = useState<RawLeadHarvestJob[]>([]);
  const [leads, setLeads] = useState<RawLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [acceptLead, setAcceptLead] = useState<RawLead | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.code === provider) ?? null,
    [providers, provider],
  );
  const canCrossCheck = providers.filter((p) => p.configured).length >= 2;
  const sortedSources = useMemo(
    () => sortLookups(sources, HARVEST_SOURCE_PRIORITY),
    [sources],
  );

  const pendingCount = useMemo(
    () => leads.filter((l) => l.status === 'pending').length,
    [leads],
  );
  const acceptedCount = useMemo(
    () => leads.filter((l) => l.status === 'accepted' || l.status === 'pushed').length,
    [leads],
  );

  const reloadMeta = useCallback(async () => {
    const [ind, tit, src, ch, prov, harvestProv] = await Promise.all([
      fetchCrmLeadLookups(token, { kind: 'industry', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'job_title', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'source', active_only: true }),
      fetchCrmLeadLookups(token, { kind: 'channel', active_only: true }),
      fetchVnProvinces(token),
      fetchRawLeadHarvestProviders(token),
    ]);
    setIndustries(ind.options);
    setTitles(tit.options);
    setSources(src.options);
    setChannels(ch.options);
    setProvinces(prov);
    setProviders(harvestProv.providers.filter((p) => p.configured));
  }, [token]);

  const reloadJobsAndLeads = useCallback(async () => {
    const [j, l] = await Promise.all([
      listRawLeadHarvests(token, projectId),
      listRawLeads(token, projectId, { include_auto_rejected: true }),
    ]);
    setJobs(j.jobs);
    setLeads(l.leads);
  }, [token, projectId]);

  useEffect(() => {
    if (!FLAG_ON) return;
    void (async () => {
      try {
        await reloadMeta();
        await reloadJobsAndLeads();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được harvest');
      }
    })();
  }, [reloadMeta, reloadJobsAndLeads]);

  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      setWardCode('');
      return;
    }
    void fetchVnWards(token, provinceCode).then(setWards).catch(() => setWards([]));
  }, [provinceCode, token]);

  useEffect(() => {
    if (!selectedProvider) {
      setModel('');
      return;
    }
    setModel(selectedProvider.default_model ?? selectedProvider.models[0]?.id ?? '');
  }, [selectedProvider]);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const job = await getRawLeadHarvest(token, projectId, activeJobId);
          if (job.status === 'succeeded' || job.status === 'failed') {
            setActiveJobId(null);
            setMsg(
              job.status === 'succeeded'
                ? `Job #${job.id} xong — ${job.result_count} lead`
                : `Job #${job.id} lỗi: ${job.error_message ?? 'failed'}`,
            );
            await reloadJobsAndLeads();
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 3000);
    return () => clearInterval(timer);
  }, [activeJobId, token, projectId, reloadJobsAndLeads]);

  if (!FLAG_ON) {
    return (
      <p className="muted">
        Raw Lead Harvest đang tắt. Bật <code>NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1</code>.
      </p>
    );
  }

  return (
    <div className="rlh-panel">
      <div className="rlh-callout">
        <strong>Lead thô đã qua cửa chất lượng</strong>
        <span>AM vẫn cần xác minh evidence / liên hệ trước khi hứa với khách.</span>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <div>
            <h3 className="kpi-section-title">Tạo job thu thập</h3>
            <p className="form-hint">ICP → nguồn search → AI provider → chạy async.</p>
          </div>
          {activeJobId ? (
            <span className="job-status-pill job-status-pending">Đang chạy #{activeJobId}</span>
          ) : null}
        </div>

        {!canRun ? (
          <p className="muted">Cần quyền <code>crm_research.run</code></p>
        ) : (
          <form
            className="rlh-form"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setBusy(true);
                setError('');
                setMsg('');
                try {
                  const count =
                    typeof targetCount === 'number' && Number.isFinite(targetCount)
                      ? targetCount
                      : NaN;
                  if (!Number.isInteger(count) || count < 1) {
                    setError('Số lượng phải là số nguyên ≥ 1');
                    setBusy(false);
                    return;
                  }
                  const out = await createRawLeadHarvest(token, projectId, {
                    industry_key: industryKey,
                    job_title_key: titleKey || null,
                    province_code: provinceCode || null,
                    ward_code: provinceCode && wardCode ? wardCode : null,
                    source_keys: sourceKeys,
                    channel_keys: channelKeys,
                    provider,
                    model,
                    mode,
                    cross_check: canCrossCheck && crossCheck,
                    target_count: count,
                    notes: notes || undefined,
                  });
                  setActiveJobId(out.job_id);
                  setMsg(`Đã xếp hàng job #${out.job_id}`);
                  await reloadJobsAndLeads();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Tạo job thất bại');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <div className="rlh-section">
              <h4 className="rlh-section__title">1. ICP & địa bàn</h4>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">
                    Ngành <span className="form-required">*</span>
                  </span>
                  <select
                    value={industryKey}
                    onChange={(e) => setIndustryKey(e.target.value)}
                    required
                  >
                    <option value="">Chọn ngành…</option>
                    {industries.map((o) => (
                      <option key={o.option_key} value={o.option_key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Chức danh</span>
                  <select
                    value={titleKey}
                    onChange={(e) => setTitleKey(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {titles.map((o) => (
                      <option key={o.option_key} value={o.option_key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Tỉnh/TP</span>
                  <select
                    value={provinceCode}
                    onChange={(e) => {
                      setProvinceCode(e.target.value);
                      setWardCode('');
                    }}
                  >
                    <option value="">Tất cả</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Phường/Xã</span>
                  <select
                    value={wardCode}
                    onChange={(e) => setWardCode(e.target.value)}
                    disabled={!provinceCode}
                  >
                    <option value="">Tất cả</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rlh-section">
              <div className="rlh-section__head">
                <h4 className="rlh-section__title">
                  2. Nguồn search <span className="form-required">*</span>
                </h4>
                <span className="rlh-count">{sourceKeys.length} đã chọn</span>
              </div>
              <p className="form-hint">Ưu tiên Maps / website / directory — chọn ≥1.</p>
              <ChipMultiSelect
                options={sortedSources}
                selected={sourceKeys}
                onChange={setSourceKeys}
              />
            </div>

            <div className="rlh-section">
              <div className="rlh-section__head">
                <h4 className="rlh-section__title">3. Kênh (tuỳ chọn)</h4>
                <span className="rlh-count">{channelKeys.length} đã chọn</span>
              </div>
              <ChipMultiSelect options={channels} selected={channelKeys} onChange={setChannelKeys} />
            </div>

            <div className="rlh-section">
              <h4 className="rlh-section__title">4. AI & chế độ</h4>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">Chế độ</span>
                  <select
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as 'quality' | 'volume' | 'marketing')
                    }
                  >
                    <option value="quality">Quality — ít lead, chặt hơn</option>
                    <option value="volume">Volume — nhiều hơn, rủi ro ảo</option>
                    <option value="marketing">
                      Marketing — web/FB lấy SĐT + email (AM gửi MKT, không verify email)
                    </option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Số lượng</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={targetCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Allow empty while editing — Number('') === 0 would trap the digit 0.
                      if (raw === '') {
                        setTargetCount('');
                        return;
                      }
                      const n = Number(raw);
                      if (Number.isFinite(n)) setTargetCount(n);
                    }}
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">
                    Provider <span className="form-required">*</span>
                  </span>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    required
                  >
                    <option value="">Chọn provider…</option>
                    {providers.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">
                    Model <span className="form-required">*</span>
                  </span>
                  <select value={model} onChange={(e) => setModel(e.target.value)} required>
                    <option value="">Chọn model…</option>
                    {(selectedProvider?.models ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field form-field--full">
                  <span className="form-label">Ghi chú ICP</span>
                  <textarea
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="VD: spa cao cấp Quận 1–3, chủ hoặc marketing director…"
                  />
                </label>
              </div>

              {mode === 'volume' ? (
                <p className="rlh-inline-warn">
                  Volume tăng nguy cơ lead yếu/ảo — chỉ dùng để thăm dò.
                </p>
              ) : null}
              {mode === 'marketing' ? (
                <p className="rlh-inline-warn">
                  Marketing: scrape SĐT/email từ website + /lien-he; ưu tiên SME địa phương.
                  Thiếu contact vẫn giữ pending để review — AM gửi MKT khi có email/SĐT.
                </p>
              ) : null}

              {canCrossCheck ? (
                <label className="form-check rlh-crosscheck">
                  <input
                    type="checkbox"
                    checked={crossCheck}
                    onChange={(e) => setCrossCheck(e.target.checked)}
                  />
                  Cross-check 2 provider (top N — tốn thêm API)
                </label>
              ) : (
                <p className="form-hint">
                  Cross-check cần ≥2 Research AI provider đã cấu hình token.
                </p>
              )}
            </div>

            <div className="rlh-form__footer">
              <button
                type="submit"
                className="btn"
                disabled={busy || Boolean(activeJobId) || sourceKeys.length < 1}
              >
                {activeJobId ? `Đang chạy job #${activeJobId}…` : 'Chạy thu thập'}
              </button>
              {sourceKeys.length < 1 ? (
                <span className="form-hint">Chọn ít nhất 1 nguồn search.</span>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <h3 className="kpi-section-title">Jobs gần đây</h3>
          <span className="rlh-count">{jobs.length}</span>
        </div>
        {jobs.length === 0 ? (
          <div className="rlh-empty">Chưa có job — tạo job phía trên để bắt đầu.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table data-table--dense">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Filter</th>
                  <th>Provider / Model</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>#{j.id}</td>
                    <td>
                      <span className={`job-status-pill ${jobStatusClass(j.status)}`}>
                        {j.status}
                      </span>
                    </td>
                    <td>
                      <div className="rlh-filter-cell">
                        <strong>
                          {j.industry_label} · {j.job_title_label}
                        </strong>
                        <span className="muted">{j.province_name}</span>
                      </div>
                    </td>
                    <td>
                      <code className="rlh-mono">
                        {j.provider}/{j.model}
                      </code>
                    </td>
                    <td>
                      <strong>{j.result_count}</strong>
                      <span className="muted"> · gate {j.rejected_by_gate_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="kpi-card rlh-card">
        <div className="rlh-card__head">
          <div>
            <h3 className="kpi-section-title">Lead thô</h3>
            <p className="form-hint">
              {leads.length} dòng · {pendingCount} pending · {acceptedCount} accepted/pushed
              {selectedIds.length ? ` · ${selectedIds.length} đang chọn` : ''}
            </p>
          </div>
          <div className="rlh-toolbar">
            {canExport ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await exportRawLeads(
                        token,
                        projectId,
                        selectedIds.length ? { lead_ids: selectedIds } : {},
                      );
                      const blob = new Blob([out.csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `raw-leads-${projectId}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setMsg(`Đã export ${out.count} dòng`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Export thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Export CSV
              </button>
            ) : null}
            {canRun ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || selectedIds.length === 0}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const out = await pushRawLeadsToCrm(token, projectId, selectedIds);
                      setMsg(
                        `Push CRM: ${out.pushed.length} OK` +
                          (out.errors.length ? `, ${out.errors.length} lỗi` : ''),
                      );
                      if (out.errors[0]) {
                        setError(`${out.errors[0].raw_lead_id}: ${out.errors[0].error}`);
                      }
                      setSelectedIds([]);
                      await reloadJobsAndLeads();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Push CRM thất bại');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Push CRM ({selectedIds.length})
              </button>
            ) : null}
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rlh-empty">Chưa có lead — chạy job quality để thu thập.</div>
        ) : (
          <div className="data-table-wrap rlh-leads-wrap">
            <table className="data-table data-table--dense">
              <thead>
                <tr>
                  <th className="rlh-col-check">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={
                        leads.length > 0 && selectedIds.length === leads.length
                      }
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? leads.map((l) => l.id) : [])
                      }
                    />
                  </th>
                  <th>Score</th>
                  <th>ICP</th>
                  <th>Công ty</th>
                  <th>Liên hệ</th>
                  <th>Phân loại</th>
                  <th>Status</th>
                  <th>Dial</th>
                  <th>Feedback</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, lead.id]
                              : prev.filter((id) => id !== lead.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className={`badge ${scoreBadge(lead.quality_score)}`}>
                        {Math.round(lead.quality_score)}
                      </span>
                    </td>
                    <td className="muted">{Math.round(lead.icp_fit_score)}</td>
                    <td>
                      {lead.evidence_url ? (
                        <a href={lead.evidence_url} target="_blank" rel="noreferrer">
                          {lead.company_name}
                        </a>
                      ) : (
                        <strong>{lead.company_name}</strong>
                      )}
                      {lead.address ? <div className="muted rlh-sub">{lead.address}</div> : null}
                    </td>
                    <td>
                      <div>{lead.phone ?? '—'}</div>
                      <div className="muted rlh-sub">{lead.email ?? '—'}</div>
                    </td>
                    <td>
                      <span className="rlh-class">{classificationLabel(lead.classification)}</span>
                      {typeof lead.verify_json?.critic_reason === 'string' &&
                      lead.verify_json.critic_reason ? (
                        <div className="muted rlh-sub" title={String(lead.verify_json.critic_reason)}>
                          {String(lead.verify_json.critic_reason).slice(0, 48)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`rlh-status ${leadStatusClass(lead.status)}`}>
                        {lead.status}
                      </span>
                      {lead.crm_lead_id ? (
                        <div className="muted rlh-sub">CRM #{lead.crm_lead_id}</div>
                      ) : null}
                    </td>
                    <td>
                      {canRun ? (
                        <select
                          className="rlh-select-sm"
                          value={lead.dial_outcome ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            void patchRawLead(token, projectId, lead.id, {
                              dial_outcome: v as (typeof DIAL_OPTS)[number]['value'],
                            }).then(reloadJobsAndLeads);
                          }}
                        >
                          <option value="">—</option>
                          {DIAL_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.dial_outcome ?? '—'
                      )}
                    </td>
                    <td>
                      {canRun ? (
                        <select
                          className="rlh-select-sm"
                          value={lead.feedback_code ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            void patchRawLead(token, projectId, lead.id, {
                              feedback_code: v as (typeof FEEDBACK_OPTS)[number]['value'],
                            }).then(reloadJobsAndLeads);
                          }}
                        >
                          <option value="">—</option>
                          {FEEDBACK_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.feedback_code ?? '—'
                      )}
                    </td>
                    <td>
                      {canRun && lead.status === 'pending' ? (
                        <div className="rlh-row-actions">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setAcceptLead(lead)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              void patchRawLead(token, projectId, lead.id, {
                                status: 'rejected',
                              }).then(reloadJobsAndLeads)
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RawLeadAcceptModal
        open={Boolean(acceptLead)}
        companyName={acceptLead?.company_name ?? ''}
        busy={busy}
        onCancel={() => setAcceptLead(null)}
        onConfirm={(checklist) => {
          if (!acceptLead) return;
          void (async () => {
            setBusy(true);
            try {
              await patchRawLead(token, projectId, acceptLead.id, {
                status: 'accepted',
                accepted_checklist_json: checklist,
              });
              setAcceptLead(null);
              await reloadJobsAndLeads();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Accept thất bại');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </div>
  );
}
