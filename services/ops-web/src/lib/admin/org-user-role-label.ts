export type OrgUserRoleFields = {
  position_code?: string;
  position_id: number;
  team_names?: string[];
  team_codes?: string[];
  position_team_name?: string;
  job_functions?: string[];
};

function filled(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

/** Column "Chức vụ · Team · Functions". Team falls back to the position's team. */
export function formatOrgUserRole(row: OrgUserRoleFields): string {
  const position = row.position_code?.trim() || String(row.position_id);
  const namedTeams = filled(row.team_names);
  const codedTeams = filled(row.team_codes);
  const teams = namedTeams.length
    ? namedTeams
    : codedTeams.length
      ? codedTeams
      : row.position_team_name?.trim()
        ? [row.position_team_name.trim()]
        : [];
  const functions = filled(row.job_functions);
  return [position, teams.join(', '), functions.join(', ')].filter(Boolean).join(' · ');
}
