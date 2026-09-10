import type { ReactNode } from 'react';

type Props = {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
};

export function PmTwoColumnLayout({ main, aside, className }: Props) {
  return (
    <div className={`kpi-hub-pm-layout${className ? ` ${className}` : ''}`}>
      <div className="kpi-hub-pm-main">{main}</div>
      <aside className="kpi-hub-pm-aside kpi-hub-pm-aside--sticky">{aside}</aside>
    </div>
  );
}
