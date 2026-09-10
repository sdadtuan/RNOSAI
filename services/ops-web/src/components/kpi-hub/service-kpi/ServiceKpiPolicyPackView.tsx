'use client';

import { WORDING_FIREWALL_COPY } from '@/lib/service-kpi-copy';
import type { ServiceKpiPolicyPack } from '@/lib/service-kpi-types';
import { SkpiMoatNotice } from './SkpiMoatNotice';
import { SkpiTwoColumnLayout } from './SkpiTwoColumnLayout';

type Props = {
  packs: ServiceKpiPolicyPack[];
  loading?: boolean;
  error?: string | null;
};

function industryLabel(industry: string): string {
  if (industry === 'real_estate') return 'Bất động sản';
  return industry;
}

type RuleRow = { label: string; value: string; tone?: 'red' | 'default' };

function parsePackRules(pack: ServiceKpiPolicyPack): RuleRow[] {
  const rules = pack.rules_json;
  if (Array.isArray(rules) && rules.length) {
    return rules.slice(0, 6).map((r, i) => {
      if (r && typeof r === 'object' && 'label' in r && 'value' in r) {
        const row = r as { label: string; value: string };
        return { label: row.label, value: row.value };
      }
      return { label: `Rule ${i + 1}`, value: JSON.stringify(r) };
    });
  }
  if (pack.industry === 'real_estate') {
    return [
      { label: 'Booking / deposit / GMV', value: 'Cấm COMMITTED', tone: 'red' },
      { label: 'Lead forecast', value: 'Budget + LP + creative' },
      { label: 'Từ cấm proposal', value: pack.banned_phrases[0] ?? 'cam kết doanh số', tone: 'red' },
      { label: 'Reviewer', value: 'Legal khi claim nhạy cảm' },
    ];
  }
  return pack.banned_phrases.slice(0, 4).map((p) => ({ label: 'Từ cấm', value: p, tone: 'red' as const }));
}

const OTHER_PACKS = [
  { label: 'Spa / Beauty', value: 'Cấm guarantee liệu trình' },
  { label: 'Education', value: 'Cấm cam kết tuyển sinh' },
  { label: 'Healthcare', value: 'Legal bắt buộc' },
];

export function ServiceKpiPolicyPackView({ packs, loading, error }: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải policy pack…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;
  if (!packs.length) return <p className="kpi-hub-empty">Chưa có policy pack.</p>;

  const primary = packs[0]!;

  return (
    <SkpiTwoColumnLayout
      main={
        <div className="kpi-hub-skpi-packs-stack">
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>Pack · {industryLabel(primary.industry)}</h2>
              {primary.regulated ? <span className="kpi-hub-badge kpi-hub-badge--red">Regulated</span> : null}
            </header>
            <div className="kpi-hub-card__body">
              <ul className="kpi-hub-skpi-pack-rules">
                {parsePackRules(primary).map((row) => (
                  <li key={row.label} className="kpi-hub-skpi-pack-rules__row">
                    <span>{row.label}</span>
                    <b className={row.tone === 'red' ? 'is-critical' : undefined}>{row.value}</b>
                  </li>
                ))}
              </ul>
              {primary.banned_phrases.length ? (
                <div className="kpi-hub-skpi-banned-list">
                  {primary.banned_phrases.map((phrase) => (
                    <span key={phrase} className="kpi-hub-skpi-banned-phrase">
                      {phrase}
                    </span>
                  ))}
                </div>
              ) : null}
              <SkpiMoatNotice title="QT-0089 BĐS">
                KPI booking nếu gắn Cam kết bàn giao → block publish. Ép BUSINESS_OUTCOME + Sales SLA khách.
              </SkpiMoatNotice>
            </div>
          </article>
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>Pack khác</h2>
            </header>
            <div className="kpi-hub-card__body">
              <ul className="kpi-hub-skpi-pack-rules">
                {OTHER_PACKS.map((row) => (
                  <li key={row.label} className="kpi-hub-skpi-pack-rules__row">
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      }
      aside={
        <article className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h2>Wording firewall</h2>
          </header>
          <div className="kpi-hub-card__body">
            <p className="kpi-hub-muted kpi-hub-skpi-firewall-copy">{WORDING_FIREWALL_COPY}</p>
          </div>
        </article>
      }
    />
  );
}
