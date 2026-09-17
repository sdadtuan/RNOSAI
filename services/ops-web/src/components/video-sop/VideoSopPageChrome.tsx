import type { ReactNode } from 'react';

export function VideoSopPageChrome({
  title,
  subtitle,
  banner,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  banner?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="vd-page">
      <div className="vd-page__head">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="vd-page__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="vd-actions">{actions}</div> : null}
      </div>
      {banner ? <p className="vd-banner">{banner}</p> : null}
      {children}
    </div>
  );
}
