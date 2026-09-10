'use client';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SkpiFilterChips({ options, value, onChange, className }: Props) {
  return (
    <div className={`kpi-hub-skpi-filters${className ? ` ${className}` : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value || '__all__'}
          type="button"
          className={`kpi-hub-skpi-filter${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
