'use client';

type ServiceKpiMockupFrameProps = {
  view: 'warroom' | 'templates' | 'instances' | 'measurement' | 'tracking' | 'overview' | 'contracts' | 'reconcile' | 'packs';
};

export function ServiceKpiMockupFrame({ view }: ServiceKpiMockupFrameProps) {
  const src = `/mockups/rnosai-service-kpi-mockup.html#${view}`;

  return (
    <div
      className="kpi-hub-service-kpi-mockup"
      data-testid={`service-kpi-mockup-${view}`}
      style={{ width: '100%', minHeight: 'calc(100vh - 220px)', margin: '-0.5rem -0.25rem 0' }}
    >
      <iframe
        title={`Service KPI mockup — ${view}`}
        src={src}
        loading="lazy"
        style={{
          display: 'block',
          width: '100%',
          minHeight: 'calc(100vh - 220px)',
          border: 0,
          borderRadius: 12,
          background: '#f6f7fb',
        }}
      />
    </div>
  );
}
