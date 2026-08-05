'use client';

import Link from 'next/link';
import type { FunnelPrimaryAction, FunnelStepperContext } from '@/lib/crm/funnel-stepper.types';

interface Props {
  action: FunnelPrimaryAction | null;
  context: FunnelStepperContext;
  busy?: boolean;
  onAction?: (action: FunnelPrimaryAction) => void | Promise<void>;
}

function confirmMessage(action: FunnelPrimaryAction): string {
  return action.blockReason || 'Xác nhận chuyển giai đoạn?';
}

export function CrmFunnelStepPrimaryAction({ action, context, busy, onAction }: Props) {
  if (!action || action.kind === 'none') {
    if (!action?.label) return null;
    return (
      <div className="crm-funnel-stepper__cta-bar">
        <button type="button" className="btn btn-sm" disabled title={action.blockReason}>
          {action.label}
        </button>
        {action.blockReason ? (
          <p className="muted crm-funnel-stepper__cta-hint">{action.blockReason}</p>
        ) : null}
      </div>
    );
  }

  const sticky = context === 'intake';
  const barClass = `crm-funnel-stepper__cta-bar${sticky ? ' crm-funnel-stepper__cta-bar--sticky' : ''}`;

  const runAction = () => {
    if (!onAction || action.disabled || busy) return;
    if (action.requiresConfirm && !window.confirm(confirmMessage(action))) return;
    void onAction(action);
  };

  if (action.kind === 'link' && action.href) {
    return (
      <div className={barClass}>
        <Link href={action.href} className="btn btn-primary btn-sm">
          {action.label}
        </Link>
      </div>
    );
  }

  if (action.kind === 'anchor' && action.anchor) {
    return (
      <div className={barClass}>
        <a href={action.anchor} className="btn btn-primary btn-sm">
          {action.label}
        </a>
      </div>
    );
  }

  const variant =
    action.kind === 'advance_presales' ? 'btn-primary' : action.kind === 'ensure_presales' ? 'btn-primary' : 'btn';

  return (
    <div className={barClass}>
      <button
        type="button"
        className={`btn btn-sm ${variant}`}
        disabled={action.disabled || busy}
        title={action.disabled ? action.blockReason : undefined}
        onClick={runAction}
      >
        {busy ? 'Đang xử lý…' : action.label}
      </button>
      {action.disabled && action.blockReason ? (
        <p className="muted crm-funnel-stepper__cta-hint">{action.blockReason}</p>
      ) : null}
      {action.requiresOverride && !action.disabled ? (
        <p className="muted crm-funnel-stepper__cta-hint">Cần quyền Director và lý do override.</p>
      ) : null}
    </div>
  );
}
