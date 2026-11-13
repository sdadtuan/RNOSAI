import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { createAppPgPool, shouldEndLocalPool } from '../../config/pg-pool.factory';
import { AppConfigService } from '../../config/app-config.service';
import { ensurePortalCrmLocalSchema } from '../portal-crm-local-ddl.util';
import { parseProductSpec } from '../portal-product.util';
import { computeOrderTotals, normalizeVnPhone } from './portal-pos-pricing.util';
import { applyStockMovement, availableStock, isLowStock } from './portal-pos-stock.util';
import { csvBool, csvMoney, parseCsv } from './portal-pos-csv.util';
import type { CarrierId, OrderSource, OrderStatus, StockKind } from './portal-pos.types';
import { canTransition, customerRisk, isOrderStatus, stockActionForTransition } from './portal-pos-status.util';
import { decryptCarrierToken, encryptCarrierToken, redactAccount } from './portal-pos-secret.util';

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}
function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function int(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
function str(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}
function jsonVal(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export type ProductInput = {
  page_id?: string;
  name: string;
  detail?: string;
  sku?: string;
  barcode?: string;
  category_id?: string | null;
  category_name?: string;
  image_url?: string;
  price_vnd?: number | null;
  compare_at_vnd?: number | null;
  cost_vnd?: number | null;
  weight_gram?: number | null;
  is_combo?: boolean;
  low_stock_threshold?: number;
  active?: boolean;
  variants?: VariantInput[];
  combo_items?: Array<{ variant_id: string; quantity: number }>;
};

export type VariantInput = {
  id?: string;
  sku?: string;
  barcode?: string;
  color?: string;
  size?: string;
  attrs?: Record<string, unknown>;
  price_vnd?: number | null;
  compare_at_vnd?: number | null;
  cost_vnd?: number | null;
  weight_gram?: number | null;
  image_url?: string;
  active?: boolean;
  stock?: number;
};

export type OrderItemInput = {
  product_id?: string;
  variant_id?: string;
  name?: string;
  sku?: string;
  color?: string;
  size?: string;
  qty: number;
  price_vnd: number;
  cost_vnd?: number;
  image_url?: string;
  weight_gram?: number;
};

export type OrderInput = {
  page_id?: string;
  case_id?: string;
  comment_id?: string;
  source?: OrderSource | string;
  customer_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  discount_vnd?: number;
  shipping_fee_vnd?: number;
  deposit_vnd?: number;
  notes?: string;
  customer_notes?: string;
  ad_id?: string;
  post_id?: string;
  items: OrderItemInput[];
  assignee_user_id?: string | null;
  assignee_email?: string;
};

@Injectable()
export class PortalPosRepository implements OnModuleDestroy {
  private readonly log = new Logger(PortalPosRepository.name);
  private pool: Pool | null = null;
  constructor(private readonly config: AppConfigService) {}
  private get db(): Pool {
    if (!this.pool) this.pool = createAppPgPool(this.config.databaseUrl);
    return this.pool;
  }
  onModuleDestroy(): void {
    if (shouldEndLocalPool()) void this.pool?.end();
    this.pool = null;
  }
  async ensure(): Promise<void> {
    await ensurePortalCrmLocalSchema(this.db, this.log, PortalPosRepository.name);
  }

  async ensureWarehouse(clientId: string): Promise<{ id: string; name: string; low_stock_threshold: number }> {
    await this.ensure();
    const existing = await this.db.query(
      `SELECT id, name, low_stock_threshold FROM portal_pos_warehouses WHERE client_id = $1 ORDER BY is_default DESC, created_at LIMIT 1`,
      [clientId],
    );
    if (existing.rows[0]) {
      return { id: String(existing.rows[0].id), name: String(existing.rows[0].name), low_stock_threshold: int(existing.rows[0].low_stock_threshold, 5) };
    }
    const inserted = await this.db.query(
      `INSERT INTO portal_pos_warehouses (client_id, name, is_default) VALUES ($1, 'Kho mặc định', TRUE) RETURNING id, name, low_stock_threshold`,
      [clientId],
    );
    return { id: String(inserted.rows[0].id), name: String(inserted.rows[0].name), low_stock_threshold: int(inserted.rows[0].low_stock_threshold, 5) };
  }

  async migrateLegacyProducts(clientId: string): Promise<number> {
    const warehouse = await this.ensureWarehouse(clientId);
    const missing = await this.db.query(
      `SELECT p.id, p.name, p.sku, p.image_url, p.spec, p.cost_vnd, p.compare_at_vnd, p.weight_gram
         FROM portal_page_products p
        WHERE p.client_id = $1 AND NOT EXISTS (SELECT 1 FROM portal_pos_variants v WHERE v.product_id = p.id)`,
      [clientId],
    );
    let count = 0;
    for (const row of missing.rows) {
      const spec = parseProductSpec(row.spec);
      const colors = spec.colors.length ? spec.colors : [{ name: '', image: String(row.image_url ?? '') }];
      const sizes = spec.sizes.length ? spec.sizes : [''];
      for (const color of colors) {
        for (const size of sizes) {
          await this.db.query(
            `INSERT INTO portal_pos_variants
               (id, client_id, product_id, sku, color, size, price_vnd, compare_at_vnd, cost_vnd, weight_gram, image_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (client_id, product_id, color, size) DO NOTHING`,
            [randomUUID(), clientId, row.id, str(row.sku), str(color.name, 40), str(size, 40), spec.price_vnd, row.compare_at_vnd, row.cost_vnd, row.weight_gram, str(color.image || row.image_url, 500)],
          );
          await this.db.query(
            `INSERT INTO portal_pos_stock (warehouse_id, variant_id, on_hand, reserved)
             SELECT $1, v.id, 0, 0 FROM portal_pos_variants v
              WHERE v.client_id = $2 AND v.product_id = $3 AND v.color = $4 AND v.size = $5
             ON CONFLICT (warehouse_id, variant_id) DO NOTHING`,
            [warehouse.id, clientId, row.id, str(color.name, 40), str(size, 40)],
          );
          count += 1;
        }
      }
    }
    return count;
  }

  async listCategories(clientId: string) {
    await this.ensure();
    const res = await this.db.query(
      `SELECT id, name, parent_id, sort_order FROM portal_pos_categories WHERE client_id = $1 ORDER BY sort_order, name`,
      [clientId],
    );
    return res.rows.map((row) => ({ id: String(row.id), name: String(row.name), parent_id: row.parent_id ? String(row.parent_id) : null, sort_order: int(row.sort_order) }));
  }

  async upsertCategory(clientId: string, name: string, id?: string, sortOrder = 0) {
    const clean = str(name, 80);
    if (!clean) throw new Error('category_name_required');
    if (id) {
      await this.db.query(`UPDATE portal_pos_categories SET name = $3, sort_order = $4 WHERE id = $1 AND client_id = $2`, [id, clientId, clean, sortOrder]);
      return { id, name: clean };
    }
    const res = await this.db.query(
      `INSERT INTO portal_pos_categories (client_id, name, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (client_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order RETURNING id, name`,
      [clientId, clean, sortOrder],
    );
    return { id: String(res.rows[0].id), name: String(res.rows[0].name) };
  }

  async deleteCategory(clientId: string, id: string) {
    await this.db.query(`UPDATE portal_page_products SET category_id = NULL WHERE client_id = $1 AND category_id = $2`, [clientId, id]);
    await this.db.query(`DELETE FROM portal_pos_categories WHERE client_id = $1 AND id = $2`, [clientId, id]);
  }

  async resolveCategory(clientId: string, id?: string | null, name?: string): Promise<string | null> {
    if (id) return id;
    const clean = str(name, 80);
    if (!clean) return null;
    return (await this.upsertCategory(clientId, clean)).id;
  }

  async listProducts(clientId: string, query: { q?: string; category_id?: string; active?: string; page_id?: string; low_stock?: string } = {}) {
    const warehouse = await this.ensureWarehouse(clientId);
    await this.migrateLegacyProducts(clientId);
    const params: unknown[] = [clientId, warehouse.id];
    const where = ['p.client_id = $1'];
    if (query.q?.trim()) {
      params.push(`%${query.q.trim().slice(0, 80)}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length} OR EXISTS (SELECT 1 FROM portal_pos_variants v WHERE v.product_id = p.id AND (v.sku ILIKE $${params.length} OR v.barcode ILIKE $${params.length})))`);
    }
    if (query.category_id) { params.push(query.category_id); where.push(`p.category_id = $${params.length}`); }
    if (query.page_id) { params.push(query.page_id); where.push(`p.page_id = $${params.length}`); }
    if (query.active === '1') where.push('p.active = TRUE');
    if (query.active === '0') where.push('p.active = FALSE');
    const res = await this.db.query(
      `SELECT p.*, c.name AS category_name,
              COALESCE((
                SELECT json_agg(jsonb_build_object(
                  'id', v.id, 'sku', v.sku, 'barcode', v.barcode, 'color', v.color, 'size', v.size,
                  'attrs', v.attrs, 'price_vnd', v.price_vnd, 'compare_at_vnd', v.compare_at_vnd,
                  'cost_vnd', v.cost_vnd, 'weight_gram', v.weight_gram, 'image_url', v.image_url,
                  'active', v.active, 'on_hand', COALESCE(s.on_hand, 0), 'reserved', COALESCE(s.reserved, 0)
                ) ORDER BY v.color, v.size)
                FROM portal_pos_variants v
                LEFT JOIN portal_pos_stock s ON s.variant_id = v.id AND s.warehouse_id = $2
                WHERE v.product_id = p.id
              ), '[]'::json) AS variants
         FROM portal_page_products p
         LEFT JOIN portal_pos_categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC`,
      params,
    );
    const products = res.rows.map((row) => this.mapProduct(row, warehouse.low_stock_threshold));
    if (query.low_stock === '1') return products.filter((p) => p.low_stock);
    return products;
  }

  async getProduct(clientId: string, id: string) {
    const list = await this.listProducts(clientId);
    return list.find((p) => p.id === id) ?? null;
  }

  private mapProduct(row: Record<string, unknown>, warehouseThreshold: number) {
    const variantsRaw = jsonVal(row.variants);
    const threshold = int(row.low_stock_threshold, warehouseThreshold);
    const variants = Array.isArray(variantsRaw)
      ? variantsRaw.map((item) => {
          const v = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const on_hand = int(v.on_hand);
          const reserved = int(v.reserved);
          return {
            id: String(v.id), sku: str(v.sku, 80), barcode: str(v.barcode, 80),
            color: str(v.color, 40), size: str(v.size, 40),
            attrs: v.attrs && typeof v.attrs === 'object' ? v.attrs : {},
            price_vnd: v.price_vnd == null ? null : money(v.price_vnd),
            compare_at_vnd: v.compare_at_vnd == null ? null : money(v.compare_at_vnd),
            cost_vnd: v.cost_vnd == null ? null : money(v.cost_vnd),
            weight_gram: v.weight_gram == null ? null : int(v.weight_gram),
            image_url: str(v.image_url, 500), active: v.active !== false,
            on_hand, reserved, available: availableStock({ on_hand, reserved }),
            low_stock: isLowStock({ on_hand, reserved }, threshold),
          };
        })
      : [];
    const available = variants.reduce((s, v) => s + v.available, 0);
    const on_hand = variants.reduce((s, v) => s + v.on_hand, 0);
    const reserved = variants.reduce((s, v) => s + v.reserved, 0);
    const spec = parseProductSpec(row.spec);
    return {
      id: String(row.id), client_id: String(row.client_id), page_id: str(row.page_id, 64),
      name: str(row.name, 200), detail: str(row.detail, 4000), image_url: str(row.image_url, 500),
      sku: str(row.sku, 80), barcode: str(row.barcode, 80),
      category_id: row.category_id ? String(row.category_id) : null,
      category_name: row.category_name ? str(row.category_name, 80) : '',
      price_vnd: money((row as { price_vnd?: unknown }).price_vnd ?? spec.price_vnd),
      compare_at_vnd: row.compare_at_vnd == null ? null : money(row.compare_at_vnd),
      cost_vnd: row.cost_vnd == null ? null : money(row.cost_vnd),
      weight_gram: row.weight_gram == null ? null : int(row.weight_gram),
      is_combo: row.is_combo === true, low_stock_threshold: threshold, active: row.active !== false,
      on_hand, reserved, available, low_stock: variants.some((v) => v.active && v.low_stock),
      variants, spec, created_at: iso(row.created_at),
    };
  }

  private syncSpec(input: ProductInput, variants: VariantInput[]) {
    const colors: Array<{ name: string; image: string }> = [];
    const sizes: string[] = [];
    for (const v of variants) {
      const color = str(v.color, 40);
      const image = str(v.image_url || input.image_url, 500);
      if (color && !colors.some((c) => c.name === color)) colors.push({ name: color, image });
      const size = str(v.size, 40);
      if (size && !sizes.includes(size)) sizes.push(size);
    }
    const price = input.price_vnd ?? variants.find((v) => v.price_vnd)?.price_vnd ?? null;
    return { price_vnd: price && price > 0 ? Math.round(price) : null, colors, sizes, options: [] as Array<{ name: string; values: string[] }> };
  }

  async createProduct(clientId: string, input: ProductInput, actor = '') {
    const warehouse = await this.ensureWarehouse(clientId);
    const categoryId = await this.resolveCategory(clientId, input.category_id, input.category_name);
    const variants = input.variants?.length ? input.variants : [{
      color: '', size: '', price_vnd: input.price_vnd, sku: input.sku, barcode: input.barcode,
      image_url: input.image_url, stock: 0, weight_gram: input.weight_gram, cost_vnd: input.cost_vnd,
      compare_at_vnd: input.compare_at_vnd,
    }];
    const spec = this.syncSpec(input, variants);
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO portal_page_products
         (id, client_id, page_id, name, image_url, detail, spec, active, sku, barcode, category_id,
          compare_at_vnd, cost_vnd, weight_gram, is_combo, low_stock_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, clientId, str(input.page_id, 64), str(input.name, 200), str(input.image_url || variants[0]?.image_url, 500),
       str(input.detail, 4000), JSON.stringify(spec), input.active !== false, str(input.sku, 80), str(input.barcode, 80),
       categoryId, input.compare_at_vnd ?? null, input.cost_vnd ?? null, input.weight_gram ?? null,
       Boolean(input.is_combo), input.low_stock_threshold ?? 5],
    );
    for (const v of variants) {
      await this.insertVariant(clientId, id, warehouse.id, v, actor, 'product_create', id);
    }
    if (input.is_combo && input.combo_items?.length) {
      for (const item of input.combo_items) {
        await this.db.query(
          `INSERT INTO portal_pos_combo_items (combo_product_id, variant_id, quantity) VALUES ($1,$2,$3)
           ON CONFLICT (combo_product_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [id, item.variant_id, Math.max(1, int(item.quantity, 1))],
        );
      }
    }
    return this.getProduct(clientId, id);
  }

  async updateProduct(clientId: string, id: string, input: ProductInput, actor = '') {
    const current = await this.getProduct(clientId, id);
    if (!current) return null;
    const warehouse = await this.ensureWarehouse(clientId);
    const categoryId = input.category_id === null ? null : await this.resolveCategory(clientId, input.category_id, input.category_name);
    const variants: VariantInput[] = (input.variants ?? current.variants) as VariantInput[];
    const spec = this.syncSpec({ ...input, name: input.name || current.name, image_url: input.image_url ?? current.image_url, price_vnd: input.price_vnd ?? current.price_vnd }, variants);
    await this.db.query(
      `UPDATE portal_page_products SET
         name = COALESCE(NULLIF($3,''), name), detail = COALESCE($4, detail),
         image_url = COALESCE(NULLIF($5,''), image_url), sku = COALESCE($6, sku), barcode = COALESCE($7, barcode),
         category_id = $8, compare_at_vnd = COALESCE($9, compare_at_vnd), cost_vnd = COALESCE($10, cost_vnd),
         weight_gram = COALESCE($11, weight_gram), is_combo = COALESCE($12, is_combo),
         low_stock_threshold = COALESCE($13, low_stock_threshold), active = COALESCE($14, active),
         page_id = COALESCE(NULLIF($15,''), page_id), spec = $16::jsonb
       WHERE id = $1 AND client_id = $2`,
      [id, clientId, str(input.name, 200), input.detail != null ? str(input.detail, 4000) : null,
       str(input.image_url, 500), input.sku != null ? str(input.sku, 80) : null,
       input.barcode != null ? str(input.barcode, 80) : null,
       categoryId !== undefined ? categoryId : current.category_id,
       input.compare_at_vnd ?? null, input.cost_vnd ?? null, input.weight_gram ?? null,
       input.is_combo ?? null, input.low_stock_threshold ?? null, input.active ?? null,
       str(input.page_id, 64), JSON.stringify(spec)],
    );
    if (input.variants) {
      const keep: string[] = [];
      for (const v of input.variants) keep.push(await this.upsertVariantRow(clientId, id, warehouse.id, v, actor));
      if (keep.length) {
        await this.db.query(
          `DELETE FROM portal_pos_variants WHERE product_id = $1 AND client_id = $2 AND NOT (id = ANY($3::uuid[]))`,
          [id, clientId, keep],
        );
      }
    }
    return this.getProduct(clientId, id);
  }

  private async insertVariant(clientId: string, productId: string, warehouseId: string, v: VariantInput, actor: string, refType: string, refId: string): Promise<string> {
    const id = v.id || randomUUID();
    await this.db.query(
      `INSERT INTO portal_pos_variants
         (id, client_id, product_id, sku, barcode, color, size, attrs, price_vnd, compare_at_vnd, cost_vnd, weight_gram, image_url, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (client_id, product_id, color, size) DO UPDATE SET
         sku = EXCLUDED.sku, barcode = EXCLUDED.barcode, price_vnd = EXCLUDED.price_vnd,
         compare_at_vnd = EXCLUDED.compare_at_vnd, cost_vnd = EXCLUDED.cost_vnd,
         weight_gram = EXCLUDED.weight_gram, image_url = EXCLUDED.image_url, active = EXCLUDED.active, updated_at = now()`,
      [id, clientId, productId, str(v.sku, 80), str(v.barcode, 80), str(v.color, 40), str(v.size, 40),
       JSON.stringify(v.attrs ?? {}), v.price_vnd ?? null, v.compare_at_vnd ?? null, v.cost_vnd ?? null,
       v.weight_gram ?? null, str(v.image_url, 500), v.active !== false],
    );
    const row = await this.db.query(
      `SELECT id FROM portal_pos_variants WHERE client_id = $1 AND product_id = $2 AND color = $3 AND size = $4`,
      [clientId, productId, str(v.color, 40), str(v.size, 40)],
    );
    const variantId = String(row.rows[0].id);
    await this.db.query(
      `INSERT INTO portal_pos_stock (warehouse_id, variant_id, on_hand, reserved) VALUES ($1,$2,0,0) ON CONFLICT (warehouse_id, variant_id) DO NOTHING`,
      [warehouseId, variantId],
    );
    if (v.stock != null && Number(v.stock) > 0) {
      await this.moveStock(clientId, warehouseId, variantId, 'import', int(v.stock), refType, refId, 'Tồn ban đầu', actor);
    }
    return variantId;
  }

  private async upsertVariantRow(clientId: string, productId: string, warehouseId: string, v: VariantInput, actor: string): Promise<string> {
    if (v.id) {
      await this.db.query(
        `UPDATE portal_pos_variants SET
           sku = COALESCE($3, sku), barcode = COALESCE($4, barcode), color = COALESCE($5, color), size = COALESCE($6, size),
           price_vnd = COALESCE($7, price_vnd), compare_at_vnd = COALESCE($8, compare_at_vnd),
           cost_vnd = COALESCE($9, cost_vnd), weight_gram = COALESCE($10, weight_gram),
           image_url = COALESCE(NULLIF($11,''), image_url), active = COALESCE($12, active), updated_at = now()
         WHERE id = $1 AND client_id = $2`,
        [v.id, clientId, v.sku != null ? str(v.sku, 80) : null, v.barcode != null ? str(v.barcode, 80) : null,
         v.color != null ? str(v.color, 40) : null, v.size != null ? str(v.size, 40) : null,
         v.price_vnd ?? null, v.compare_at_vnd ?? null, v.cost_vnd ?? null, v.weight_gram ?? null,
         str(v.image_url, 500), v.active ?? null],
      );
      if (v.stock != null) {
        await this.moveStock(clientId, warehouseId, v.id, 'adjust', int(v.stock), 'product_edit', productId, 'Điều chỉnh tồn', actor);
      }
      return v.id;
    }
    return this.insertVariant(clientId, productId, warehouseId, v, actor, 'product_edit', productId);
  }

  async setProductActive(clientId: string, id: string, active: boolean) {
    await this.db.query(`UPDATE portal_page_products SET active = $3 WHERE id = $1 AND client_id = $2`, [id, clientId, active]);
  }

  async importProductsCsv(clientId: string, pageId: string, csvText: string, actor: string) {
    const { rows } = parseCsv(csvText);
    const created: string[] = [];
    const errors: Array<{ line: number; error: string }> = [];
    type Group = { meta: ProductInput; variants: VariantInput[] };
    const byKey = new Map<string, Group>();
    rows.forEach((row, i) => {
      const name = str(row.name, 200);
      if (!name) { errors.push({ line: i + 2, error: 'Thiếu tên sản phẩm' }); return; }
      const key = str(row.sku, 80) || name.toLowerCase();
      const variant: VariantInput = {
        sku: str(row.sku, 80), barcode: str(row.barcode, 80), color: str(row.color, 40), size: str(row.size, 40),
        price_vnd: csvMoney(row.price) || null, compare_at_vnd: csvMoney(row.compare_at) || null,
        cost_vnd: csvMoney(row.cost) || null, weight_gram: csvMoney(row.weight_gram) || null,
        image_url: str(row.image_url, 500), stock: csvMoney(row.stock), active: csvBool(row.active, true),
      };
      if (!byKey.has(key)) {
        byKey.set(key, { meta: {
          page_id: pageId, name, detail: str(row.detail, 4000), sku: str(row.sku, 80), barcode: str(row.barcode, 80),
          category_name: str(row.category, 80), image_url: str(row.image_url, 500), price_vnd: variant.price_vnd,
          compare_at_vnd: variant.compare_at_vnd, cost_vnd: variant.cost_vnd, weight_gram: variant.weight_gram, active: variant.active,
        }, variants: [] });
      }
      byKey.get(key)!.variants.push(variant);
    });
    for (const group of byKey.values()) {
      try {
        const product = await this.createProduct(clientId, { ...group.meta, variants: group.variants }, actor);
        if (product) created.push(product.id);
      } catch (err) {
        errors.push({ line: 0, error: err instanceof Error ? err.message : 'import_failed' });
      }
    }
    return { imported: created.length, product_ids: created, errors };
  }

  async moveStock(clientId: string, warehouseId: string, variantId: string, kind: StockKind, qty: number, refType = '', refId = '', note = '', actor = '', client?: PoolClient) {
    const db = client ?? this.db;
    const locked = await db.query(
      `SELECT on_hand, reserved FROM portal_pos_stock WHERE warehouse_id = $1 AND variant_id = $2 FOR UPDATE`,
      [warehouseId, variantId],
    );
    let state = locked.rows[0]
      ? { on_hand: int(locked.rows[0].on_hand), reserved: int(locked.rows[0].reserved) }
      : { on_hand: 0, reserved: 0 };
    if (!locked.rows[0]) {
      await db.query(
        `INSERT INTO portal_pos_stock (warehouse_id, variant_id, on_hand, reserved) VALUES ($1,$2,0,0) ON CONFLICT (warehouse_id, variant_id) DO NOTHING`,
        [warehouseId, variantId],
      );
    }
    state = applyStockMovement(state, kind, qty);
    await db.query(
      `INSERT INTO portal_pos_stock (warehouse_id, variant_id, on_hand, reserved, updated_at) VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (warehouse_id, variant_id) DO UPDATE SET on_hand = $3, reserved = $4, updated_at = now()`,
      [warehouseId, variantId, state.on_hand, state.reserved],
    );
    await db.query(
      `INSERT INTO portal_pos_stock_ledger
         (client_id, warehouse_id, variant_id, kind, qty, on_hand_after, reserved_after, ref_type, ref_id, note, actor_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [clientId, warehouseId, variantId, kind, qty, state.on_hand, state.reserved, refType, refId, str(note, 400), str(actor, 200)],
    );
    return state;
  }

  async listLedger(clientId: string, variantId?: string, limit = 50) {
    await this.ensure();
    const params: unknown[] = [clientId];
    let sql = `SELECT l.*, v.sku, v.color, v.size, p.name AS product_name
                 FROM portal_pos_stock_ledger l
                 JOIN portal_pos_variants v ON v.id = l.variant_id
                 JOIN portal_page_products p ON p.id = v.product_id
                WHERE l.client_id = $1`;
    if (variantId) { params.push(variantId); sql += ` AND l.variant_id = $${params.length}`; }
    params.push(Math.min(200, Math.max(1, limit)));
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length}`;
    const res = await this.db.query(sql, params);
    return res.rows.map((row) => ({
      id: String(row.id), kind: String(row.kind), qty: int(row.qty),
      on_hand_after: int(row.on_hand_after), reserved_after: int(row.reserved_after),
      ref_type: str(row.ref_type, 40), ref_id: str(row.ref_id, 64), note: str(row.note, 400),
      actor_email: str(row.actor_email, 200), sku: str(row.sku, 80), color: str(row.color, 40),
      size: str(row.size, 40), product_name: str(row.product_name, 200), created_at: iso(row.created_at),
    }));
  }

  async nextOrderCode(clientId: string, client?: PoolClient): Promise<string> {
    const db = client ?? this.db;
    const res = await db.query(
      `INSERT INTO portal_pos_code_seq (client_id, last_value) VALUES ($1, 1)
       ON CONFLICT (client_id) DO UPDATE SET last_value = portal_pos_code_seq.last_value + 1
       RETURNING last_value`,
      [clientId],
    );
    return `DH-${String(int(res.rows[0].last_value, 1)).padStart(6, '0')}`;
  }

  async upsertPosCustomer(
    clientId: string,
    input: { phone: string; name?: string; email?: string; address?: string; province?: string; district?: string; ward?: string },
    client?: PoolClient,
  ) {
    const db = client ?? this.db;
    const phone = normalizeVnPhone(input.phone);
    if (!phone) return null;
    const res = await db.query(
      `INSERT INTO portal_pos_customers (client_id, phone, name, email, address, province, district, ward)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (client_id, phone) DO UPDATE SET
         name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE portal_pos_customers.name END,
         email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE portal_pos_customers.email END,
         address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE portal_pos_customers.address END,
         province = CASE WHEN EXCLUDED.province <> '' THEN EXCLUDED.province ELSE portal_pos_customers.province END,
         district = CASE WHEN EXCLUDED.district <> '' THEN EXCLUDED.district ELSE portal_pos_customers.district END,
         ward = CASE WHEN EXCLUDED.ward <> '' THEN EXCLUDED.ward ELSE portal_pos_customers.ward END,
         updated_at = now()
       RETURNING *`,
      [clientId, phone, str(input.name, 200), str(input.email, 200), str(input.address, 500),
       str(input.province, 80), str(input.district, 80), str(input.ward, 80)],
    );
    return this.mapCustomer(res.rows[0]);
  }

  private mapCustomer(row: Record<string, unknown>) {
    return {
      id: String(row.id), phone: str(row.phone, 20), name: str(row.name, 200), email: str(row.email, 200),
      address: str(row.address, 500), province: str(row.province, 80), district: str(row.district, 80),
      ward: str(row.ward, 80), notes: str(row.notes, 2000), blacklist: row.blacklist === true,
      created_at: iso(row.created_at), updated_at: iso(row.updated_at),
    };
  }

  async createOrder(clientId: string, input: OrderInput, actorEmail = '', actorId = '') {
    await this.ensure();
    const warehouse = await this.ensureWarehouse(clientId);
    if (!input.items?.length) throw new Error('items_required');
    const totals = computeOrderTotals({
      items: input.items, discount_vnd: input.discount_vnd,
      shipping_fee_vnd: input.shipping_fee_vnd, deposit_vnd: input.deposit_vnd,
    });
    const cx = await this.db.connect();
    try {
      await cx.query('BEGIN');
      const code = await this.nextOrderCode(clientId, cx);
      const customer = await this.upsertPosCustomer(clientId, {
        phone: input.phone ?? '', name: input.customer_name, email: input.email,
        address: input.address, province: input.province, district: input.district, ward: input.ward,
      }, cx);
      const id = randomUUID();
      await cx.query(
        `INSERT INTO portal_pos_orders (
           id, client_id, code, status, page_id, case_id, comment_id, customer_id,
           assignee_user_id, assignee_email, source,
           customer_name, phone, email, address, province, district, ward,
           subtotal_vnd, discount_vnd, shipping_fee_vnd, deposit_vnd, total_vnd, cod_vnd,
           notes, customer_notes, ad_id, post_id, warehouse_id, stock_state
         ) VALUES (
           $1,$2,$3,'new',$4,$5,$6,$7,$8,$9,$10,
           $11,$12,$13,$14,$15,$16,$17,
           $18,$19,$20,$21,$22,$23,
           $24,$25,$26,$27,$28,'none')`,
        [id, clientId, code, str(input.page_id, 64), input.case_id || null, str(input.comment_id, 80),
         customer?.id ?? null, input.assignee_user_id || actorId || null,
         str(input.assignee_email || actorEmail, 200), str(input.source || 'manual', 20) || 'manual',
         str(input.customer_name, 200), normalizeVnPhone(input.phone) || str(input.phone, 20),
         str(input.email, 200), str(input.address, 500), str(input.province, 80), str(input.district, 80),
         str(input.ward, 80), totals.subtotal_vnd, totals.discount_vnd, totals.shipping_fee_vnd,
         totals.deposit_vnd, totals.total_vnd, totals.cod_vnd, str(input.notes, 2000),
         str(input.customer_notes, 2000), str(input.ad_id, 80), str(input.post_id, 80), warehouse.id],
      );
      for (const item of input.items) {
        await cx.query(
          `INSERT INTO portal_pos_order_items
             (order_id, product_id, variant_id, name, sku, color, size, qty, price_vnd, cost_vnd, image_url, weight_gram)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, item.product_id || null, item.variant_id || null, str(item.name, 200), str(item.sku, 80),
           str(item.color, 40), str(item.size, 40), Math.max(1, int(item.qty, 1)), money(item.price_vnd),
           money(item.cost_vnd), str(item.image_url, 500), int(item.weight_gram)],
        );
      }
      await cx.query(
        `INSERT INTO portal_pos_order_events (order_id, from_status, to_status, note, actor_email) VALUES ($1,'','new','Tạo đơn',$2)`,
        [id, actorEmail],
      );
      await cx.query('COMMIT');
      return this.getOrder(clientId, id);
    } catch (err) {
      await cx.query('ROLLBACK');
      throw err;
    } finally {
      cx.release();
    }
  }

  async getOrder(clientId: string, idOrCode: string) {
    await this.ensure();
    const res = await this.db.query(
      `SELECT o.*,
              (SELECT json_agg(jsonb_build_object(
                 'id', i.id, 'product_id', i.product_id, 'variant_id', i.variant_id,
                 'name', i.name, 'sku', i.sku, 'color', i.color, 'size', i.size,
                 'qty', i.qty, 'price_vnd', i.price_vnd, 'cost_vnd', i.cost_vnd,
                 'image_url', i.image_url, 'weight_gram', i.weight_gram
               ) ORDER BY i.id) FROM portal_pos_order_items i WHERE i.order_id = o.id) AS items,
              (SELECT json_agg(jsonb_build_object(
                 'id', e.id, 'from_status', e.from_status, 'to_status', e.to_status,
                 'note', e.note, 'actor_email', e.actor_email, 'created_at', e.created_at
               ) ORDER BY e.created_at) FROM portal_pos_order_events e WHERE e.order_id = o.id) AS events,
              (SELECT json_agg(jsonb_build_object(
                 'id', s.id, 'carrier', s.carrier, 'service_code', s.service_code,
                 'service_name', s.service_name, 'tracking_code', s.tracking_code,
                 'fee_vnd', s.fee_vnd, 'status', s.status, 'raw_status', s.raw_status,
                 'label_url', s.label_url, 'test_mode', s.test_mode,
                 'cancelled_at', s.cancelled_at, 'created_at', s.created_at
               ) ORDER BY s.created_at DESC) FROM portal_pos_shipments s WHERE s.order_id = o.id) AS shipments
         FROM portal_pos_orders o
        WHERE o.client_id = $1 AND (o.id::text = $2 OR o.code = $2)`,
      [clientId, idOrCode],
    );
    if (!res.rows[0]) return null;
    return this.mapOrder(res.rows[0]);
  }

  private mapOrder(row: Record<string, unknown>) {
    const items = Array.isArray(jsonVal(row.items)) ? (jsonVal(row.items) as unknown[]) : [];
    const events = Array.isArray(jsonVal(row.events)) ? (jsonVal(row.events) as unknown[]) : [];
    const shipments = Array.isArray(jsonVal(row.shipments)) ? (jsonVal(row.shipments) as unknown[]) : [];
    const mapItem = (item: unknown) => {
      const i = (item || {}) as Record<string, unknown>;
      return {
        id: String(i.id ?? ''), product_id: i.product_id ? String(i.product_id) : null,
        variant_id: i.variant_id ? String(i.variant_id) : null, name: str(i.name, 200), sku: str(i.sku, 80),
        color: str(i.color, 40), size: str(i.size, 40), qty: int(i.qty, 1), price_vnd: money(i.price_vnd),
        cost_vnd: money(i.cost_vnd), image_url: str(i.image_url, 500), weight_gram: int(i.weight_gram),
      };
    };
    return {
      id: String(row.id), code: str(row.code, 20),
      status: (isOrderStatus(row.status) ? row.status : 'new') as OrderStatus,
      page_id: str(row.page_id, 64), case_id: row.case_id ? String(row.case_id) : null,
      comment_id: str(row.comment_id, 80), customer_id: row.customer_id ? String(row.customer_id) : null,
      assignee_user_id: row.assignee_user_id ? String(row.assignee_user_id) : null,
      assignee_email: str(row.assignee_email, 200), source: str(row.source, 20),
      customer_name: str(row.customer_name, 200), phone: str(row.phone, 20), email: str(row.email, 200),
      address: str(row.address, 500), province: str(row.province, 80), district: str(row.district, 80),
      ward: str(row.ward, 80), subtotal_vnd: money(row.subtotal_vnd), discount_vnd: money(row.discount_vnd),
      shipping_fee_vnd: money(row.shipping_fee_vnd), deposit_vnd: money(row.deposit_vnd),
      total_vnd: money(row.total_vnd), cod_vnd: money(row.cod_vnd),
      notes: str(row.notes, 2000), customer_notes: str(row.customer_notes, 2000),
      ad_id: str(row.ad_id, 80), post_id: str(row.post_id, 80),
      warehouse_id: row.warehouse_id ? String(row.warehouse_id) : null, stock_state: str(row.stock_state, 20),
      confirmed_at: iso(row.confirmed_at), shipped_at: iso(row.shipped_at), delivered_at: iso(row.delivered_at),
      cancelled_at: iso(row.cancelled_at), returned_at: iso(row.returned_at),
      created_at: iso(row.created_at), updated_at: iso(row.updated_at),
      items: items.map(mapItem),
      events: events.map((item) => {
        const e = (item || {}) as Record<string, unknown>;
        return { id: String(e.id ?? ''), from_status: str(e.from_status, 20), to_status: str(e.to_status, 20), note: str(e.note, 400), actor_email: str(e.actor_email, 200), created_at: iso(e.created_at) };
      }),
      shipments: shipments.map((item) => {
        const s = (item || {}) as Record<string, unknown>;
        return {
          id: String(s.id ?? ''), carrier: str(s.carrier, 10), service_code: str(s.service_code, 40),
          service_name: str(s.service_name, 80), tracking_code: str(s.tracking_code, 80), fee_vnd: money(s.fee_vnd),
          status: str(s.status, 40), raw_status: str(s.raw_status, 40), label_url: str(s.label_url, 500),
          test_mode: s.test_mode !== false, cancelled_at: iso(s.cancelled_at), created_at: iso(s.created_at),
        };
      }),
    };
  }

  async listOrders(clientId: string, query: {
    status?: string; q?: string; page_id?: string; staff?: string; source?: string; carrier?: string;
    from?: string; to?: string; assignee_only?: string; limit?: number; offset?: number;
  } = {}) {
    await this.ensure();
    const params: unknown[] = [clientId];
    const where = ['o.client_id = $1'];
    if (query.status && query.status !== 'all') { params.push(query.status); where.push(`o.status = $${params.length}`); }
    if (query.q?.trim()) {
      params.push(`%${query.q.trim().slice(0, 80)}%`);
      where.push(`(o.code ILIKE $${params.length} OR o.phone ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR EXISTS (SELECT 1 FROM portal_pos_shipments s WHERE s.order_id = o.id AND s.tracking_code ILIKE $${params.length}))`);
    }
    if (query.page_id) { params.push(query.page_id); where.push(`o.page_id = $${params.length}`); }
    if (query.staff) { params.push(query.staff); where.push(`o.assignee_user_id = $${params.length}`); }
    if (query.assignee_only) { params.push(query.assignee_only); where.push(`o.assignee_user_id = $${params.length}`); }
    if (query.source) { params.push(query.source); where.push(`o.source = $${params.length}`); }
    if (query.carrier) {
      params.push(query.carrier);
      where.push(`EXISTS (SELECT 1 FROM portal_pos_shipments s WHERE s.order_id = o.id AND s.carrier = $${params.length} AND s.cancelled_at IS NULL)`);
    }
    if (query.from) { params.push(query.from); where.push(`o.created_at >= $${params.length}::timestamptz`); }
    if (query.to) { params.push(query.to); where.push(`o.created_at < $${params.length}::timestamptz + interval '1 day'`); }
    const count = await this.db.query(`SELECT count(*)::int AS n FROM portal_pos_orders o WHERE ${where.join(' AND ')}`, params);
    const limit = Math.min(100, Math.max(1, int(query.limit, 50)));
    const offset = Math.max(0, int(query.offset));
    params.push(limit, offset);
    const res = await this.db.query(
      `SELECT o.*,
              (SELECT json_agg(jsonb_build_object(
                 'id', i.id, 'name', i.name, 'sku', i.sku, 'color', i.color, 'size', i.size,
                 'qty', i.qty, 'price_vnd', i.price_vnd, 'image_url', i.image_url,
                 'product_id', i.product_id, 'variant_id', i.variant_id, 'cost_vnd', i.cost_vnd, 'weight_gram', i.weight_gram
               )) FROM portal_pos_order_items i WHERE i.order_id = o.id) AS items,
              (SELECT json_agg(jsonb_build_object(
                 'id', s.id, 'carrier', s.carrier, 'tracking_code', s.tracking_code,
                 'fee_vnd', s.fee_vnd, 'status', s.status, 'label_url', s.label_url,
                 'test_mode', s.test_mode, 'service_code', s.service_code, 'service_name', s.service_name,
                 'raw_status', s.raw_status, 'cancelled_at', s.cancelled_at, 'created_at', s.created_at
               ) ORDER BY s.created_at DESC) FROM portal_pos_shipments s WHERE s.order_id = o.id) AS shipments
         FROM portal_pos_orders o
        WHERE ${where.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const counts = await this.db.query(
      `SELECT status, count(*)::int AS n FROM portal_pos_orders o
        WHERE o.client_id = $1 ${query.assignee_only ? 'AND o.assignee_user_id = $2' : ''}
        GROUP BY status`,
      query.assignee_only ? [clientId, query.assignee_only] : [clientId],
    );
    const byStatus: Record<string, number> = {};
    for (const row of counts.rows) byStatus[String(row.status)] = int(row.n);
    return { total: int(count.rows[0]?.n), counts: byStatus, orders: res.rows.map((row) => this.mapOrder(row)) };
  }

  async updateOrderFields(clientId: string, id: string, patch: Partial<OrderInput> & { items?: OrderItemInput[] }) {
    const current = await this.getOrder(clientId, id);
    if (!current) return null;
    if (current.status !== 'new') throw new Error('order_locked');
    const items = patch.items ?? current.items;
    const totals = computeOrderTotals({
      items, discount_vnd: patch.discount_vnd ?? current.discount_vnd,
      shipping_fee_vnd: patch.shipping_fee_vnd ?? current.shipping_fee_vnd,
      deposit_vnd: patch.deposit_vnd ?? current.deposit_vnd,
    });
    if (patch.phone || patch.customer_name || patch.address) {
      await this.upsertPosCustomer(clientId, {
        phone: patch.phone ?? current.phone, name: patch.customer_name ?? current.customer_name,
        email: patch.email ?? current.email, address: patch.address ?? current.address,
        province: patch.province ?? current.province, district: patch.district ?? current.district,
        ward: patch.ward ?? current.ward,
      });
    }
    await this.db.query(
      `UPDATE portal_pos_orders SET
         customer_name = COALESCE(NULLIF($3,''), customer_name), phone = COALESCE(NULLIF($4,''), phone),
         email = COALESCE($5, email), address = COALESCE($6, address), province = COALESCE($7, province),
         district = COALESCE($8, district), ward = COALESCE($9, ward),
         discount_vnd = $10, shipping_fee_vnd = $11, deposit_vnd = $12,
         subtotal_vnd = $13, total_vnd = $14, cod_vnd = $15,
         notes = COALESCE($16, notes), customer_notes = COALESCE($17, customer_notes),
         assignee_user_id = COALESCE($18, assignee_user_id),
         assignee_email = COALESCE(NULLIF($19,''), assignee_email), updated_at = now()
       WHERE id = $1 AND client_id = $2`,
      [current.id, clientId, str(patch.customer_name, 200), normalizeVnPhone(patch.phone) || str(patch.phone, 20),
       patch.email != null ? str(patch.email, 200) : null, patch.address != null ? str(patch.address, 500) : null,
       patch.province != null ? str(patch.province, 80) : null, patch.district != null ? str(patch.district, 80) : null,
       patch.ward != null ? str(patch.ward, 80) : null, totals.discount_vnd, totals.shipping_fee_vnd, totals.deposit_vnd,
       totals.subtotal_vnd, totals.total_vnd, totals.cod_vnd,
       patch.notes != null ? str(patch.notes, 2000) : null, patch.customer_notes != null ? str(patch.customer_notes, 2000) : null,
       patch.assignee_user_id ?? null, str(patch.assignee_email, 200)],
    );
    if (patch.items) {
      await this.db.query(`DELETE FROM portal_pos_order_items WHERE order_id = $1`, [current.id]);
      for (const item of patch.items) {
        await this.db.query(
          `INSERT INTO portal_pos_order_items
             (order_id, product_id, variant_id, name, sku, color, size, qty, price_vnd, cost_vnd, image_url, weight_gram)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [current.id, item.product_id || null, item.variant_id || null, str(item.name, 200), str(item.sku, 80),
           str(item.color, 40), str(item.size, 40), Math.max(1, int(item.qty, 1)), money(item.price_vnd),
           money(item.cost_vnd), str(item.image_url, 500), int(item.weight_gram)],
        );
      }
    }
    return this.getOrder(clientId, current.id);
  }

  async changeStatus(clientId: string, id: string, to: OrderStatus, actorEmail = '', note = '') {
    const current = await this.getOrder(clientId, id);
    if (!current) throw new Error('order_not_found');
    if (current.status === to) return current;
    if (!canTransition(current.status, to)) throw new Error('invalid_transition');
    const action = stockActionForTransition(current.status, to);
    const warehouseId = current.warehouse_id || (await this.ensureWarehouse(clientId)).id;
    const cx = await this.db.connect();
    try {
      await cx.query('BEGIN');
      if (action) {
        for (const item of current.items) {
          if (!item.variant_id) continue;
          await this.moveStock(clientId, warehouseId, item.variant_id, action, item.qty, 'order', current.id, `${action} ${current.code}`, actorEmail, cx);
        }
      }
      const stamps: string[] = ['updated_at = now()'];
      if (to === 'confirmed') stamps.push('confirmed_at = now()', `stock_state = 'reserved'`);
      if (to === 'awaiting_pickup' || to === 'shipping') stamps.push('shipped_at = COALESCE(shipped_at, now())', `stock_state = 'deducted'`);
      if (to === 'success') stamps.push('delivered_at = now()');
      if (to === 'cancelled') stamps.push('cancelled_at = now()', `stock_state = CASE WHEN stock_state = 'deducted' THEN 'restocked' WHEN stock_state = 'reserved' THEN 'released' ELSE stock_state END`);
      if (to === 'returned') stamps.push('returned_at = now()', `stock_state = 'restocked'`);
      await cx.query(`UPDATE portal_pos_orders SET status = $3, ${stamps.join(', ')} WHERE id = $1 AND client_id = $2`, [current.id, clientId, to]);
      await cx.query(
        `INSERT INTO portal_pos_order_events (order_id, from_status, to_status, note, actor_email) VALUES ($1,$2,$3,$4,$5)`,
        [current.id, current.status, to, str(note, 400), actorEmail],
      );
      await cx.query('COMMIT');
    } catch (err) {
      await cx.query('ROLLBACK');
      throw err;
    } finally {
      cx.release();
    }
    return this.getOrder(clientId, current.id);
  }

  async customerStats(clientId: string, phone: string) {
    const n = normalizeVnPhone(phone);
    if (!n) return { success: 0, returned: 0, total: 0, blacklist: false, customer: null, risk: customerRisk({ success: 0, returned: 0 }) };
    const cust = await this.db.query(`SELECT * FROM portal_pos_customers WHERE client_id = $1 AND phone = $2`, [clientId, n]);
    const stats = await this.db.query(
      `SELECT count(*) FILTER (WHERE status = 'success')::int AS success,
              count(*) FILTER (WHERE status = 'returned')::int AS returned,
              count(*)::int AS total
         FROM portal_pos_orders WHERE client_id = $1 AND phone = $2`,
      [clientId, n],
    );
    const success = int(stats.rows[0]?.success);
    const returned = int(stats.rows[0]?.returned);
    const blacklist = cust.rows[0]?.blacklist === true;
    return { success, returned, total: int(stats.rows[0]?.total), blacklist, customer: cust.rows[0] ? this.mapCustomer(cust.rows[0]) : null, risk: customerRisk({ success, returned, blacklist }) };
  }

  async listCustomers(clientId: string, q?: string, limit = 50, offset = 0) {
    await this.ensure();
    const params: unknown[] = [clientId];
    let where = 'c.client_id = $1';
    if (q?.trim()) { params.push(`%${q.trim().slice(0, 80)}%`); where += ` AND (c.phone ILIKE $${params.length} OR c.name ILIKE $${params.length})`; }
    const count = await this.db.query(`SELECT count(*)::int AS n FROM portal_pos_customers c WHERE ${where}`, params);
    params.push(Math.min(100, Math.max(1, limit)), Math.max(0, offset));
    const res = await this.db.query(
      `SELECT c.*, count(o.id)::int AS order_count,
              count(o.id) FILTER (WHERE o.status = 'success')::int AS success_count,
              count(o.id) FILTER (WHERE o.status = 'returned')::int AS returned_count,
              COALESCE(sum(o.total_vnd) FILTER (WHERE o.status = 'success'),0)::bigint AS revenue_vnd
         FROM portal_pos_customers c
         LEFT JOIN portal_pos_orders o ON o.customer_id = c.id
        WHERE ${where}
        GROUP BY c.id ORDER BY c.updated_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      total: int(count.rows[0]?.n),
      customers: res.rows.map((row) => {
        const base = this.mapCustomer(row);
        const success = int(row.success_count);
        const returned = int(row.returned_count);
        return { ...base, order_count: int(row.order_count), success_count: success, returned_count: returned, revenue_vnd: money(row.revenue_vnd), risk: customerRisk({ success, returned, blacklist: base.blacklist }) };
      }),
    };
  }

  async getCustomerProfile(clientId: string, phone: string) {
    await this.ensure();
    const n = normalizeVnPhone(phone) || phone;
    const stats = await this.customerStats(clientId, n);
    const orders = await this.db.query(
      `SELECT o.id, o.code, o.status, o.total_vnd, o.cod_vnd, o.created_at, o.page_id, o.source
         FROM portal_pos_orders o WHERE o.client_id = $1 AND o.phone = $2 ORDER BY o.created_at DESC LIMIT 50`,
      [clientId, n],
    );
    let conversations: unknown[] = [];
    try {
      const cases = await this.db.query(
        `SELECT id, title, page_id, status, kind, last_interaction_at, created_at
           FROM portal_care_cases WHERE client_id = $1 AND (phone = $2 OR phone = $3)
           ORDER BY last_interaction_at DESC NULLS LAST LIMIT 30`,
        [clientId, n, phone],
      );
      conversations = cases.rows.map((row) => ({
        id: String(row.id), title: str(row.title, 200), page_id: str(row.page_id, 64),
        status: str(row.status, 40), kind: str(row.kind, 20),
        last_interaction_at: iso(row.last_interaction_at), created_at: iso(row.created_at),
      }));
    } catch { conversations = []; }
    let leads: unknown[] = [];
    try {
      const leadRows = await this.db.query(
        `SELECT id, full_name, phone, email, campaign_name, created_at
           FROM portal_page_leads WHERE client_id = $1 AND (phone = $2 OR phone = $3)
           ORDER BY created_at DESC LIMIT 30`,
        [clientId, n, phone],
      );
      leads = leadRows.rows.map((row) => ({
        id: String(row.id), full_name: str(row.full_name, 200), phone: str(row.phone, 20),
        email: str(row.email, 200), campaign_name: str(row.campaign_name, 200), created_at: iso(row.created_at),
      }));
    } catch { leads = []; }
    return {
      ...stats, phone: n,
      orders: orders.rows.map((row) => ({
        id: String(row.id), code: str(row.code, 20), status: str(row.status, 20),
        total_vnd: money(row.total_vnd), cod_vnd: money(row.cod_vnd), created_at: iso(row.created_at),
        page_id: str(row.page_id, 64), source: str(row.source, 20),
      })),
      conversations, leads,
    };
  }

  async setBlacklist(clientId: string, phone: string, blacklist: boolean, notes?: string) {
    const customer = await this.upsertPosCustomer(clientId, { phone, name: '' });
    if (!customer) throw new Error('phone_required');
    await this.db.query(
      `UPDATE portal_pos_customers SET blacklist = $3, notes = COALESCE($4, notes), updated_at = now() WHERE client_id = $1 AND id = $2`,
      [clientId, customer.id, blacklist, notes != null ? str(notes, 2000) : null],
    );
    return this.getCustomerProfile(clientId, customer.phone);
  }

  async listCarrierAccounts(clientId: string) {
    await this.ensure();
    const res = await this.db.query(
      `SELECT id, carrier, label, shop_id, extra, test_mode, active, token_encrypted, created_at
         FROM portal_pos_carrier_accounts WHERE client_id = $1 ORDER BY carrier, created_at`,
      [clientId],
    );
    return res.rows.map((row) => redactAccount({
      id: String(row.id), carrier: String(row.carrier), label: String(row.label ?? ''),
      shop_id: String(row.shop_id ?? ''), extra: jsonVal(row.extra),
      test_mode: row.test_mode !== false, active: row.active !== false, token_encrypted: row.token_encrypted,
    }));
  }

  async upsertCarrierAccount(clientId: string, input: {
    id?: string; carrier: CarrierId; label?: string; shop_id?: string;
    extra?: Record<string, unknown>; test_mode?: boolean; active?: boolean; token?: string;
  }) {
    await this.ensure();
    const tokenProvided = input.token !== undefined;
    const tokenBuf = tokenProvided && input.token?.trim() ? encryptCarrierToken(input.token!) : null;
    if (input.id) {
      if (tokenProvided) {
        await this.db.query(
          `UPDATE portal_pos_carrier_accounts SET
             label = COALESCE($3, label), shop_id = COALESCE($4, shop_id), extra = COALESCE($5::jsonb, extra),
             test_mode = COALESCE($6, test_mode), active = COALESCE($7, active),
             token_encrypted = $8, updated_at = now()
           WHERE id = $1 AND client_id = $2`,
          [input.id, clientId, input.label != null ? str(input.label, 80) : null,
           input.shop_id != null ? str(input.shop_id, 80) : null,
           input.extra ? JSON.stringify(input.extra) : null, input.test_mode ?? null, input.active ?? null, tokenBuf],
        );
      } else {
        await this.db.query(
          `UPDATE portal_pos_carrier_accounts SET
             label = COALESCE($3, label), shop_id = COALESCE($4, shop_id), extra = COALESCE($5::jsonb, extra),
             test_mode = COALESCE($6, test_mode), active = COALESCE($7, active), updated_at = now()
           WHERE id = $1 AND client_id = $2`,
          [input.id, clientId, input.label != null ? str(input.label, 80) : null,
           input.shop_id != null ? str(input.shop_id, 80) : null,
           input.extra ? JSON.stringify(input.extra) : null, input.test_mode ?? null, input.active ?? null],
        );
      }
      return (await this.listCarrierAccounts(clientId)).find((a) => a.id === input.id) ?? null;
    }
    const res = await this.db.query(
      `INSERT INTO portal_pos_carrier_accounts (client_id, carrier, label, shop_id, extra, test_mode, active, token_encrypted)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING id`,
      [clientId, input.carrier, str(input.label || input.carrier, 80), str(input.shop_id, 80),
       JSON.stringify(input.extra ?? {}), input.test_mode !== false, input.active !== false, tokenBuf],
    );
    return (await this.listCarrierAccounts(clientId)).find((a) => a.id === String(res.rows[0].id)) ?? null;
  }

  async loadCarrierAccountSecret(clientId: string, id: string) {
    const res = await this.db.query(`SELECT * FROM portal_pos_carrier_accounts WHERE client_id = $1 AND id = $2`, [clientId, id]);
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: String(row.id), carrier: String(row.carrier) as CarrierId,
      token: decryptCarrierToken(row.token_encrypted) ?? '',
      shop_id: String(row.shop_id ?? ''),
      extra: (jsonVal(row.extra) as Record<string, unknown>) ?? {},
      test_mode: row.test_mode !== false,
    };
  }

  async insertShipment(clientId: string, orderId: string, data: {
    account_id?: string; carrier: CarrierId; service_code: string; service_name: string;
    tracking_code: string; fee_vnd: number; status: string; raw_status: string;
    label_url: string; test_mode: boolean; payload: unknown;
  }) {
    const res = await this.db.query(
      `INSERT INTO portal_pos_shipments
         (order_id, client_id, account_id, carrier, service_code, service_name, tracking_code,
          fee_vnd, status, raw_status, label_url, test_mode, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) RETURNING id`,
      [orderId, clientId, data.account_id || null, data.carrier, data.service_code, data.service_name,
       data.tracking_code, data.fee_vnd, data.status, data.raw_status, data.label_url, data.test_mode,
       JSON.stringify(data.payload ?? {})],
    );
    return String(res.rows[0].id);
  }

  async findShipmentByTracking(tracking: string) {
    const res = await this.db.query(
      `SELECT s.*, o.client_id AS order_client_id, o.id AS oid, o.status AS order_status
         FROM portal_pos_shipments s JOIN portal_pos_orders o ON o.id = s.order_id
        WHERE s.tracking_code = $1 ORDER BY s.created_at DESC LIMIT 1`,
      [tracking],
    );
    return res.rows[0] ?? null;
  }

  async updateShipmentStatus(id: string, status: string, rawStatus: string) {
    await this.db.query(`UPDATE portal_pos_shipments SET status = $2, raw_status = $3, updated_at = now() WHERE id = $1`, [id, status, rawStatus]);
  }

  async cancelShipmentRow(id: string) {
    await this.db.query(`UPDATE portal_pos_shipments SET cancelled_at = now(), status = 'cancelled', updated_at = now() WHERE id = $1`, [id]);
  }

  async importCod(clientId: string, carrier: string, period: string, filename: string, csvText: string, actor: string) {
    const { rows } = parseCsv(csvText);
    const statement = await this.db.query(
      `INSERT INTO portal_pos_cod_statements (client_id, carrier, period, filename, actor_email)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [clientId, str(carrier, 10), str(period, 40), str(filename, 200), actor],
    );
    const statementId = String(statement.rows[0].id);
    const lines: Array<{ tracking_code: string; order_code: string; expected_cod: number; actual_cod: number; fee_vnd: number; payout_vnd: number; difference_vnd: number; match_status: string }> = [];
    for (const row of rows) {
      const tracking = str(row.tracking_code || row.order_code, 80);
      const actual = csvMoney(row.actual_cod);
      const fee = csvMoney(row.fee);
      const payout = csvMoney(row.payout);
      let orderId: string | null = null;
      let orderCode = str(row.order_code, 20);
      let expected = 0;
      if (tracking) {
        const found = await this.db.query(
          `SELECT o.id, o.code, o.cod_vnd FROM portal_pos_shipments s
             JOIN portal_pos_orders o ON o.id = s.order_id
            WHERE s.client_id = $1 AND s.tracking_code = $2 ORDER BY s.created_at DESC LIMIT 1`,
          [clientId, tracking],
        );
        if (found.rows[0]) {
          orderId = String(found.rows[0].id); orderCode = String(found.rows[0].code); expected = money(found.rows[0].cod_vnd);
        } else if (orderCode) {
          const byCode = await this.db.query(
            `SELECT id, code, cod_vnd FROM portal_pos_orders WHERE client_id = $1 AND code = $2`,
            [clientId, orderCode],
          );
          if (byCode.rows[0]) {
            orderId = String(byCode.rows[0].id); orderCode = String(byCode.rows[0].code); expected = money(byCode.rows[0].cod_vnd);
          }
        }
      }
      const difference = actual - expected;
      const matchStatus = orderId ? (Math.abs(difference) <= 1 ? 'matched' : 'diff') : 'missing';
      await this.db.query(
        `INSERT INTO portal_pos_cod_lines
           (statement_id, client_id, tracking_code, order_id, order_code, expected_cod, actual_cod, fee_vnd, payout_vnd, difference_vnd, match_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [statementId, clientId, tracking, orderId, orderCode, expected, actual, fee, payout, difference, matchStatus],
      );
      lines.push({ tracking_code: tracking, order_code: orderCode, expected_cod: expected, actual_cod: actual, fee_vnd: fee, payout_vnd: payout, difference_vnd: difference, match_status: matchStatus });
    }
    return { statement_id: statementId, total: lines.length, matched: lines.filter((l) => l.match_status === 'matched').length, diffs: lines.filter((l) => l.match_status === 'diff').length, missing: lines.filter((l) => l.match_status === 'missing').length, lines };
  }

  async listCod(clientId: string) {
    await this.ensure();
    const statements = await this.db.query(
      `SELECT s.*, count(l.id)::int AS line_count,
              count(l.id) FILTER (WHERE l.match_status = 'matched')::int AS matched,
              count(l.id) FILTER (WHERE l.match_status = 'diff')::int AS diffs,
              count(l.id) FILTER (WHERE l.match_status = 'missing')::int AS missing,
              COALESCE(sum(l.difference_vnd),0)::bigint AS difference_total
         FROM portal_pos_cod_statements s
         LEFT JOIN portal_pos_cod_lines l ON l.statement_id = s.id
        WHERE s.client_id = $1 GROUP BY s.id ORDER BY s.imported_at DESC LIMIT 50`,
      [clientId],
    );
    return statements.rows.map((row) => ({
      id: String(row.id), carrier: str(row.carrier, 10), period: str(row.period, 40),
      filename: str(row.filename, 200), imported_at: iso(row.imported_at), actor_email: str(row.actor_email, 200),
      line_count: int(row.line_count), matched: int(row.matched), diffs: int(row.diffs),
      missing: int(row.missing), difference_total: money(row.difference_total),
    }));
  }

  async getCodStatement(clientId: string, id: string) {
    const list = await this.listCod(clientId);
    const head = list.find((s) => s.id === id);
    if (!head) return null;
    const lines = await this.db.query(`SELECT * FROM portal_pos_cod_lines WHERE statement_id = $1 AND client_id = $2 ORDER BY id`, [id, clientId]);
    return {
      ...head,
      lines: lines.rows.map((row) => ({
        id: String(row.id), tracking_code: str(row.tracking_code, 80),
        order_id: row.order_id ? String(row.order_id) : null, order_code: str(row.order_code, 20),
        expected_cod: money(row.expected_cod), actual_cod: money(row.actual_cod),
        fee_vnd: money(row.fee_vnd), payout_vnd: money(row.payout_vnd),
        difference_vnd: money(row.difference_vnd), match_status: str(row.match_status, 20),
      })),
    };
  }

  async recordCodPayout(clientId: string, input: { tracking_code?: string; order_code?: string; actual_cod: number; fee_vnd?: number; payout_vnd?: number; carrier?: string }, actor: string) {
    const csv = `tracking_code,order_code,actual_cod,fee,payout\n${str(input.tracking_code, 80)},${str(input.order_code, 20)},${int(input.actual_cod)},${int(input.fee_vnd)},${int(input.payout_vnd)}\n`;
    return this.importCod(clientId, str(input.carrier, 10), '', 'manual', csv, actor);
  }

  rangeStart(range: 'today' | '7d' | '30d' | 'month'): string {
    const now = new Date();
    const saigon = new Date(now.getTime() + 7 * 3600_000);
    const todayStartUtc = Date.UTC(saigon.getUTCFullYear(), saigon.getUTCMonth(), saigon.getUTCDate()) - 7 * 3600_000;
    if (range === 'month') {
      const start = Date.UTC(saigon.getUTCFullYear(), saigon.getUTCMonth(), 1) - 7 * 3600_000;
      return new Date(start).toISOString();
    }
    const days = range === 'today' ? 0 : range === '7d' ? 6 : 29;
    return new Date(todayStartUtc - days * 86400000).toISOString();
  }

  async salesReport(clientId: string, range: 'today' | '7d' | '30d' | 'month', assigneeOnly?: string) {
    await this.ensure();
    const from = this.rangeStart(range);
    const staffFilter = assigneeOnly ? 'AND o.assignee_user_id = $3' : '';
    const params: unknown[] = assigneeOnly ? [clientId, from, assigneeOnly] : [clientId, from];
    const agg = await this.db.query(
      `SELECT count(*)::int AS orders_total,
              count(*) FILTER (WHERE status = 'success')::int AS orders_success,
              count(*) FILTER (WHERE status = 'returned')::int AS orders_returned,
              count(*) FILTER (WHERE status = 'cancelled')::int AS orders_cancelled,
              count(*) FILTER (WHERE status = 'new')::int AS orders_new,
              COALESCE(sum(total_vnd) FILTER (WHERE status = 'success'),0)::bigint AS revenue_vnd,
              COALESCE(sum(total_vnd) FILTER (WHERE status NOT IN ('success','cancelled','returned')),0)::bigint AS expected_revenue_vnd,
              COALESCE(sum(cod_vnd) FILTER (WHERE status = 'success'),0)::bigint AS cod_vnd,
              count(*) FILTER (WHERE case_id IS NOT NULL)::int AS from_conversations
         FROM portal_pos_orders o
        WHERE o.client_id = $1 AND o.created_at >= $2::timestamptz ${staffFilter}`,
      params,
    );
    let conversations = 0;
    try {
      const conv = await this.db.query(
        `SELECT count(*)::int AS n FROM portal_care_cases
          WHERE client_id = $1 AND kind = 'message' AND COALESCE(last_interaction_at, created_at) >= $2::timestamptz`,
        [clientId, from],
      );
      conversations = int(conv.rows[0]?.n);
    } catch { conversations = 0; }
    const groupSql = (selectExpr: string, alias: string) =>
      this.db.query(
        `SELECT ${selectExpr} AS ${alias},
                count(*)::int AS orders,
                count(*) FILTER (WHERE status = 'success')::int AS success,
                count(*) FILTER (WHERE status = 'returned')::int AS returned,
                COALESCE(sum(total_vnd) FILTER (WHERE status = 'success'),0)::bigint AS revenue_vnd,
                COALESCE(sum(total_vnd) FILTER (WHERE status NOT IN ('success','cancelled','returned')),0)::bigint AS expected_revenue_vnd
           FROM portal_pos_orders o
          WHERE o.client_id = $1 AND o.created_at >= $2::timestamptz ${staffFilter}
          GROUP BY 1 ORDER BY revenue_vnd DESC`,
        params,
      );
    const [byStaff, byPage, bySource] = await Promise.all([
      groupSql(`COALESCE(NULLIF(assignee_email,''), '(chưa gán)')`, 'staff'),
      groupSql(`COALESCE(NULLIF(page_id,''), '(không gắn Page)')`, 'page_id'),
      groupSql(`COALESCE(NULLIF(source,''), 'manual')`, 'source'),
    ]);
    const a = agg.rows[0] || {};
    const success = int(a.orders_success);
    const returned = int(a.orders_returned);
    const fromConv = int(a.from_conversations);
    const mapGroup = (rows: Array<Record<string, unknown>>, key: string) =>
      rows.map((row) => {
        const s = int(row.success);
        const r = int(row.returned);
        return {
          staff: row.staff != null ? String(row.staff) : undefined,
          page_id: row.page_id != null ? String(row.page_id) : undefined,
          source: row.source != null ? String(row.source) : undefined,
          [key]: String(row[key] ?? ''),
          orders: int(row.orders), success: s, returned: r,
          revenue_vnd: money(row.revenue_vnd), expected_revenue_vnd: money(row.expected_revenue_vnd), return_rate: s + r > 0 ? r / (s + r) : 0,
        };
      });
    return {
      range, from,
      revenue_vnd: money(a.revenue_vnd), expected_revenue_vnd: money(a.expected_revenue_vnd), cod_vnd: money(a.cod_vnd),
      orders: { total: int(a.orders_total), success, returned, cancelled: int(a.orders_cancelled), new: int(a.orders_new), from_conversations: fromConv },
      conversations, close_rate: conversations > 0 ? fromConv / conversations : 0,
      return_rate: success + returned > 0 ? returned / (success + returned) : 0,
      by_staff: mapGroup(byStaff.rows, 'staff'),
      by_page: mapGroup(byPage.rows, 'page_id'),
      by_source: mapGroup(bySource.rows, 'source'),
    };
  }
}
