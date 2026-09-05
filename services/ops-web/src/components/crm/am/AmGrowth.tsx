'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  fetchAmOpportunities,
  type AmOpportunitiesList,
  type AmOpportunity,
  type AmOpportunitySuggestion,
} from '@/lib/crm/am-api';
import {
  AM_OPP_STAGES,
  amGrowthEmpty,
  amGrowthKpiSubtitle,
  amGrowthMoney,
  amGrowthStageLabel,
  parseAmOppStage,
} from '@/lib/crm/am-growth.util';
import { AmOpportunityForm, type AmOpportunityDraft } from './AmOpportunityForm';
import { useAmPage } from './AmShell';

type AmGrowthProps = {
  agencyClientId?: string;
  embedded?: boolean;
};

export function AmGrowth({ agencyClientId, embedded }: AmGrowthProps) {
  const { token, canEdit, scope } = useAmPage();
  const searchParams = useSearchParams();
  const clientFromQuery = searchParams.get('agency_client_id') ?? '';
  const clientId = agencyClientId || clientFromQuery || '';
  const [stage, setStage] = useState(parseAmOppStage(searchParams.get('stage')));
  const [data, setData] = useState<AmOpportunitiesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<AmOpportunityDraft | null | undefined>(undefined);
  const [evidence, setEvidence] = useState<unknown>(undefined);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(
        await fetchAmOpportunities(token, {
          scope,
          agency_client_id: clientId || undefined,
          stage: stage || undefined,
        }),
      );
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [clientId, scope, stage, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data?.kpis ?? { pipeline_vnd: null, weighted_vnd: null, won_month_vnd: null };
  const items = data?.items ?? [];
  const suggestions = data?.suggestions ?? [];

  return (
    <section className={embedded ? 'am-360__panel' : 'am-page'}>
      <header className="am-page__head">
        <div>
          <h1>{embedded ? 'Cơ hội' : 'Cơ hội tăng trưởng'}</h1>
          <p className="am-muted">{loading && !data ? '—' : amGrowthKpiSubtitle(kpis)}</p>
        </div>
        <div className="am-growth__tools">
          {embedded ? (
            <Link className="am-btn" href={`/crm/account-management/opportunities?agency_client_id=${clientId}`}>
              Mở pipeline
            </Link>
          ) : (
            <label className="am-field">
              <span>Stage</span>
              <select value={stage} onChange={(ev) => setStage(parseAmOppStage(ev.target.value))}>
                <option value="">Tất cả</option>
                {AM_OPP_STAGES.map((opt) => (
                  <option key={opt} value={opt}>
                    {amGrowthStageLabel(opt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="am-btn am-btn--primary"
            disabled={!canEdit}
            title={canEdit ? 'Tạo cơ hội' : 'Cần quyền crm_am.edit'}
            onClick={() => canEdit && setDraft({ agency_client_id: clientId || undefined })}
          >
            + Cơ hội
          </button>
        </div>
      </header>

      {error ? (
        <div className="am-widget__error">
          <p>{error === 'not_found' ? 'Không tìm thấy khách trong phạm vi của bạn.' : 'Không tải được cơ hội.'}</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="am-tiles">
        <article className="am-tile">
          <span>Pipeline</span>
          <strong>{amGrowthMoney(kpis.pipeline_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Weighted</span>
          <strong>{amGrowthMoney(kpis.weighted_vnd)}</strong>
        </article>
        <article className="am-tile">
          <span>Won tháng này</span>
          <strong>{amGrowthMoney(kpis.won_month_vnd)}</strong>
        </article>
      </div>

      <div className="am-list__table">
        <table className="am-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Cơ hội</th>
              <th>Loại</th>
              <th>Giá trị</th>
              <th>Stage</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="am-muted">
                  —
                </td>
              </tr>
            ) : (
              items.map((row) => <OppRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>

      <section className="am-widget" aria-label="AI suggestions">
        <div className="am-widget__head">
          <h2>AI suggestions (cần AM xác nhận)</h2>
        </div>
        {suggestions.length === 0 ? (
          <p className="am-muted">Chưa có đề xuất (AI tắt)</p>
        ) : (
          <ul className="am-growth__suggest">
            {suggestions.map((row, idx) => (
              <li key={`${row.title ?? 's'}-${idx}`}>
                <span>{row.title || '—'}</span>
                <button type="button" className="am-btn" onClick={() => setEvidence(row.ai_evidence_json ?? null)}>
                  Xem evidence
                </button>
                <button
                  type="button"
                  className="am-btn"
                  disabled={!canEdit}
                  onClick={() => canEdit && setDraft(suggestionDraft(row, clientId))}
                >
                  Tạo draft
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft !== undefined ? (
        <AmOpportunityForm
          agencyClientId={agencyClientId || draft?.agency_client_id}
          canEdit={canEdit}
          draft={draft ?? undefined}
          onClose={() => setDraft(undefined)}
          onSaved={() => {
            setDraft(undefined);
            void load();
          }}
        />
      ) : null}

      {evidence !== undefined ? (
        <div
          className="am-drawer-bg"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setEvidence(undefined);
          }}
        >
          <div className="am-drawer" role="dialog" aria-modal="true" aria-label="AI evidence">
            <div className="am-drawer__head">
              <strong>AI evidence</strong>
              <button type="button" className="am-btn" onClick={() => setEvidence(undefined)}>
                Đóng
              </button>
            </div>
            <pre className="am-growth__evidence">
              {evidence == null || evidence === '' ? '—' : JSON.stringify(evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OppRow({ row }: { row: AmOpportunity }) {
  return (
    <tr>
      <td>
        <Link href={`/crm/account-management/clients/${row.agency_client_id}`}>{amGrowthEmpty(row.account_name)}</Link>
      </td>
      <td>{amGrowthEmpty(row.title)}</td>
      <td>{amGrowthEmpty(row.kind)}</td>
      <td>{amGrowthMoney(row.value_vnd)}</td>
      <td>{amGrowthStageLabel(row.stage)}</td>
      <td>{amGrowthEmpty(row.next_step)}</td>
    </tr>
  );
}

function suggestionDraft(row: AmOpportunitySuggestion, fallbackClient: string): AmOpportunityDraft {
  return {
    agency_client_id: row.agency_client_id || fallbackClient || undefined,
    title: row.title,
    kind: row.kind ?? undefined,
    package: row.package ?? undefined,
    value_vnd: row.value_vnd,
    probability: row.probability,
    next_step: row.next_step,
    source: 'ai',
    ai_evidence_json: row.ai_evidence_json,
  };
}
