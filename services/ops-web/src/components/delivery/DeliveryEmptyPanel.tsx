'use client';

type DeliveryEmptyPanelProps = {
  title: string;
  message: string;
  cta?: string;
};

export function DeliveryEmptyPanel({ title, message, cta }: DeliveryEmptyPanelProps) {
  return (
    <div className="delivery-empty-panel">
      <h4>{title}</h4>
      <p>{message}</p>
      {cta ? <span className="delivery-empty-panel__cta">{cta}</span> : null}
    </div>
  );
}
