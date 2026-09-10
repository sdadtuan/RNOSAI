'use client';

type Props = {
  children: React.ReactNode;
  title?: string;
};

export function SkpiSuccessBanner({ children, title = '3 sổ' }: Props) {
  return (
    <div className="kpi-hub-skpi-success">
      <strong>{title}:</strong> {children}
    </div>
  );
}
