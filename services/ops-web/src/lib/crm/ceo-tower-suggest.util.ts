export type TowerSuggestRow = {
  suggest_action: string | null;
  suggest_params: Record<string, unknown> | null;
  href: string;
  title_vi: string;
};

export type TowerSuggestMapped =
  | { kind: 'hidden' }
  | { kind: 'upcoming'; tooltip: string }
  | { kind: 'ready'; action_id: string; params: Record<string, unknown> }
  | { kind: 'needs_owner'; action_id: 'assign_lead'; params: Record<string, unknown> };

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseOwnerStaffIdInput(raw: string | null): number | null {
  if (raw == null) return null;
  return asPositiveInt(String(raw).trim());
}

export function mapTowerSuggestAction(
  row: TowerSuggestRow,
  opts?: { can_act?: boolean },
): TowerSuggestMapped {
  if (opts?.can_act === false) return { kind: 'hidden' };
  const action = String(row.suggest_action ?? '').trim();
  if (!action) return { kind: 'hidden' };

  const base = row.suggest_params ?? {};
  const title = String(row.title_vi ?? '').trim().slice(0, 120);

  switch (action) {
    case 'assign_lead': {
      const lead_id = asPositiveInt(base.lead_id);
      const owner_staff_id = asPositiveInt(base.owner_staff_id ?? base.staff_id);
      const params: Record<string, unknown> = {};
      if (lead_id != null) params.lead_id = lead_id;
      if (owner_staff_id != null) {
        params.owner_staff_id = owner_staff_id;
        return { kind: 'ready', action_id: 'assign_lead', params };
      }
      return { kind: 'needs_owner', action_id: 'assign_lead', params };
    }
    case 'remind_staff': {
      const staff_id = asPositiveInt(base.staff_id ?? base.owner_staff_id);
      if (staff_id == null) return { kind: 'hidden' };
      return {
        kind: 'ready',
        action_id: 'remind_staff',
        params: {
          staff_id,
          title,
          body: title,
          link_href: row.href,
        },
      };
    }
    case 'sla_remind_lead': {
      const lead_id = asPositiveInt(base.lead_id);
      const tier = String(base.tier ?? '').trim();
      const suggested_action = String(base.suggested_action ?? '').trim();
      if (lead_id == null || !tier || !suggested_action) return { kind: 'hidden' };
      return {
        kind: 'ready',
        action_id: 'sla_remind_lead',
        params: {
          lead_id,
          tier,
          suggested_action,
        },
      };
    }
    case 'ack_ops_alert': {
      const alert_id = asPositiveInt(base.alert_id);
      if (alert_id == null) return { kind: 'hidden' };
      return {
        kind: 'ready',
        action_id: 'ack_ops_alert',
        params: { alert_id },
      };
    }
    case 'remind_contract_approval': {
      const lead_id = asPositiveInt(base.lead_id);
      if (lead_id == null) return { kind: 'hidden' };
      const params: Record<string, unknown> = { lead_id };
      const contract_id = asPositiveInt(base.contract_id);
      if (contract_id != null) params.contract_id = contract_id;
      return { kind: 'ready', action_id: 'remind_contract_approval', params };
    }
    case 'prioritize_solution_queue': {
      const lead_id = asPositiveInt(base.lead_id);
      if (lead_id == null) return { kind: 'hidden' };
      const params: Record<string, unknown> = { lead_id };
      const note = String(base.note ?? title).trim().slice(0, 200);
      if (note) params.note = note;
      return { kind: 'ready', action_id: 'prioritize_solution_queue', params };
    }
    default:
      return { kind: 'hidden' };
  }
}
