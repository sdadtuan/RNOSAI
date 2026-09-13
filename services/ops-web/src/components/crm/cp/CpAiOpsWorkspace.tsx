'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { CpAiOpsFlags } from '@/lib/crm/cp-api';
import {
  aiOpsHref,
  parseAiOpsPane,
  type CpAiOpsPane,
} from '@/lib/crm/cp-ai-ops-panes.util';
import { CpAiOpsComfyPane } from './CpAiOpsComfyPane';
import { CpAiOpsMagnificPane } from './CpAiOpsMagnificPane';
import { CpAiOpsRecommend } from './CpAiOpsRecommend';
import { CpWeaveWorkOrder } from './CpWeaveWorkOrder';

const PANES: Array<{ id: CpAiOpsPane; label: string }> = [
  { id: 'weave', label: 'Weave' },
  { id: 'magnific', label: 'Magnific' },
  { id: 'comfy', label: 'Comfy' },
];

export function CpAiOpsWorkspace({
  projectId,
  flags,
}: {
  projectId: string;
  flags: CpAiOpsFlags;
}) {
  const searchParams = useSearchParams();
  const pane = parseAiOpsPane(searchParams.get('pane'));
  const extra = {
    wo: searchParams.get('wo') ?? undefined,
    job: searchParams.get('job') ?? undefined,
  };

  return (
    <section className="cp-ai-ops">
      <header className="cp-ai-ops__intro">
        <h2>AI Ops</h2>
        <p className="cp-muted">
          Canvas ngoài (Weave / Magnific / Comfy). CRM giữ Work Order, brief và sync output về DAM.
        </p>
      </header>

      <nav className="cp-subtabs" aria-label="AI Ops panes">
        {PANES.map((item) => (
          <Link
            key={item.id}
            className={pane === item.id ? 'cp-subtab is-on' : 'cp-subtab'}
            href={aiOpsHref(projectId, item.id, extra)}
          >
            {item.label}
            {item.id === 'magnific' ? (
              <span className="cp-subtab__badge">Wave B</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="cp-ai-ops__grid">
        <CpAiOpsRecommend projectId={projectId} />

        <div className="cp-ai-ops__main">
          {pane === 'weave' ? (
            <CpWeaveWorkOrder projectId={projectId} enabled={flags.weave} />
          ) : null}

          {pane === 'magnific' ? (
            <CpAiOpsMagnificPane projectId={projectId} flags={flags} />
          ) : null}

          {pane === 'comfy' ? (
            <CpAiOpsComfyPane projectId={projectId} flags={flags} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
