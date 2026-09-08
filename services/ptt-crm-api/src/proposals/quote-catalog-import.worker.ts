import { BadRequestException } from '@nestjs/common';
import { QT_TENANT_ID } from './quote-settings.repository';
import type { QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import type { QuoteCatalogImportParsed } from './quote-catalog-import.util';

export type QuoteCatalogImportJobResult = {
  job_id: string;
  state: 'done' | 'failed';
  result: {
    rate_cards: number;
    revisions: number;
    errors: string[];
  };
};

async function writeCardsAndRevisions(
  query: QuoteQueryFn,
  parsed: QuoteCatalogImportParsed,
): Promise<{ rate_cards: number; revisions: number }> {
  let rateCount = 0;
  for (const card of parsed.rate_cards) {
    await query(
      `INSERT INTO crm_quote_rate_cards (
         tenant_id, dv_code, package_tier, fee_vnd, cost_labor_vnd,
         effective_from, effective_to, state
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        QT_TENANT_ID,
        card.dv_code,
        card.package_tier,
        card.fee_vnd,
        card.cost_labor_vnd,
        card.effective_from,
        card.effective_to,
        card.state,
      ],
    );
    rateCount += 1;
  }
  let revisionCount = 0;
  for (const revision of parsed.revisions) {
    await query(
      `INSERT INTO crm_quote_catalog_revisions (catalog_service_id, profile_json)
       VALUES ($1, $2)
       RETURNING id`,
      [revision.catalog_service_id, revision.profile_json],
    );
    revisionCount += 1;
  }
  return { rate_cards: rateCount, revisions: revisionCount };
}

export async function applyQuoteCatalogImport(
  db: QuoteQueryPort,
  input: { jobId: string; parsed: QuoteCatalogImportParsed },
): Promise<QuoteCatalogImportJobResult> {
  const jobId = String(input.jobId);
  if (!db.withTransaction) {
    throw new BadRequestException({ error: 'tx_unavailable' });
  }
  try {
    return await db.withTransaction(async (query) => {
      await query(`UPDATE crm_quote_import_jobs SET state = $1 WHERE id::text = $2 RETURNING id`, [
        'running',
        jobId,
      ]);
      const counts = await writeCardsAndRevisions(query, input.parsed);
      const result = { ...counts, errors: [] as string[] };
      await query(
        `UPDATE crm_quote_import_jobs SET state = $1, result_json = $2 WHERE id::text = $3 RETURNING id`,
        ['done', result, jobId],
      );
      return { job_id: jobId, state: 'done' as const, result };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = { rate_cards: 0, revisions: 0, errors: [message] };
    await db.query(
      `UPDATE crm_quote_import_jobs SET state = $1, result_json = $2 WHERE id::text = $3 RETURNING id`,
      ['failed', result, jobId],
    );
    return { job_id: jobId, state: 'failed', result };
  }
}
