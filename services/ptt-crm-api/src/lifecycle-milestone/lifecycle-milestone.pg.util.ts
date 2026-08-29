import type { Pool, PoolClient } from 'pg';
import type { RecordMilestoneInput } from './lifecycle-milestone.types';

export const LIFECYCLE_MILESTONE_DDL = `
CREATE TABLE IF NOT EXISTS crm_lifecycle_milestones (
  id BIGSERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  milestone_key VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(40) NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, milestone_key)
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_key_at
  ON crm_lifecycle_milestones (milestone_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_lead
  ON crm_lifecycle_milestones (lead_id);
`;

export async function ensureLifecycleMilestoneSchema(db: Pool | PoolClient): Promise<void> {
  await db.query(LIFECYCLE_MILESTONE_DDL);
}

function toTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

export async function recordLifecycleMilestone(
  db: Pool | PoolClient,
  input: RecordMilestoneInput,
): Promise<void> {
  const leadId = Math.trunc(Number(input.leadId));
  if (!Number.isFinite(leadId) || leadId <= 0) return;
  await ensureLifecycleMilestoneSchema(db);
  await db.query(
    `INSERT INTO crm_lifecycle_milestones
       (lead_id, milestone_key, occurred_at, source, ref_id, payload_json)
     VALUES ($1, $2, $3::timestamptz, $4, $5, $6::jsonb)
     ON CONFLICT (lead_id, milestone_key) DO NOTHING`,
    [
      leadId,
      input.key,
      toTimestamp(input.occurredAt),
      String(input.source ?? '').slice(0, 40),
      String(input.refId ?? '').slice(0, 240),
      JSON.stringify(input.payload ?? {}),
    ],
  );
}
