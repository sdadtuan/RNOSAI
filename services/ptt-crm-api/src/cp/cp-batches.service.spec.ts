import {
  assertCrmColumn,
  batchIdempotencyKey,
  CP_BATCH_MAX_ROWS,
  CP_STUB_BATCH_UNIT_CREDITS,
  CpBatchesService,
  estimateBatchCredits,
  validateBatchRow,
} from './cp-batches.service';

const TEMPLATE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BATCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CLIENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCOPE = { scope: 'all' as const, staffId: 9, teamIds: [] };

const REQUIRED = [
  'project_name',
  'price_from',
  'location',
  'cta',
  'hotline',
];

function sampleRow(n: number, missing?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    project_name: `Peak ${n}`,
    price_from: `Từ ${n} tỷ`,
    location: 'Q7',
    cta: 'Đăng ký tour',
    hotline: '1900',
  };
  if (missing) row[missing] = '';
  return row;
}

describe('batch helpers', () => {
  it('builds idempotency keys as batchId:row_no', () => {
    expect(batchIdempotencyKey(BATCH_ID, 3)).toBe(`${BATCH_ID}:3`);
  });

  it('marks a row invalid when a mapped required field is missing', () => {
    const mapping = Object.fromEntries(REQUIRED.map((key) => [key, key]));
    expect(validateBatchRow(sampleRow(1), REQUIRED, mapping).status).toBe('valid');
    expect(validateBatchRow(sampleRow(2, 'price_from'), REQUIRED, mapping)).toMatchObject({
      status: 'invalid',
      error: 'missing_mapped_required',
    });
  });

  it('estimates credits as valid_count × stub unit', () => {
    expect(CP_STUB_BATCH_UNIT_CREDITS).toBe(1);
    expect(estimateBatchCredits(46)).toBe(46 * CP_STUB_BATCH_UNIT_CREDITS);
    expect(estimateBatchCredits(46, 2)).toBe(92);
  });

  it('rejects CRM columns outside clients + service_lifecycle', () => {
    expect(() => assertCrmColumn('clients.name')).not.toThrow();
    expect(() => assertCrmColumn('service_lifecycle.stage')).not.toThrow();
    expect(() => assertCrmColumn('leads.email')).toThrow(
      expect.objectContaining({ error: 'unknown_crm_column' }),
    );
    expect(() => assertCrmColumn('clients; DROP TABLE clients')).toThrow(
      expect.objectContaining({ error: 'unknown_crm_column' }),
    );
  });
});

class BatchQuery {
  templates = [{
    id: TEMPLATE_ID,
    tenant_id: 'PTT',
    name: 'SKU Reels',
    variables_json: REQUIRED,
    rules_json: { unit_credits: 1 },
    status: 'published',
  }];
  batches: Record<string, unknown>[] = [];
  items: Record<string, unknown>[] = [];
  projects = [{
    id: PROJECT_ID,
    agency_client_id: CLIENT_ID,
    tenant_id: 'PTT',
    name: 'Peak',
  }];
  crmRows: Record<string, unknown>[] = [];
  sqls: string[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (sql.includes('FROM crm_cp_templates')) {
      return { rows: this.templates.filter((row) => !params[0] || row.id === params[0] || row.id === params[1]) };
    }
    if (sql.includes('FROM crm_cp_projects')) {
      return { rows: this.projects };
    }
    if (sql.includes('INSERT INTO crm_cp_batch_jobs')) {
      const row = {
        id: BATCH_ID,
        template_id: params[0],
        project_id: params[1],
        estimate_credits: params[2],
        status: 'draft',
        created_by: params[3],
      };
      this.batches.push(row);
      return { rows: [row] };
    }
    if (sql.includes('INSERT INTO crm_cp_batch_items')) {
      const row = {
        id: `item-${params[1]}`,
        batch_id: params[0],
        row_no: params[1],
        row_json: typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2],
        mapping_json: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        status: 'pending',
        error: null,
        job_id: null,
      };
      this.items.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_batch_items')) {
      const item = this.items.find((row) => (
        row.batch_id === params[params.length - 2] && Number(row.row_no) === Number(params[params.length - 1])
      )) ?? this.items.find((row) => row.id === params[0]);
      if (!item) return { rows: [] };
      if (sql.includes('status')) item.status = params[0];
      if (sql.includes('error')) item.error = params[1];
      if (sql.includes('job_id')) item.job_id = params[2] ?? item.job_id;
      return { rows: [item] };
    }
    if (sql.includes('UPDATE crm_cp_batch_jobs')) {
      const batch = this.batches[0];
      if (batch && sql.includes('estimate_credits')) batch.estimate_credits = params[0];
      if (batch && sql.includes('status')) batch.status = params[0];
      return { rows: batch ? [batch] : [] };
    }
    if (sql.includes('FROM crm_cp_batch_items')) {
      return { rows: this.items.filter((row) => !params[0] || row.batch_id === params[0]) };
    }
    if (sql.includes('FROM crm_cp_batch_jobs')) {
      return { rows: this.batches };
    }
    if (sql.includes('FROM clients') || sql.includes('FROM crm_service_lifecycle')) {
      return { rows: this.crmRows };
    }
    return { rows: [] };
  }
}

function makeService(
  db: BatchQuery,
  opts: {
    submit?: jest.Mock;
    upsertDraft?: jest.Mock;
    reserve?: jest.Mock;
  } = {},
) {
  const charges: string[] = [];
  const submit = opts.submit ?? jest.fn(async (_draftId: string, key: string) => {
    if (charges.includes(key)) return { job_id: `job-${key}`, idempotency_key: key, replayed: true };
    charges.push(key);
    return { id: `job-${key}`, job_id: `job-${key}`, idempotency_key: key };
  });
  const upsertDraft = opts.upsertDraft ?? jest.fn(async () => ({
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    project_id: PROJECT_ID,
    agency_client_id: CLIENT_ID,
    input_mode: 'template',
    config_json: { estimated_credits: 1 },
  }));
  return {
    service: new CpBatchesService(
      db,
      { upsertDraft } as never,
      { submit, retryJob: jest.fn(async (id: string) => ({ id, job_id: id })) } as never,
    ),
    submit,
    upsertDraft,
    charges,
  };
}

describe('CpBatchesService', () => {
  it('rejects more than 50 rows', async () => {
    const { service } = makeService(new BatchQuery());
    const rows = Array.from({ length: CP_BATCH_MAX_ROWS + 1 }, (_, i) => sampleRow(i + 1));

    await expect(
      service.create({ template_id: TEMPLATE_ID, project_id: PROJECT_ID, rows }, 9, SCOPE),
    ).rejects.toMatchObject({
      response: { error: 'batch_too_large' },
    });
  });

  it('validates a 48-row sample as 46 valid and 2 invalid and estimates 46 × unit', async () => {
    const db = new BatchQuery();
    const { service } = makeService(db);
    const rows = Array.from({ length: 48 }, (_, i) => {
      if (i === 1) return sampleRow(i + 1, 'price_from');
      if (i === 7) return sampleRow(i + 1, 'cta');
      return sampleRow(i + 1);
    });

    await service.create({
      template_id: TEMPLATE_ID,
      project_id: PROJECT_ID,
      rows,
      mapping: Object.fromEntries(REQUIRED.map((key) => [key, key])),
    }, 9, SCOPE);
    const validated = await service.validate(BATCH_ID, SCOPE);

    expect(validated.valid_count).toBe(46);
    expect(validated.invalid_count).toBe(2);
    expect(validated.estimate_credits).toBe(46);
    expect(db.items.filter((row) => row.status === 'invalid')).toHaveLength(2);
  });

  it('runs one render per valid row and does not double-charge a duplicate row key', async () => {
    const db = new BatchQuery();
    const { service, submit, charges } = makeService(db);
    const rows = [sampleRow(1), sampleRow(2)];

    await service.create({
      template_id: TEMPLATE_ID,
      project_id: PROJECT_ID,
      rows,
      mapping: Object.fromEntries(REQUIRED.map((key) => [key, key])),
    }, 9, SCOPE);
    await service.validate(BATCH_ID, SCOPE);
    await service.run(BATCH_ID, SCOPE);
    await service.run(BATCH_ID, SCOPE);

    expect(submit).toHaveBeenCalledWith(
      expect.any(String),
      `${BATCH_ID}:1`,
      SCOPE,
    );
    expect(submit).toHaveBeenCalledWith(
      expect.any(String),
      `${BATCH_ID}:2`,
      SCOPE,
    );
    expect(charges).toEqual([`${BATCH_ID}:1`, `${BATCH_ID}:2`]);
    expect(charges).toHaveLength(2);
  });

  it('retries one failed row without re-charging completed rows', async () => {
    const db = new BatchQuery();
    const { service, submit, charges } = makeService(db);
    await service.create({
      template_id: TEMPLATE_ID,
      project_id: PROJECT_ID,
      rows: [sampleRow(1), sampleRow(2)],
      mapping: Object.fromEntries(REQUIRED.map((key) => [key, key])),
    }, 9, SCOPE);
    await service.validate(BATCH_ID, SCOPE);
    await service.run(BATCH_ID, SCOPE);
    db.items[1].status = 'failed';
    db.items[1].error = 'render_failed';
    charges.splice(1, 1);

    await service.retryItem(BATCH_ID, 2, SCOPE);

    expect(db.items[0].status).toBe('completed');
    expect(submit.mock.calls.filter((call) => call[1] === `${BATCH_ID}:1`)).toHaveLength(1);
    expect(charges.filter((key) => key === `${BATCH_ID}:1`)).toHaveLength(1);
  });

  it('exports only invalid and failed rows as CSV', async () => {
    const db = new BatchQuery();
    const { service } = makeService(db);
    await service.create({
      template_id: TEMPLATE_ID,
      project_id: PROJECT_ID,
      rows: [sampleRow(1), sampleRow(2, 'hotline'), sampleRow(3)],
      mapping: Object.fromEntries(REQUIRED.map((key) => [key, key])),
    }, 9, SCOPE);
    await service.validate(BATCH_ID, SCOPE);
    db.items[2].status = 'failed';
    db.items[2].error = 'render_failed';

    const csv = await service.errorsCsv(BATCH_ID, SCOPE);
    expect(csv).toContain('row_no');
    expect(csv).toContain('2');
    expect(csv).toContain('3');
    expect(csv.split('\n').filter((line) => line.trim())).toHaveLength(3);
    expect(csv).not.toMatch(/(\n|,)1(\n|,)/);
  });

  it('rejects CRM source mapping that is not on the allowlist', async () => {
    const { service } = makeService(new BatchQuery());

    await expect(
      service.create({
        template_id: TEMPLATE_ID,
        project_id: PROJECT_ID,
        source: { type: 'crm', lifecycle_id: 7 },
        mapping: { project_name: 'leads.full_name' },
      }, 9, SCOPE),
    ).rejects.toMatchObject({
      response: { error: 'unknown_crm_column' },
    });
  });
});
