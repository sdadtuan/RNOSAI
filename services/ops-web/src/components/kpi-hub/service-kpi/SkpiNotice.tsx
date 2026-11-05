'use client';

type Props = {
  children: React.ReactNode;
  title?: string;
};

export function SkpiNotice({ children, title }: Props) {
  return (
    <div className="kpi-hub-skpi-notice">
      {title ? <strong>{title}</strong> : null}
      {title ? ' ' : null}
      {children}
    </div>
  );
}
