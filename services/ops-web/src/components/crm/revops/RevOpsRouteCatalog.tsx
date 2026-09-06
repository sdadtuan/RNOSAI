'use client';

import {
  REVOPS_NAV_GROUPS,
  activeRevopsHref,
} from '@/lib/crm/revops-nav.util';

const SOT_FILE = 'rnosai-revops-enterprise-mockup.html';

export function RevOpsRouteCatalog({ pathname }: { pathname: string }) {
  const href = activeRevopsHref(pathname);
  const item = REVOPS_NAV_GROUPS.flatMap((group) => group.items).find((nav) => nav.href === href);
  const view = item?.label ?? 'Command Center';
  const path = href.split('?')[0];

  return (
    <div className="revops-route-map" data-testid="revops-route-catalog">
      <b>RNOSAI route:</b>
      <span className="revops-route-chip">View: {view}</span>
      <span className="revops-route-chip">
        Path: <code>{path}</code>
      </span>
      <span className="revops-route-chip">Shell: RevOpsShell</span>
      <span className="revops-route-chip">SoT: {SOT_FILE}</span>
    </div>
  );
}
