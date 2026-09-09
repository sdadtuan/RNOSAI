import { BadRequestException } from '@nestjs/common';
import {
  assertLeadPartySendable,
  snapshotLeadParty,
  type LeadPartySnapshot,
} from '../leads/lead-party.util';
import type { QuoteQueryFn } from './quote-audit.repository';

function finiteId(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function snapshotLeadPartyForSend(
  query: QuoteQueryFn,
  leadId: unknown,
): Promise<LeadPartySnapshot | null> {
  const id = finiteId(leadId);
  if (!id) return null;
  const loaded = await query(
    `SELECT company_name, company_address, phone, email, logo_asset_id, full_name
       FROM crm_leads
      WHERE sqlite_lead_id = $1
      LIMIT 1`,
    [id],
  );
  const lead = loaded.rows[0];
  if (!lead) {
    throw new BadRequestException({ error: 'lead_not_found' });
  }
  const gate = assertLeadPartySendable(lead);
  if (!gate.ok) {
    throw new BadRequestException({ error: gate.error, message: gate.message });
  }
  return snapshotLeadParty(lead);
}

export async function persistVersionPartyJson(
  query: QuoteQueryFn,
  versionId: string,
  party: LeadPartySnapshot,
): Promise<void> {
  await query(`UPDATE crm_quote_versions SET party_json = $1 WHERE id::text = $2`, [
    party,
    versionId,
  ]);
}
