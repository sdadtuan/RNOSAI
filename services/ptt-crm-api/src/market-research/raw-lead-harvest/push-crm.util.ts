export type PushableRawLead = {
  status: string;
  contactable: boolean;
  crm_lead_id?: number | null;
  verify_json?: Record<string, unknown> | null;
};

export function assertRawLeadPushable(
  lead: PushableRawLead,
): { ok: true } | { ok: false; error: string } {
  if (lead.status === 'pushed' || lead.crm_lead_id != null) {
    return { ok: false, error: 'already_in_crm' };
  }
  if (lead.status !== 'accepted') {
    return { ok: false, error: 'not_accepted' };
  }
  if (!lead.contactable) {
    return { ok: false, error: 'not_contactable' };
  }
  if (lead.verify_json?.already_customer === true) {
    return { ok: false, error: 'already_customer' };
  }
  return { ok: true };
}
