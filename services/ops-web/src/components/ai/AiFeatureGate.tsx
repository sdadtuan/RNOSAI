'use client';

import type { ReactNode } from 'react';
import { aiCopilotEnabled, isAiPilotUser } from '@/lib/ai-flags';
import type { StoredStaffUser } from '@/lib/auth';

interface Props {
  user: StoredStaffUser | null;
  children: ReactNode;
}

/** RNOS-06 — hide copilot when flag off or user outside pilot cohort. */
export function AiFeatureGate({ user, children }: Props) {
  if (!aiCopilotEnabled()) {
    return null;
  }
  if (user && !isAiPilotUser(user.id)) {
    return (
      <div className="ai-copilot-gate muted">
        Copilot chỉ dành cho nhóm pilot. Liên hệ quản trị để tham gia.
      </div>
    );
  }
  return <>{children}</>;
}
