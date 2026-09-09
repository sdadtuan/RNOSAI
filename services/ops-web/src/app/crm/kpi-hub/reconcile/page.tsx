'use client';

import { useEffect, useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiChangeOrderStub } from '@/components/kpi-hub/service-kpi/ServiceKpiChangeOrderStub';
import { ServiceKpiReconcileTable } from '@/components/kpi-hub/service-kpi/ServiceKpiReconcileTable';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { getAccessToken } from '@/lib/auth';
import {
  fetchServiceKpiContractQuotes,
  fetchServiceKpiReconcile,
  fetchServiceKpiReconcileSources,
} from '@/lib/service-kpi-api';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';
import type { ServiceKpiQuoteContractScore, ServiceKpiReconcileRow } from '@/lib/service-kpi-types';

type SourceOption = {
  source_type: string;
  source_id: string;
  label: string;
};

function buildSourceLabel(
  source: { source_type: string; source_id: string; instance_count: number },
  quotes: ServiceKpiQuoteContractScore[],
): string {
  const quote = quotes.find(
    (q) => q.version_id === source.source_id || String(q.proposal_id) === source.source_id,
  );
  if (quote) {
    const code = quote.quote_code ?? `Proposal #${quote.proposal_id}`;
    const client = quote.client_name ? ` · ${quote.client_name}` : '';
    return `${code}${client} (${source.instance_count} KPI)`;
  }
  return `${source.source_type} · ${source.source_id} (${source.instance_count} KPI)`;
}

export default function KpiHubReconcilePage() {
  const token = getAccessToken() ?? '';
  const [sourceId, setSourceId] = useState('');
  const [rows, setRows] = useState<ServiceKpiReconcileRow[]>([]);
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coOpen, setCoOpen] = useState(false);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  useEffect(() => {
    if (!token) {
      setSourceOptions([]);
      return;
    }
    void Promise.all([fetchServiceKpiReconcileSources(token), fetchServiceKpiContractQuotes(token)])
      .then(([sourcesRes, quotesRes]) => {
        const options = sourcesRes.items.map((src) => ({
          source_type: src.source_type,
          source_id: src.source_id,
          label: buildSourceLabel(src, quotesRes.items),
        }));
        setSourceOptions(options);
        if (options.length) {
          setSourceId((current) => current || options[0]!.source_id);
        }
      })
      .catch(() => setSourceOptions([]));
  }, [token]);

  useEffect(() => {
    if (!token || !sourceId.trim()) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchServiceKpiReconcile(token, sourceId.trim())
      .then((res) => setRows(res.rows))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi reconcile'))
      .finally(() => setLoading(false));
  }, [token, sourceId]);

  const selectedLabel = sourceOptions.find((o) => o.source_id === sourceId)?.label ?? sourceId;

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Quoted vs Actual"
        subtitle="Đối soát 3 sổ Quoted · Delivered · Reported và hành vi publish"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Quoted vs Actual' }]}
        actions={
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={!sourceId}
            onClick={() => setCoOpen(true)}
          >
            + Change Order
          </button>
        }
        searchPlaceholder="Chọn quote/project…"
      >
        <label className="kpi-hub-field" style={{ maxWidth: 560, marginBottom: 16 }}>
          <span>Quote / Source</span>
          {sourceOptions.length ? (
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {sourceOptions.map((opt) => (
                <option key={`${opt.source_type}:${opt.source_id}`} value={opt.source_id}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="kpi-hub-muted">Chưa có source — tạo KPI instance từ Quote trước.</p>
          )}
        </label>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiReconcileTable rows={rows} sourceId={selectedLabel} dictionaryLabels={labels} />
      </KpiHubShell>
      <ServiceKpiChangeOrderStub open={coOpen} sourceId={sourceId || '—'} onClose={() => setCoOpen(false)} />
    </KpiHubPageGate>
  );
}
