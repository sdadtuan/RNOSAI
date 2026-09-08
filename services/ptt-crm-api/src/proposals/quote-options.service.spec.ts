import { readFileSync } from 'fs';
import { join } from 'path';
import { QuoteOptionsService } from './quote-options.service';

const VID = '19d722af-0000-4000-8000-000000000021';
const ACTOR = { staffId: 7, staffAuthVia: 'jwt' as const };

class OptionsMemory {
  sqls: string[] = [];
  versions = new Map<string, Record<string, unknown>>([
    [VID, { id: VID, proposal_id: 9, n: 1, state: 'working' }],
  ]);
  options: Record<string, unknown>[] = [];
  nextId = 1;

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO clients/i.test(sql)) {
      throw new Error('must_not_insert_clients');
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      const id = String(params[0] ?? '');
      const row = this.versions.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/INSERT INTO crm_quote_options/i.test(sql)) {
      const row = {
        id: `opt-${this.nextId++}`,
        version_id: params[0],
        option_key: params[1],
        name: params[2],
        recommended: params[3] === true || params[3] === 't',
        client_visible: params[4] !== false && params[4] !== 'f',
        payable_vnd: Number(params[5] ?? 0),
      };
      this.options.push(row);
      return { rows: [row] };
    }
    if (/UPDATE crm_quote_options/i.test(sql)) {
      const versionId = String(params[0] ?? '');
      if (/option_key\s*<>/i.test(sql)) {
        const keepKey = String(params[1] ?? '');
        for (const opt of this.options) {
          if (String(opt.version_id) === versionId && String(opt.option_key) !== keepKey) {
            opt.recommended = false;
          }
        }
        return { rows: [] };
      }
      const target = this.options.find(
        (opt) => String(opt.version_id) === versionId && opt.option_key === params[1],
      );
      if (!target) return { rows: [] };
      target.name = params[2];
      target.recommended = params[3] === true || params[3] === 't';
      target.client_visible = params[4] !== false && params[4] !== 'f';
      return { rows: [target] };
    }
    if (/FROM crm_quote_options/i.test(sql)) {
      const versionId = String(params[0] ?? '');
      let rows = this.options.filter((opt) => String(opt.version_id) === versionId);
      if (params[1] != null && /option_key/i.test(sql)) {
        rows = rows.filter((opt) => String(opt.option_key) === String(params[1]));
      }
      return { rows };
    }
    return { rows: [] };
  }
}

function load(db = new OptionsMemory()) {
  return { db, svc: new QuoteOptionsService(db) };
}

describe('QuoteOptionsService', () => {
  it('setting a second recommended option flips the first off', async () => {
    const { db, svc } = load();

    await svc.create(VID, { name: 'Phương án A', recommended: true }, ACTOR);
    await svc.create(VID, { name: 'Phương án B' }, ACTOR);

    const out = await svc.patch(VID, 'B', { recommended: true }, ACTOR);

    expect(out.option.option_key).toBe('B');
    expect(out.option.recommended).toBe(true);
    const a = db.options.find((o) => o.option_key === 'A');
    const b = db.options.find((o) => o.option_key === 'B');
    expect(a?.recommended).toBe(false);
    expect(b?.recommended).toBe(true);
    expect(db.options.filter((o) => o.recommended === true)).toHaveLength(1);
  });

  it('create with recommended also flips the previous recommended option', async () => {
    const { db, svc } = load();

    await svc.create(VID, { name: 'Phương án A', recommended: true }, ACTOR);
    const out = await svc.create(VID, { name: 'Phương án B', recommended: true }, ACTOR);

    expect(out.option.option_key).toBe('B');
    expect(out.option.recommended).toBe(true);
    expect(db.options.find((o) => o.option_key === 'A')?.recommended).toBe(false);
    expect(db.options.filter((o) => o.recommended === true)).toHaveLength(1);
  });

  it('duplicate copies source onto the next free A/B/C key', async () => {
    const { svc } = load();

    await svc.create(VID, { name: 'Standard', payable_vnd: 108_000_000, client_visible: true }, ACTOR);
    const out = await svc.duplicate(VID, 'A', ACTOR);

    expect(out.option.option_key).toBe('B');
    expect(out.option.name).toBe('Standard');
    expect(out.option.payable_vnd).toBe(108_000_000);
    expect(out.option.recommended).toBe(false);
    expect(out.option.client_visible).toBe(true);
  });

  it('unknown version returns 404 version_not_found', async () => {
    const { svc } = load();

    await expect(
      svc.create('19d722af-0000-4000-8000-000000000099', { name: 'Ghost' }, ACTOR),
    ).rejects.toMatchObject({ response: { error: 'version_not_found' } });
  });

  it('rejects option keys outside A/B/C', async () => {
    const { svc } = load();

    await expect(svc.create(VID, { name: 'D', option_key: 'D' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'invalid_option_key' },
    });
    await expect(svc.patch(VID, 'D', { name: 'Nope' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'invalid_option_key' },
    });
  });

  it('create does not INSERT into clients', async () => {
    const { db, svc } = load();

    await svc.create(VID, { name: 'Phương án A', payable_vnd: 1 }, ACTOR);

    expect(db.sqls.some((sql) => /INSERT INTO clients/i.test(sql))).toBe(false);
    expect(db.sqls.some((sql) => /INSERT INTO crm_quote_options/i.test(sql))).toBe(true);
  });

  it('internal key may use staffId 0', async () => {
    const { svc } = load();

    const out = await svc.create(
      VID,
      { name: 'Internal option' },
      { staffId: 0, staffAuthVia: 'internal' },
    );

    expect(out.option.option_key).toBe('A');
    expect(out.option.name).toBe('Internal option');
  });
});

describe('quote option HTTP wiring', () => {
  it('wires A/B/C option routes on quote-versions with write guard', () => {
    const versions = readFileSync(join(__dirname, 'quote-versions.controller.ts'), 'utf8');
    const mod = readFileSync(join(__dirname, 'proposals.module.ts'), 'utf8');
    expect(versions).toMatch(/@Controller\('api\/crm\/quote-versions'\)/);
    expect(versions).toMatch(/@Post\(':vid\/options'\)/);
    expect(versions).toMatch(/@Post\(':vid\/options\/:key\/duplicate'\)/);
    expect(versions).toMatch(/@Patch\(':vid\/options\/:key'\)/);
    expect(versions).toMatch(/StaffProposalsWriteGuard|StaffQuoteGuard/);
    expect(versions).not.toMatch(/StaffAuthGuard/);
    expect(versions).not.toMatch(/\/api\/quotes/);
    expect(mod).toMatch(/QuoteOptionsService/);
  });
});
