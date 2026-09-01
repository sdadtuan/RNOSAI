export const TOWER_UPCOMING_TOOLTIP = 'Sắp có — nhắc duyệt HĐ / ưu tiên queue';

const UPCOMING_ACTIONS = new Set(['prioritize_solution_queue', 'remind_contract_approval']);

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
  if (UPCOMING_ACTIONS.has(action)) {
    return { kind: 'upcoming', tooltip: TOWER_UPCOMING_TOOLTIP };
  }

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
      return {
        kind: 'ready',
        action_id: 'sla_remind_lead',
        params: {
          lead_id: asPositiveInt(base.lead_id),
          tier: String(base.tier ?? '').trim(),
          suggested_action: String(base.suggested_action ?? '').trim(),
        },
      };
    }
    case 'ack_ops_alert': {
      return {
        kind: 'ready',
        action_id: 'ack_ops_alert',
        params: { alert_id: asPositiveInt(base.alert_id) },
      };
    }
    default:
      return { kind: 'hidden' };
  }
}
