import type { ReactNode } from 'react';

export type StatCardAccent = 'hot' | 'sky' | 'iris' | 'cold' | 'won' | 'warm';

export type StatCardProps = {
  value: ReactNode;
  label: ReactNode;
  accent?: StatCardAccent;
  className?: string;
};

export function StatCard({ value, label, accent = 'cold', className }: StatCardProps) {
  const classes = ['rn-stat-card', `rn-stat-card--${accent}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <div className="rn-stat-card__value">{value}</div>
      <div className="rn-stat-card__label">{label}</div>
    </div>
  );
}
