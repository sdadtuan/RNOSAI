'use client';

import {
  resolveLifecycleNextAction,
  type LifecycleAdvanceInfo,
  type LifecycleNextActionKind,
} from '@/lib/crm/lifecycle-delivery-next-action';
import type { StoredStaffUser } from '@/lib/auth';

type Props = {
  user: StoredStaffUser;
  advance: LifecycleAdvanceInfo | null;
  loading?: boolean;
  saving?: boolean;
  canEdit: boolean;
  onOpenWorkflow: () => void;
  onOpenTmmtTab: () => void;
  onOpenLaunchQaTab: () => void;
  onOpenFinanceTab: () => void;
  onAdvanceStage: () => void;
};

function handlerForKind(
  kind: LifecycleNextActionKind,
  handlers: Pick<
    Props,
    'onOpenWorkflow' | 'onOpenTmmtTab' | 'onOpenLaunchQaTab' | 'onOpenFinanceTab' | 'onAdvanceStage'
  >,
): (() => void) | undefined {
  switch (kind) {
    case 'continue_tasks':
    case 'onboard_checklist':
    case 'fallback':
      return handlers.onOpenWorkflow;
    case 'open_tmmt':
      return handlers.onOpenTmmtTab;
    case 'open_launch_qa':
      return handlers.onOpenLaunchQaTab;
    case 'open_finance':
      return handlers.onOpenFinanceTab;
    case 'advance_stage':
      return handlers.onAdvanceStage;
    default:
      return undefined;
  }
}

export function LifecycleDeliveryNextActionCard({
  user,
  advance,
  loading,
  saving,
  canEdit,
  onOpenWorkflow,
  onOpenTmmtTab,
  onOpenLaunchQaTab,
  onOpenFinanceTab,
  onAdvanceStage,
}: Props) {
  void user;

  if (loading) {
    return (
      <div className="lifecycle-delivery-nba" data-testid="lifecycle-delivery-next-action">
        <p className="muted" style={{ margin: 0 }}>
          Đang tải việc kế tiếp…
        </p>
      </div>
    );
  }

  if (!advance) {
    return null;
  }

  const action = resolveLifecycleNextAction(advance);
  const onPrimary = handlerForKind(action.kind, {
    onOpenWorkflow,
    onOpenTmmtTab,
    onOpenLaunchQaTab,
    onOpenFinanceTab,
    onAdvanceStage,
  });

  return (
    <div className="lifecycle-delivery-nba" data-testid="lifecycle-delivery-next-action">
      <div className="lifecycle-delivery-nba__body">
        <h3 className="lifecycle-delivery-nba__title">{action.title}</h3>
        {action.subtitle ? <p className="lifecycle-delivery-nba__subtitle">{action.subtitle}</p> : null}
      </div>
      {action.primaryLabel && onPrimary ? (
        <button
          type="button"
          className="btn btn-sm lifecycle-delivery-nba__primary"
          disabled={!canEdit || saving}
          onClick={onPrimary}
        >
          {action.primaryLabel}
        </button>
      ) : null}
    </div>
  );
}
