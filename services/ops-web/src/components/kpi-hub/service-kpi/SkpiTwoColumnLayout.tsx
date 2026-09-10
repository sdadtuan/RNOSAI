'use client';

import type { ReactNode } from 'react';

type Props = {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
};

export function SkpiTwoColumnLayout({ main, aside, className }: Props) {
  return (
    <div className={`kpi-hub-skpi-two-col${className ? ` ${className}` : ''}`}>
      <div className="kpi-hub-skpi-two-col__main">{main}</div>
      <aside className="kpi-hub-skpi-two-col__aside">{aside}</aside>
    </div>
  );
}
