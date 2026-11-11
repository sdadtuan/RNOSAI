'use client';

export const RECEIVE_LEAD_HELPER =
  'Chỉ NV có tick này mới hiện khi gán pool dự án PTT.';
export const RECEIVE_SOLUTION_HELPER =
  'NV được tick sẽ nhận case Solution chung với AM.';

type ReceiveQueueFlagsProps = {
  canReceiveLeads: boolean;
  canReceiveSolution: boolean;
  onLeadsChange: (next: boolean) => void;
  onSolutionChange: (next: boolean) => void;
  disabled?: boolean;
};

function ReceiveFlag({
  checked,
  onChange,
  label,
  helper,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  helper: string;
  disabled?: boolean;
}) {
  return (
    <div className="receive-queue-flags__item">
      <label className="receive-queue-flags__label">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="receive-queue-flags__text">{label}</span>
      </label>
      <p className="muted receive-queue-flags__hint">{helper}</p>
    </div>
  );
}

export function ReceiveQueueFlags({
  canReceiveLeads,
  canReceiveSolution,
  onLeadsChange,
  onSolutionChange,
  disabled,
}: ReceiveQueueFlagsProps) {
  return (
    <div className="receive-queue-flags">
      <ReceiveFlag
        checked={canReceiveLeads}
        onChange={onLeadsChange}
        label="Nhận Lead"
        helper={RECEIVE_LEAD_HELPER}
        disabled={disabled}
      />
      <ReceiveFlag
        checked={canReceiveSolution}
        onChange={onSolutionChange}
        label="Nhận Solution"
        helper={RECEIVE_SOLUTION_HELPER}
        disabled={disabled}
      />
    </div>
  );
}
