'use client';

import type { ServiceKpiPolicyPack } from '@/lib/service-kpi-types';

type Props = {
  packs: ServiceKpiPolicyPack[];
  loading?: boolean;
  error?: string | null;
};

function industryLabel(industry: string): string {
  if (industry === 'real_estate') return 'Bất động sản';
  return industry;
}

export function ServiceKpiPolicyPackView({ packs, loading, error }: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải policy pack…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;
  if (!packs.length) return <p className="kpi-hub-empty">Chưa có policy pack.</p>;

  return (
    <div className="kpi-hub-skpi-packs">
      {packs.map((pack) => (
        <article key={pack.id} className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h2>{industryLabel(pack.industry)}</h2>
            {pack.regulated ? <span className="kpi-hub-badge kpi-hub-badge--amber">Regulated</span> : null}
          </header>
          <div className="kpi-hub-card__body">
            <h3>Từ cấm</h3>
            <ul className="kpi-hub-tag-list">
              {pack.banned_phrases.map((phrase) => (
                <li key={phrase} className="kpi-hub-tag kpi-hub-tag--danger">
                  {phrase}
                </li>
              ))}
            </ul>
            <h3>Rules</h3>
            <pre className="kpi-hub-code-block">{JSON.stringify(pack.rules_json, null, 2)}</pre>
          </div>
        </article>
      ))}
    </div>
  );
}
