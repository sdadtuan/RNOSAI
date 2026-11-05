'use client';

import { CP_FILTER_PRESETS } from '@/lib/crm/cp-copy';

export type CpFilterChip = {
  id: string;
  label: string;
  active?: boolean;
};

type CpFilterChipsProps = {
  chips: CpFilterChip[];
  onToggle: (id: string) => void;
};

export function CpFilterChips({ chips, onToggle }: CpFilterChipsProps) {
  return (
    <div className="cp-filters" role="group" aria-label="Bộ lọc">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={chip.active ? 'cp-chip is-on' : 'cp-chip'}
          onClick={() => onToggle(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export const DEFAULT_OVERVIEW_FILTER_CHIPS: CpFilterChip[] = [
  { id: '30d', label: CP_FILTER_PRESETS.last30Days, active: true },
  { id: 'client_all', label: CP_FILTER_PRESETS.clientAll },
  { id: 'lifecycle_all', label: CP_FILTER_PRESETS.lifecycleAll },
];
