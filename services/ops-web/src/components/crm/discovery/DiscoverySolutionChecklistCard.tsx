'use client';

import {
  discoveryFieldFocus,
  discoveryMissingFields,
  discoverySolutionChecklist,
  emptySalesDiscoveryBrief,
  type SalesDiscoveryBrief,
} from '@/lib/crm/sales-discovery';
import { useDiscoveryLiveBrief } from '@/components/crm/discovery/discovery-live-brief';
import './discovery-solution-checklist.css';

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const I = {
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  check: 'M5 12l5 5L20 7',
};

function jumpToField(key: Parameters<typeof discoveryFieldFocus>[0]) {
  const dest = discoveryFieldFocus(key);
  window.dispatchEvent(
    new CustomEvent('sld:focus-discovery', { detail: { step: dest.step, testids: [dest.testid] } }),
  );
}

export function DiscoverySolutionChecklistCard({ fallbackBrief }: { fallbackBrief?: SalesDiscoveryBrief | null }) {
  const live = useDiscoveryLiveBrief();
  const brief = live?.brief ?? fallbackBrief ?? emptySalesDiscoveryBrief();
  const checklist = discoverySolutionChecklist(brief);
  const missingFields = discoveryMissingFields(brief);

  return (
    <section className="ahd-card" data-testid="ahd-checklist">
      <h3 className="ahd-card__title">
        <Icon d={I.list} />
        Checklist AM trước khi làm Solution
      </h3>
      <ul className="ahd-check">
        {checklist.items.map((item) => {
          const jumpKey = missingFields.find((row) => item.fields.includes(row.key))?.key;
          const partial = !item.ok && item.filled > 0;
          const markClass = item.ok ? '' : partial ? ' ahd-check__mark--partial' : ' ahd-check__mark--todo';
          const mark = (
            <span className={`ahd-check__mark${markClass}`} aria-hidden="true">
              {item.ok ? (
                <svg viewBox="0 0 16 16" width="10" height="10">
                  <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : null}
            </span>
          );
          const count = partial ? <span className="ahd-check__count">{item.filled}/{item.total}</span> : null;
          const liClass = item.ok ? 'is-ok' : partial ? 'is-partial' : undefined;
          return (
            <li key={item.key} className={liClass}>
              {item.ok || !jumpKey ? (
                <>
                  {mark}
                  {item.label}
                  {count}
                </>
              ) : (
                <button type="button" className="ahd-check__item" onClick={() => jumpToField(jumpKey)}>
                  {mark}
                  {item.label}
                  {count}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {checklist.allOk ? (
        <div className="ahd-pass-wrap">
          <span className="ahd-pass" data-testid="ahd-pass">
            <Icon d={I.check} size={13} />
            Đạt yêu cầu
          </span>
        </div>
      ) : null}
    </section>
  );
}
