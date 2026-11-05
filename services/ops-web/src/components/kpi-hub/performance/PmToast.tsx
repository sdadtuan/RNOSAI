'use client';

type Props = {
  message: string | null;
};

export function PmToast({ message }: Props) {
  if (!message) return null;
  return (
    <div className="kpi-hub-pm-toast is-show" role="status">
      {message}
    </div>
  );
}
