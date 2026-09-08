import { QT_TENANT_ID } from './quote-settings.repository';
import type { QuoteQueryFn } from './quote-audit.repository';
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

export async function applyQuoteCatalogImport(
  query: QuoteQueryFn,
  input: { jobId: string; parsed: QuoteCatalogImportParsed },
): Promise<QuoteCatalogImportJobResult> {
  const jobId = String(input.jobId);
  await query(`UPDATE crm_quote_import_jobs SET state = $1 WHERE id::text = $2 RETURNING id`, [
    'running',
    jobId,
  ]);
  try {
    let rateCount = 0;
    for (const card of input.parsed.rate_cards) {
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
    for (const revision of input.parsed.revisions) {
      await query(
        `INSERT INTO crm_quote_catalog_revisions (catalog_service_id, profile_json)
         VALUES ($1, $2)
         RETURNING id`,
        [revision.catalog_service_id, revision.profile_json],
      );
      revisionCount += 1;
    }
    const result = { rate_cards: rateCount, revisions: revisionCount, errors: [] as string[] };
    await query(
      `UPDATE crm_quote_import_jobs SET state = $1, result_json = $2 WHERE id::text = $3 RETURNING id`,
      ['done', result, jobId],
    );
    return { job_id: jobId, state: 'done', result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = { rate_cards: 0, revisions: 0, errors: [message] };
    await query(
      `UPDATE crm_quote_import_jobs SET state = $1, result_json = $2 WHERE id::text = $3 RETURNING id`,
      ['failed', result, jobId],
    );
    throw err;
  }
}
