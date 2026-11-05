import type { PoolClient } from 'pg';
import { parseLeadMeta } from '../leads-funnel/care-pipeline.util';
import type { AgencyClientLinkMode, PromoteAgencyClientResult } from './contract.types';
import {
  buildPromoteClientNotes,
  generatePromoteClientCode,
  isValidClientUuid,
  pickDedupClientId,
  resolvePromoteClientName,
} from './contract-promote-client.util';

export interface EnsureAgencyClientInput {
  contractId: number;
  leadId: number;
  lifecycleId: number;
  contractAgencyClientId: string;
  leadAgencyClientId: string;
  leadMetaJson: string | null;
  leadFullName: string;
  assignedAmStaffId: number | null;
  leadOwnerStaffId: number | null;
  actorEmail: string;
}

async function clientExists(client: PoolClient, clientId: string): Promise<boolean> {
  const result = await client.query(`SELECT 1 FROM clients WHERE id = $1::uuid LIMIT 1`, [clientId]);
  return Boolean(result.rows[0]);
}

async function resolveOwnerAmEmail(
  client: PoolClient,
  assignedAmStaffId: number | null,
  leadOwnerStaffId: number | null,
  actorEmail: string,
): Promise<string | null> {
  for (const staffId of [assignedAmStaffId, leadOwnerStaffId]) {
    if (staffId == null || !Number.isFinite(staffId)) continue;
    const result = await client.query<{ email: string | null }>(
      `SELECT NULLIF(trim(email), '') AS email FROM crm_staff WHERE id = $1 LIMIT 1`,
      [staffId],
    );
    const email = String(result.rows[0]?.email ?? '').trim();
    if (email.includes('@')) return email.slice(0, 240);
  }
  const actor = actorEmail.trim();
  return actor.includes('@') ? actor.slice(0, 240) : null;
}

async function loadTakenCodes(client: PoolClient, leadId: number): Promise<Set<string>> {
  const prefix = `L${leadId}`.toUpperCase();
  const result = await client.query<{ code: string }>(
    `SELECT upper(code) AS code FROM clients WHERE upper(code) = $1 OR upper(code) LIKE $2`,
    [prefix, `${prefix}%`],
  );
  return new Set(result.rows.map((row) => String(row.code ?? '').trim()).filter(Boolean));
}

async function findDedupCandidates(client: PoolClient, name: string): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM clients
     WHERE lower(trim(name)) = lower(trim($1))
       AND lower(COALESCE(status, '')) NOT IN ('offboarded', 'archived')
     ORDER BY created_at ASC`,
    [name],
  );
  return result.rows.map((row) => String(row.id)).filter(Boolean);
}

async function linkAgencyClient(
  client: PoolClient,
  input: EnsureAgencyClientInput,
  clientId: string,
  mode: AgencyClientLinkMode,
  payload: Record<string, unknown>,
): Promise<PromoteAgencyClientResult> {
  await client.query(
    `UPDATE crm_contracts SET agency_client_id = $2, updated_at = NOW() WHERE id = $1`,
    [input.contractId, clientId],
  );
  await client.query(
    `UPDATE crm_leads SET agency_client_id = $2::uuid, updated_at = NOW() WHERE sqlite_lead_id = $1`,
    [input.leadId, clientId],
  );
  await client.query(
    `INSERT INTO crm_contract_events (contract_id, event_type, actor, payload_json, created_at)
     VALUES ($1, 'client_linked', $2, $3::jsonb, NOW())`,
    [input.contractId, input.actorEmail.slice(0, 120), JSON.stringify({ mode, client_id: clientId, ...payload })],
  );
  return { agency_client_id: clientId, agency_client_link_mode: mode };
}

export async function ensureAgencyClientOnPromote(
  client: PoolClient,
  input: EnsureAgencyClientInput,
): Promise<PromoteAgencyClientResult> {
  const preexisting = input.contractAgencyClientId.trim();
  if (isValidClientUuid(preexisting) && (await clientExists(client, preexisting))) {
    return linkAgencyClient(client, input, preexisting, 'link_preexisting', {});
  }

  const leadClient = input.leadAgencyClientId.trim();
  if (isValidClientUuid(leadClient) && (await clientExists(client, leadClient))) {
    return linkAgencyClient(client, input, leadClient, 'link_lead', {});
  }

  const meta = parseLeadMeta(input.leadMetaJson);
  const name = resolvePromoteClientName(meta, input.leadFullName);
  const candidates = await findDedupCandidates(client, name);
  const dedup = pickDedupClientId(candidates);

  if (dedup.clientId) {
    return linkAgencyClient(client, input, dedup.clientId, dedup.mode, {});
  }

  const needsMerge = dedup.mode === 'link_ambiguous';
  const takenCodes = await loadTakenCodes(client, input.leadId);
  const code = generatePromoteClientCode(input.leadId, takenCodes);
  const ownerAmId = await resolveOwnerAmEmail(
    client,
    input.assignedAmStaffId,
    input.leadOwnerStaffId,
    input.actorEmail,
  );
  const notes = buildPromoteClientNotes(input.contractId, input.leadId, input.lifecycleId, needsMerge);

  const insert = await client.query<{ id: string }>(
    `INSERT INTO clients (code, name, industry_slug, status, owner_am_id, notes)
     VALUES ($1, $2, NULL, 'onboarding', $3, $4)
     RETURNING id::text`,
    [code, name, ownerAmId, notes],
  );
  const newClientId = String(insert.rows[0]?.id ?? '').trim();
  if (!newClientId) throw new Error('Không tạo được Agency Client');

  try {
    await client.query(`SELECT seed_client_onboarding($1::uuid)`, [newClientId]);
  } catch {
    // optional on minimal DDL
  }

  return linkAgencyClient(client, input, newClientId, 'created', {
    ambiguous_ids: dedup.ambiguousIds,
    needs_merge: needsMerge,
  });
}
