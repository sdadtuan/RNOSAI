export type AssignmentKeyInput = {
  definition_code: string;
  scope_type: string;
  scope_id: string;
  period: string;
};

export function assignmentKey(input: AssignmentKeyInput): string {
  return [input.definition_code, input.scope_type, input.scope_id, input.period].join('|');
}

export function assertUniqueAssignment(
  existing: AssignmentKeyInput[],
  next: AssignmentKeyInput,
) {
  const key = assignmentKey(next);
  if (existing.some((row) => assignmentKey(row) === key)) {
    throw new Error('duplicate_assignment');
  }
}
