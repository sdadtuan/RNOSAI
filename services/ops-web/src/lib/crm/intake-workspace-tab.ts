export type IntakeWorkspaceTab = 'qualify' | 'discovery' | 'win_intel' | 'handoff';

export function pickDefaultIntakeTab(input: {
  sessionStatus?: string | null;
  bantTotal: number;
}): IntakeWorkspaceTab {
  if (input.sessionStatus === 'completed') return 'handoff';
  if ((input.bantTotal ?? 0) < 18) return 'discovery';
  return 'qualify';
}
