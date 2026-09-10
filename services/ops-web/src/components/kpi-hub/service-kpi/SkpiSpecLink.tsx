'use client';

type Props = {
  specPath?: string;
  routePath?: string;
};

export function SkpiSpecLink({
  specPath = 'docs/specs/2026-09-09-service-kpi-module-srs.md',
  routePath = '/crm/kpi-hub/service-templates',
}: Props) {
  return (
    <div className="kpi-hub-skpi-spec-link">
      <strong>SRS:</strong> {specPath} · Route production: <code>{routePath}</code>
    </div>
  );
}
