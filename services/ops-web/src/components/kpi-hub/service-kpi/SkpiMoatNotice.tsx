'use client';

type Props = {
  children: React.ReactNode;
  title?: string;
};

export function SkpiMoatNotice({ children, title = 'Moat' }: Props) {
  return (
    <div className="kpi-hub-skpi-moat">
      <strong>{title}:</strong> {children}
    </div>
  );
}
