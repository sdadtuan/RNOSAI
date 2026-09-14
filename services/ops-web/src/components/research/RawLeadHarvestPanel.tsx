'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCrmLeadLookups, type CrmLeadLookupOption } from '@/lib/api';
import { fetchVnProvinces, fetchVnWards, type VnProvinceOption, type VnWardOption } from '@/lib/vn-geo-api';
import {
  createRawLeadHarvest,
  fetchRawLeadHarvestProviders,
  getRawLeadHarvest,
  listRawLeadHarvests,
  listRawLeads,
  patchRawLead,
  type HarvestProviderOption,
  type RawLead,
  type RawLeadHarvestJob,
} from '@/lib/market-research-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { RawLeadAcceptModal } from './RawLeadAcceptModal';

const FLAG_ON =
  String(process.env.NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST ?? '').trim() === '1';

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

export function RawLeadHarvestPanel({ projectId, token, user }: Props) {
  const canRun = hasCap(user, 'crm_research', 'run');
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
  const [mode, setMode] = useState<'quality' | 'volume'>('quality');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [targetCount, setTargetCount] = useState(10);
  const [notes, setNotes] = useState('');

  const [jobs, setJobs] = useState<RawLeadHarvestJob[]>([]);
  const [leads, setLeads] = useState<RawLead[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [acceptLead, setAcceptLead] = useState<RawLead | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.code === provider) ?? null,
    [providers, provider],
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
      listRawLeads(token, projectId),
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

  function toggleKey(list: string[], key: string, on: boolean): string[] {
    if (on) return list.includes(key) ? list : [...list, key];
    return list.filter((k) => k !== key);
  }

  if (!FLAG_ON) {
    return (
      <p className="muted">
        Raw Lead Harvest đang tắt. Bật <code>NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1</code>.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="banner warn">
        Đây là lead thô đã qua cửa chất lượng — vẫn cần AM xác minh trước khi hứa với khách.
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <section className="kpi-card">
        <h3 className="kpi-section-title">Tạo job thu thập</h3>
        {!canRun ? (
          <p className="muted">Cần quyền crm_research.run</p>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setBusy(true);
                setError('');
                setMsg('');
                try {
                  const out = await createRawLeadHarvest(token, projectId, {
                    industry_key: industryKey,
                    job_title_key: titleKey,
                    province_code: provinceCode,
                    ward_code: wardCode || null,
                    source_keys: sourceKeys,
                    channel_keys: channelKeys,
                    provider,
                    model,
                    mode,
                    target_count: targetCount,
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
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label>
                Ngành
                <select
                  value={industryKey}
                  onChange={(e) => setIndustryKey(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {industries.map((o) => (
                    <option key={o.option_key} value={o.option_key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chức danh
                <select value={titleKey} onChange={(e) => setTitleKey(e.target.value)} required>
                  <option value="">—</option>
                  {titles.map((o) => (
                    <option key={o.option_key} value={o.option_key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tỉnh/TP
                <select
                  value={provinceCode}
                  onChange={(e) => setProvinceCode(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phường/Xã
                <select value={wardCode} onChange={(e) => setWardCode(e.target.value)}>
                  <option value="">(không chọn)</option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <legend>Nguồn search (≥1)</legend>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {sources.map((o) => (
                  <label key={o.option_key}>
                    <input
                      type="checkbox"
                      checked={sourceKeys.includes(o.option_key)}
                      onChange={(e) =>
                        setSourceKeys(toggleKey(sourceKeys, o.option_key, e.target.checked))
                      }
                    />{' '}
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Kênh (optional)</legend>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {channels.map((o) => (
                  <label key={o.option_key}>
                    <input
                      type="checkbox"
                      checked={channelKeys.includes(o.option_key)}
                      onChange={(e) =>
                        setChannelKeys(toggleKey(channelKeys, o.option_key, e.target.checked))
                      }
                    />{' '}
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label>
                Chế độ
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'quality' | 'volume')}
                >
                  <option value="quality">Quality</option>
                  <option value="volume">Volume</option>
                </select>
              </label>
              <label>
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {providers.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model
                <select value={model} onChange={(e) => setModel(e.target.value)} required>
                  <option value="">—</option>
                  {(selectedProvider?.models ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số lượng
                <input
                  type="number"
                  min={5}
                  max={mode === 'quality' ? 25 : 50}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  required
                />
              </label>
            </div>
            {mode === 'volume' ? (
              <p className="warn">
                Chế độ Volume tăng nguy cơ lead yếu/ảo — khuyến nghị chỉ dùng để thăm dò.
              </p>
            ) : null}
            <label>
              Ghi chú ICP
              <textarea
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </label>
            <button type="submit" disabled={busy || Boolean(activeJobId)}>
              {activeJobId ? `Đang chạy job #${activeJobId}…` : 'Chạy thu thập'}
            </button>
          </form>
        )}
      </section>

      <section className="kpi-card">
        <h3 className="kpi-section-title">Jobs gần đây</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Filter</th>
              <th>Provider/Model</th>
              <th>Results</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>{j.status}</td>
                <td>
                  {j.industry_label} · {j.job_title_label} · {j.province_name}
                </td>
                <td>
                  {j.provider}/{j.model}
                </td>
                <td>
                  {j.result_count} (gate reject {j.rejected_by_gate_count})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="kpi-card">
        <h3 className="kpi-section-title">Lead thô</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>ICP</th>
              <th>Công ty</th>
              <th>SĐT</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <span className={`badge ${scoreBadge(lead.quality_score)}`}>
                    {lead.quality_score}
                  </span>
                </td>
                <td>{lead.icp_fit_score}</td>
                <td>
                  {lead.evidence_url ? (
                    <a href={lead.evidence_url} target="_blank" rel="noreferrer">
                      {lead.company_name}
                    </a>
                  ) : (
                    lead.company_name
                  )}
                  <div className="muted">{lead.address}</div>
                </td>
                <td>{lead.phone ?? '—'}</td>
                <td>{lead.email ?? '—'}</td>
                <td>{lead.status}</td>
                <td>
                  {canRun && lead.status === 'pending' ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button type="button" onClick={() => setAcceptLead(lead)}>
                        Accept
                      </button>
                      <button
                        type="button"
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
