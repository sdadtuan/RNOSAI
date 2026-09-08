import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import type { QuoteOptionKey } from './quote.types';

const OPTION_KEYS: QuoteOptionKey[] = ['A', 'B', 'C'];

export type QuoteOption = {
  id: string;
  version_id: string;
  option_key: QuoteOptionKey;
  name: string;
  recommended: boolean;
  client_visible: boolean;
  payable_vnd: number;
};

export type QuoteOptionCreateInput = {
  option_key?: string;
  name?: string;
  recommended?: boolean;
  client_visible?: boolean;
  payable_vnd?: number | bigint;
};

export type QuoteOptionPatchInput = {
  recommended?: boolean;
  client_visible?: boolean;
  name?: string;
};

export type QuoteOptionActor = {
  staffId: number;
  staffAuthVia?: 'internal' | 'jwt';
};

export type QuoteOptionResult = {
  option: QuoteOption;
  options: QuoteOption[];
};

function bad(error: string): never {
  throw new BadRequestException({ error });
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function asOptionKey(value: unknown): QuoteOptionKey | null {
  const key = String(value ?? '').trim().toUpperCase();
  if (key === 'A' || key === 'B' || key === 'C') return key;
  return null;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (value === false || value === 'f' || value === 'false') return false;
  if (value === true || value === 't' || value === 'true') return true;
  return fallback;
}

function asPayableVnd(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) bad('invalid_payable_vnd');
  return n;
}

function mapOption(row: Record<string, unknown>): QuoteOption {
  const key = asOptionKey(row.option_key);
  if (!key) bad('invalid_option_key');
  return {
    id: String(row.id ?? ''),
    version_id: String(row.version_id ?? ''),
    option_key: key,
    name: String(row.name ?? ''),
    recommended: row.recommended !== false && row.recommended !== 'f',
    client_visible: row.client_visible !== false && row.client_visible !== 'f',
    payable_vnd: asPayableVnd(row.payable_vnd, 0),
  };
}

@Injectable()
export class QuoteOptionsService {
  constructor(@Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort) {}

  async create(
    vid: string,
    input: QuoteOptionCreateInput,
    actor: QuoteOptionActor,
  ): Promise<QuoteOptionResult> {
    this.assertStaff(actor);
    return this.inTx(async (query) => {
      await this.requireVersion(vid, query);
      const existing = await this.listOptions(vid, query);
      const requested =
        input.option_key != null && String(input.option_key).trim() !== ''
          ? asOptionKey(input.option_key)
          : this.nextKey(existing);
      if (input.option_key != null && String(input.option_key).trim() !== '' && !requested) {
        bad('invalid_option_key');
      }
      if (!requested) bad('option_slots_full');
      if (existing.some((row) => row.option_key === requested)) bad('option_key_taken');
      const name = String(input.name ?? '').trim();
      if (!name) bad('name_required');
      const recommended = asBool(input.recommended, false);
      if (recommended) await this.clearOtherRecommended(vid, requested, query);
      const inserted = await this.insertOption(
        query,
        [
          vid,
          requested,
          name,
          recommended,
          asBool(input.client_visible, true),
          asPayableVnd(input.payable_vnd, 0),
        ],
      );
      if (recommended) await this.clearOtherRecommended(vid, requested, query);
      const option = mapOption(inserted.rows[0] ?? { option_key: requested, name });
      return { option, options: await this.listOptions(vid, query) };
    });
  }

  async duplicate(vid: string, key: string, actor: QuoteOptionActor): Promise<QuoteOptionResult> {
    this.assertStaff(actor);
    const sourceKey = asOptionKey(key);
    if (!sourceKey) bad('invalid_option_key');
    return this.inTx(async (query) => {
      await this.requireVersion(vid, query);
      const existing = await this.listOptions(vid, query);
      const source = existing.find((row) => row.option_key === sourceKey);
      if (!source) throw new NotFoundException({ error: 'option_not_found' });
      const next = this.nextKey(existing);
      if (!next) bad('option_slots_full');
      const inserted = await this.insertOption(query, [
        vid,
        next,
        source.name,
        false,
        source.client_visible,
        source.payable_vnd,
      ]);
      const option = mapOption(inserted.rows[0] ?? { option_key: next, name: source.name });
      return { option, options: await this.listOptions(vid, query) };
    });
  }

  async patch(
    vid: string,
    key: string,
    input: QuoteOptionPatchInput,
    actor: QuoteOptionActor,
  ): Promise<QuoteOptionResult> {
    this.assertStaff(actor);
    const optionKey = asOptionKey(key);
    if (!optionKey) bad('invalid_option_key');
    return this.inTx(async (query) => {
      await this.requireVersion(vid, query);
      const current = await this.getOption(vid, optionKey, query);
      if (!current) throw new NotFoundException({ error: 'option_not_found' });
      const name = input.name !== undefined ? String(input.name).trim() : current.name;
      if (!name) bad('name_required');
      const recommended =
        input.recommended !== undefined
          ? asBool(input.recommended, current.recommended)
          : current.recommended;
      const clientVisible =
        input.client_visible !== undefined
          ? asBool(input.client_visible, current.client_visible)
          : current.client_visible;
      if (recommended) await this.clearOtherRecommended(vid, optionKey, query);
      const updated = await query(
        `UPDATE crm_quote_options
            SET name = $3,
                recommended = $4,
                client_visible = $5
          WHERE version_id::text = $1
            AND option_key = $2
          RETURNING id, version_id, option_key, name, recommended, client_visible, payable_vnd`,
        [vid, optionKey, name, recommended, clientVisible],
      );
      if (recommended) await this.clearOtherRecommended(vid, optionKey, query);
      const option = mapOption(updated.rows[0] ?? current);
      return { option, options: await this.listOptions(vid, query) };
    });
  }

  private nextKey(existing: QuoteOption[]): QuoteOptionKey | null {
    const used = new Set(existing.map((row) => row.option_key));
    return OPTION_KEYS.find((key) => !used.has(key)) ?? null;
  }

  private assertStaff(actor: QuoteOptionActor): void {
    if (actor.staffAuthVia === 'internal') return;
    if (!(Number(actor.staffId ?? 0) > 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
  }

  private inTx<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) return this.db.withTransaction(fn);
    return fn((sql, params) => this.db.query(sql, params));
  }

  private async insertOption(
    query: QuoteQueryFn,
    params: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }> {
    try {
      return await query(
        `INSERT INTO crm_quote_options (version_id, option_key, name, recommended, client_visible, payable_vnd)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, version_id, option_key, name, recommended, client_visible, payable_vnd`,
        params,
      );
    } catch (err) {
      if (isUniqueViolation(err)) bad('option_key_taken');
      throw err;
    }
  }

  private async requireVersion(vid: string, query: QuoteQueryFn): Promise<void> {
    const result = await query(`SELECT id FROM crm_quote_versions WHERE id::text = $1 LIMIT 1`, [
      vid,
    ]);
    if (!result.rows[0]) throw new NotFoundException({ error: 'version_not_found' });
  }

  private async listOptions(vid: string, query: QuoteQueryFn): Promise<QuoteOption[]> {
    const result = await query(
      `SELECT id, version_id, option_key, name, recommended, client_visible, payable_vnd
         FROM crm_quote_options
        WHERE version_id::text = $1
        ORDER BY option_key`,
      [vid],
    );
    return result.rows.map(mapOption);
  }

  private async getOption(
    vid: string,
    key: QuoteOptionKey,
    query: QuoteQueryFn,
  ): Promise<QuoteOption | null> {
    const result = await query(
      `SELECT id, version_id, option_key, name, recommended, client_visible, payable_vnd
         FROM crm_quote_options
        WHERE version_id::text = $1
          AND option_key = $2
        LIMIT 1`,
      [vid, key],
    );
    return result.rows[0] ? mapOption(result.rows[0]) : null;
  }

  private async clearOtherRecommended(
    vid: string,
    keepKey: QuoteOptionKey,
    query: QuoteQueryFn,
  ): Promise<void> {
    await query(
      `UPDATE crm_quote_options
          SET recommended = FALSE
        WHERE version_id::text = $1
          AND option_key <> $2
          AND recommended IS TRUE`,
      [vid, keepKey],
    );
  }
}
