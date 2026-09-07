'use client';

import Link from 'next/link';
import { CpRenderOps } from './CpRenderOps';

export function CpOpsMonitor({
  scope,
  title = 'Render Operations',
}: {
  scope?: string;
  title?: string;
}) {
  const currentScope = scope === 'team' || scope === 'all' ? scope : 'me';
  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Ops</p>
          <h1>{title}</h1>
          <p className="cp-muted">Theo dõi queue và thao tác render jobs.</p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/video?scope=${currentScope}`}>Video drafts</Link>
      </header>
      <CpRenderOps scope={currentScope} />
    </div>
  );
}
