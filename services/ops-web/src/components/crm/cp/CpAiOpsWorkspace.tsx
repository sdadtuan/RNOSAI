'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { CpAiOpsFlags } from '@/lib/crm/cp-api';
import {
  aiOpsHref,
  parseAiOpsPane,
  type CpAiOpsPane,
} from '@/lib/crm/cp-ai-ops-panes.util';
import { dash } from '@/lib/crm/cp-format';
import { CpAiOpsMagnificPane } from './CpAiOpsMagnificPane';
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
  const comfyHealth = false;
  const canSubmitComfy = flags.comfy && comfyHealth;

  return (
    <section className="cp-ai-ops">
      <nav className="cp-ai-ops-panes" aria-label="AI Ops panes">
        {PANES.map((item) => (
          <Link
            key={item.id}
            className={pane === item.id ? 'cp-ai-ops-pane is-on' : 'cp-ai-ops-pane'}
            href={aiOpsHref(projectId, item.id, extra)}
          >
            {item.label}
            {item.id === 'magnific' ? (
              <span className="cp-ai-ops-chip">Wave B</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {pane === 'weave' ? (
        <div className="cp-ai-ops-body">
          <CpWeaveWorkOrder projectId={projectId} enabled={flags.weave} />
        </div>
      ) : null}

      {pane === 'magnific' ? (
        <div className="cp-ai-ops-body">
          <CpAiOpsMagnificPane projectId={projectId} flags={flags} />
        </div>
      ) : null}

      {pane === 'comfy' ? (
        <div className="cp-ai-ops-body">
          <p>Đang xây GPU — chưa nhận job</p>
          <button
            className="cp-btn cp-btn--primary"
            type="button"
            disabled={!canSubmitComfy}
          >
            Submit
          </button>
        </div>
      ) : null}
    </section>
  );
}
