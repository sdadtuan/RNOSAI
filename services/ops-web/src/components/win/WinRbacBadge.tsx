import type { StoredStaffUser } from '@/lib/auth';

type WinRbacBadgeProps = {
  user: StoredStaffUser | null;
  className?: string;
  maxFunctions?: number;
};

function formatRbacLabel(user: StoredStaffUser, maxFunctions: number): string | null {
  const positionCode = user.position_code?.trim();
  const functions = (user.job_functions ?? []).map((f) => f.trim()).filter(Boolean);
  if (!positionCode && functions.length === 0) return null;

  const fnPart =
    functions.length === 0
      ? null
      : functions.length <= maxFunctions
        ? functions.join(', ')
        : `${functions.slice(0, maxFunctions).join(', ')} +${functions.length - maxFunctions}`;

  if (positionCode && fnPart) return `${positionCode} · ${fnPart}`;
  if (positionCode) return positionCode;
  return fnPart;
}

export function WinRbacBadge({ user, className = '', maxFunctions = 3 }: WinRbacBadgeProps) {
  if (!user) return null;
  const label = formatRbacLabel(user, maxFunctions);
  if (!label) return null;

  const overflow =
    (user.job_functions?.length ?? 0) > maxFunctions
      ? (user.job_functions ?? []).slice(maxFunctions).join(', ')
      : undefined;

  return (
    <span
      className={`win-badge-rbac ${className}`.trim()}
      title={overflow ? `${label} (${overflow})` : label}
    >
      {label}
    </span>
  );
}
