'use client';

import { KPI_HUB_SETTINGS_NAV } from '@/lib/kpi-hub-fixtures';

type Props = {
  active: string;
  onSelect: (item: string) => void;
};

export function KpiHubSettingsNav({ active, onSelect }: Props) {
  return (
    <nav className="kpi-hub-settings-nav" aria-label="Cài đặt KPI Hub">
      {KPI_HUB_SETTINGS_NAV.map((item) => (
        <button
          key={item}
          type="button"
          className={`kpi-hub-settings-nav__item${active === item ? ' is-active' : ''}`}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
