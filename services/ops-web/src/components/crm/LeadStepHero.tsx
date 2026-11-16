import type { ReactNode } from 'react';
import './lead-step-hero.css';

export type LeadStepHeroIcon = 'intake' | 'brief' | 'solution' | 'quote' | 'contract' | 'implement';

const ICONS: Record<LeadStepHeroIcon, string[]> = {
  intake: [
    'M6.5 3h3l1.5 4-2 1.5a12 12 0 006 6L17 13l4 1.5v3A16 16 0 016.5 3z',
  ],
  brief: [
    'M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z',
    'M14 3v6h6',
  ],
  solution: [
    'M13 2L4 14h7l-1 8 10-13h-7l1-7z',
  ],
  quote: [
    'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
    'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12',
    'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17',
  ],
  contract: [
    'M14 2H7a1 1 0 00-1 1v18a1 1 0 001 1h10a1 1 0 001-1V8z',
    'M14 2v6h6',
    'M9 13h6M9 17h4',
  ],
  implement: [
    'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z',
    'M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
    'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
    'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  ],
};

function Glyph({ name }: { name: LeadStepHeroIcon }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function LeadStepHero({
  title,
  subtitle,
  icon,
  titleAs: TitleTag = 'h2',
  testId,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: LeadStepHeroIcon;
  titleAs?: 'h2' | 'h3';
  testId?: string;
}) {
  return (
    <header className="lead-step-hero" data-testid={testId}>
      <span className="lead-step-hero__icon" aria-hidden="true">
        <Glyph name={icon} />
      </span>
      <div className="lead-step-hero__copy">
        <TitleTag className="lead-step-hero__title">{title}</TitleTag>
        {subtitle ? <div className="lead-step-hero__sub">{subtitle}</div> : null}
      </div>
      <span className="lead-step-hero__wave" aria-hidden="true" />
    </header>
  );
}
