import { UnprocessableEntityException } from '@nestjs/common';

export type MsosDbLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export async function requireClient(db: MsosDbLike, clientId: string): Promise<void> {
  const result = await db.query(`SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`, [clientId]);
  if (!result.rows[0]) {
    throw new UnprocessableEntityException({ error: 'client_not_found' });
  }
}

export async function requireLead(db: MsosDbLike, leadId: string): Promise<void> {
  const result = await db.query(`SELECT id::text FROM leads WHERE id = $1::uuid LIMIT 1`, [leadId]);
  if (!result.rows[0]) {
    throw new UnprocessableEntityException({ error: 'lead_not_found' });
  }
}

export async function requireCreative(db: MsosDbLike, creativeId: string): Promise<void> {
  const result = await db.query(`SELECT id::text FROM crm_cp_assets WHERE id = $1::uuid LIMIT 1`, [
    creativeId,
  ]);
  if (!result.rows[0]) {
    throw new UnprocessableEntityException({ error: 'creative_not_found' });
  }
}
