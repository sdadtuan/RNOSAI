'use client';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function PmFilterChips({ options, value, onChange, className }: Props) {
  return (
    <div className={`kpi-hub-pm-filters${className ? ` ${className}` : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value || '__all__'}
          type="button"
          className={`kpi-hub-pm-filter${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
