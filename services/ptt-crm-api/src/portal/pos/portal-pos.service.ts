import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PortalJwtPayload } from '../portal-jwt.util';
import { PortalPosRepository, type OrderInput, type ProductInput } from './portal-pos.repository';
import { isOrderStatus, mapCarrierStatus } from './portal-pos-status.util';
import type { CarrierId, OrderStatus } from './portal-pos.types';
import { CARRIERS } from './portal-pos.types';
import { getCarrierAdapter } from './carriers';
import type { CarrierAccount, CreateShipmentInput, QuoteInput } from './carriers/carrier-adapter';
import { StockError } from './portal-pos-stock.util';
import { normalizeVnPhone } from './portal-pos-pricing.util';

@Injectable()
export class PortalPosService {
  private readonly log = new Logger(PortalPosService.name);

  constructor(private readonly repo: PortalPosRepository) {}

  private requireManager(user: PortalJwtPayload): void {
    if (user.role === 'staff') throw new ForbiddenException({ error: 'approver_only' });
  }

  private staffAssignee(user: PortalJwtPayload): string | undefined {
    return user.role === 'staff' ? user.sub : undefined;
  }

  private async requireOrder(user: PortalJwtPayload, id: string) {
    const order = await this.repo.getOrder(user.client_id, id);
    if (!order) throw new NotFoundException({ error: 'order_not_found' });
    if (user.role === 'staff' && order.assignee_user_id && order.assignee_user_id !== user.sub) {
      throw new ForbiddenException({ error: 'not_assignee' });
    }
    return order;
  }

  async warehouse(user: PortalJwtPayload) {
    return this.repo.ensureWarehouse(user.client_id);
  }

  async categories(user: PortalJwtPayload) {
    return { categories: await this.repo.listCategories(user.client_id) };
  }

  async upsertCategory(user: PortalJwtPayload, body: { id?: string; name?: string; sort_order?: number }) {
    this.requireManager(user);
    return this.repo.upsertCategory(user.client_id, String(body.name ?? ''), body.id, Number(body.sort_order) || 0);
  }

  async deleteCategory(user: PortalJwtPayload, id: string) {
    this.requireManager(user);
    await this.repo.deleteCategory(user.client_id, id);
    return { ok: true };
  }

  async products(user: PortalJwtPayload, query: { q?: string; category_id?: string; active?: string; page_id?: string; low_stock?: string }) {
    const products = await this.repo.listProducts(user.client_id, query);
    const warehouse = await this.repo.ensureWarehouse(user.client_id);
    return { warehouse, products };
  }

  async product(user: PortalJwtPayload, id: string) {
    const product = await this.repo.getProduct(user.client_id, id);
    if (!product) throw new NotFoundException({ error: 'product_not_found' });
    return { product };
  }

  async createProduct(user: PortalJwtPayload, body: ProductInput) {
    this.requireManager(user);
    if (!String(body?.name ?? '').trim()) throw new BadRequestException({ error: 'name_required' });
    const product = await this.repo.createProduct(user.client_id, body, user.email);
    return { product };
  }

  async updateProduct(user: PortalJwtPayload, id: string, body: ProductInput) {
    this.requireManager(user);
    const product = await this.repo.updateProduct(user.client_id, id, body, user.email);
    if (!product) throw new NotFoundException({ error: 'product_not_found' });
    return { product };
  }

  async setProductActive(user: PortalJwtPayload, id: string, active: boolean) {
    this.requireManager(user);
    await this.repo.setProductActive(user.client_id, id, active);
    return { ok: true };
  }

  async importProducts(user: PortalJwtPayload, csvText: string, pageId = '') {
    this.requireManager(user);
    return this.repo.importProductsCsv(user.client_id, pageId, csvText, user.email);
  }

  async moveStock(user: PortalJwtPayload, body: { variant_id?: string; kind?: string; qty?: number; note?: string }) {
    this.requireManager(user);
    const kind = body.kind as 'import' | 'export' | 'adjust';
    if (!['import', 'export', 'adjust'].includes(kind)) throw new BadRequestException({ error: 'invalid_kind' });
    if (!body.variant_id) throw new BadRequestException({ error: 'variant_required' });
    const warehouse = await this.repo.ensureWarehouse(user.client_id);
    try {
      const state = await this.repo.moveStock(
        user.client_id, warehouse.id, body.variant_id, kind, Number(body.qty) || 0,
        'manual', '', String(body.note ?? ''), user.email,
      );
      return { ok: true, stock: { ...state, available: Math.max(0, state.on_hand - state.reserved) } };
    } catch (err) {
      if (err instanceof StockError) throw new BadRequestException({ error: err.message });
      throw err;
    }
  }

  async ledger(user: PortalJwtPayload, variantId?: string) {
    return { ledger: await this.repo.listLedger(user.client_id, variantId) };
  }

  async orders(user: PortalJwtPayload, query: Record<string, string | undefined>) {
    return this.repo.listOrders(user.client_id, { ...query, assignee_only: this.staffAssignee(user) });
  }

  async order(user: PortalJwtPayload, id: string) {
    const order = await this.requireOrder(user, id);
    const customer = order.phone ? await this.repo.getCustomerProfile(user.client_id, order.phone) : null;
    return { order, customer };
  }

  async createOrder(user: PortalJwtPayload, body: OrderInput & { confirm?: boolean }) {
    if (!body?.items?.length) throw new BadRequestException({ error: 'items_required' });
    if (!normalizeVnPhone(body.phone ?? '') && !String(body.phone ?? '').trim()) {
      throw new BadRequestException({ error: 'phone_required' });
    }
    try {
      let order = await this.repo.createOrder(user.client_id, {
        ...body,
        assignee_user_id: body.assignee_user_id || user.sub,
        assignee_email: body.assignee_email || user.email,
      }, user.email, user.sub);
      if (!order) throw new BadRequestException({ error: 'create_failed' });
      if (body.confirm) {
        try {
          order = await this.repo.changeStatus(user.client_id, order.id, 'confirmed', user.email, 'Xác nhận khi tạo');
        } catch (err) {
          if (err instanceof StockError) throw new BadRequestException({ error: 'insufficient_stock', message: err.message });
          throw err;
        }
      }
      return { order };
    } catch (err) {
      if (err instanceof StockError) throw new BadRequestException({ error: 'insufficient_stock' });
      if (err instanceof Error && err.message === 'items_required') throw new BadRequestException({ error: 'items_required' });
      throw err;
    }
  }

  async updateOrder(user: PortalJwtPayload, id: string, body: Partial<OrderInput>) {
    await this.requireOrder(user, id);
    try {
      const order = await this.repo.updateOrderFields(user.client_id, id, body);
      if (!order) throw new NotFoundException({ error: 'order_not_found' });
      return { order };
    } catch (err) {
      if (err instanceof Error && err.message === 'order_locked') throw new BadRequestException({ error: 'order_locked' });
      throw err;
    }
  }

  async changeStatus(user: PortalJwtPayload, id: string, status: string, note = '') {
    await this.requireOrder(user, id);
    if (!isOrderStatus(status)) throw new BadRequestException({ error: 'invalid_status' });
    try {
      const order = await this.repo.changeStatus(user.client_id, id, status as OrderStatus, user.email, note);
      return { order };
    } catch (err) {
      if (err instanceof StockError) throw new BadRequestException({ error: 'insufficient_stock', message: err.message });
      if (err instanceof Error && err.message === 'invalid_transition') throw new BadRequestException({ error: 'invalid_transition' });
      throw err;
    }
  }

  async customers(user: PortalJwtPayload, q?: string) {
    return this.repo.listCustomers(user.client_id, q);
  }

  async customer(user: PortalJwtPayload, phone: string) {
    return this.repo.getCustomerProfile(user.client_id, phone);
  }

  async setBlacklist(user: PortalJwtPayload, phone: string, blacklist: boolean, notes?: string) {
    this.requireManager(user);
    return this.repo.setBlacklist(user.client_id, phone, blacklist, notes);
  }

  async customerWarning(user: PortalJwtPayload, phone: string) {
    return this.repo.customerStats(user.client_id, phone);
  }

  async carriers(user: PortalJwtPayload) {
    return { accounts: await this.repo.listCarrierAccounts(user.client_id) };
  }

  async upsertCarrier(user: PortalJwtPayload, body: {
    id?: string; carrier?: string; label?: string; shop_id?: string;
    extra?: Record<string, unknown>; test_mode?: boolean; active?: boolean; token?: string;
  }) {
    this.requireManager(user);
    const carrier = body.carrier as CarrierId;
    if (!CARRIERS.includes(carrier) && !body.id) throw new BadRequestException({ error: 'invalid_carrier' });
    const existing = body.id
      ? (await this.repo.listCarrierAccounts(user.client_id)).find((a) => a.id === body.id)
      : undefined;
    const testMode = body.test_mode !== undefined ? Boolean(body.test_mode) : (existing?.test_mode ?? true);
    if (!testMode) {
      const carrierId = (carrier || existing?.carrier || 'ghn') as CarrierId;
      const shop = String(body.shop_id ?? existing?.shop_id ?? '').trim();
      if (carrierId === 'ghn' && !shop) {
        throw new BadRequestException({
          error: 'shop_id_required',
          message: 'Cần mã cửa hàng GHN khi chạy chế độ thật.',
        });
      }
      const hasToken = Boolean(body.token?.trim()) || Boolean(existing?.has_token);
      if (!hasToken) {
        throw new BadRequestException({
          error: 'token_required',
          message: 'Cần mã kết nối khi chạy chế độ thật.',
        });
      }
    }
    const account = await this.repo.upsertCarrierAccount(user.client_id, {
      ...body, carrier: carrier || (existing?.carrier as CarrierId) || 'ghn',
    });
    return { account };
  }

  private async resolveAccount(user: PortalJwtPayload, accountId?: string, carrier?: string): Promise<CarrierAccount> {
    if (accountId) {
      const secret = await this.repo.loadCarrierAccountSecret(user.client_id, accountId);
      if (!secret) throw new NotFoundException({ error: 'carrier_account_not_found' });
      return secret;
    }
    const accounts = await this.repo.listCarrierAccounts(user.client_id);
    const match = accounts.find((a) => !carrier || a.carrier === carrier);
    if (match) {
      const secret = await this.repo.loadCarrierAccountSecret(user.client_id, String(match.id));
      if (secret) return secret;
    }
    const id = (carrier && CARRIERS.includes(carrier as CarrierId) ? carrier : 'ghn') as CarrierId;
    return { id: 'simulated', carrier: id, token: '', shop_id: '', extra: {}, test_mode: true };
  }

  async quote(user: PortalJwtPayload, orderId: string, body: { account_id?: string; carrier?: string; service_code?: string }) {
    const order = await this.requireOrder(user, orderId);
    const account = await this.resolveAccount(user, body.account_id, body.carrier || order.shipments[0]?.carrier);
    const adapter = getCarrierAdapter(account.carrier);
    const input = this.quoteInput(order, body.service_code);
    const quotes = await adapter.quote(account, input);
    return { quotes, carrier: account.carrier, test_mode: account.test_mode, simulated: account.test_mode || !account.token };
  }

  private quoteInput(order: Awaited<ReturnType<PortalPosRepository['getOrder']>> & object, service?: string): QuoteInput & { service_code?: string } {
    const o = order!;
    const weight = Math.max(100, o.items.reduce((s, i) => s + (i.weight_gram || 200) * i.qty, 0));
    return {
      to_province: o.province, to_district: o.district, to_ward: o.ward, to_address: o.address,
      weight_gram: weight, value_vnd: o.total_vnd, service_code: service,
    };
  }

  async ship(user: PortalJwtPayload, orderId: string, body: { account_id?: string; carrier?: string; service_code?: string; service_name?: string }) {
    const order = await this.requireOrder(user, orderId);
    if (['cancelled', 'returned', 'success'].includes(order.status)) {
      throw new BadRequestException({ error: 'order_not_shippable' });
    }
    const account = await this.resolveAccount(user, body.account_id, body.carrier);
    const adapter = getCarrierAdapter(account.carrier);
    const quotes = await adapter.quote(account, this.quoteInput(order, body.service_code));
    const picked = quotes.find((q) => q.service_code === body.service_code) ?? quotes[0];
    if (!picked) throw new BadRequestException({ error: 'no_service' });
    const input: CreateShipmentInput = {
      ...this.quoteInput(order, picked.service_code),
      service_code: picked.service_code,
      client_order_code: order.code,
      customer_name: order.customer_name || 'Khách',
      customer_phone: order.phone,
      customer_address: [order.address, order.ward, order.district, order.province].filter(Boolean).join(', '),
      cod_vnd: order.cod_vnd,
      note: order.notes,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, price_vnd: i.price_vnd, weight_gram: i.weight_gram })),
    };
    const created = await adapter.create(account, input);
    this.log.log(`shipment created carrier=${account.carrier} simulated=${created.simulated} order=${order.code}`);
    await this.repo.insertShipment(user.client_id, order.id, {
      account_id: account.id === 'simulated' ? undefined : account.id,
      carrier: account.carrier,
      service_code: picked.service_code,
      service_name: body.service_name || picked.service_name,
      tracking_code: created.tracking_code,
      fee_vnd: created.fee_vnd,
      status: 'created',
      raw_status: created.raw_status,
      label_url: created.label_url,
      test_mode: created.simulated || account.test_mode,
      payload: created.raw,
    });
    if (created.fee_vnd && order.status === 'new' || created.fee_vnd) {
      try {
        await this.repo.updateOrderFields(user.client_id, order.id, { shipping_fee_vnd: created.fee_vnd } as Partial<OrderInput>);
      } catch {
        // order may already be past 'new' — fee is on the shipment either way
      }
    }
    // Advance toward awaiting_pickup if still earlier in the pipeline
    const next: OrderStatus | null =
      order.status === 'new' ? 'confirmed' :
      order.status === 'confirmed' ? 'packing' :
      order.status === 'packing' ? 'awaiting_pickup' : null;
    let updated = await this.repo.getOrder(user.client_id, order.id);
    if (next) {
      try {
        if (order.status === 'new') {
          updated = await this.repo.changeStatus(user.client_id, order.id, 'confirmed', user.email, 'Xác nhận để gửi vận chuyển');
          updated = await this.repo.changeStatus(user.client_id, updated!.id, 'packing', user.email, '');
          updated = await this.repo.changeStatus(user.client_id, updated!.id, 'awaiting_pickup', user.email, `Gửi ${account.carrier.toUpperCase()} ${created.tracking_code}`);
        } else if (order.status === 'confirmed') {
          updated = await this.repo.changeStatus(user.client_id, order.id, 'packing', user.email, '');
          updated = await this.repo.changeStatus(user.client_id, updated!.id, 'awaiting_pickup', user.email, `Gửi ${account.carrier.toUpperCase()} ${created.tracking_code}`);
        } else if (order.status === 'packing') {
          updated = await this.repo.changeStatus(user.client_id, order.id, 'awaiting_pickup', user.email, `Gửi ${account.carrier.toUpperCase()} ${created.tracking_code}`);
        }
      } catch (err) {
        if (err instanceof StockError) throw new BadRequestException({ error: 'insufficient_stock', message: err.message });
        throw err;
      }
    }
    return { order: updated, shipment: created, simulated: created.simulated };
  }

  async cancelShipment(user: PortalJwtPayload, orderId: string, shipmentId?: string) {
    const order = await this.requireOrder(user, orderId);
    const shipment = shipmentId
      ? order.shipments.find((s) => s.id === shipmentId)
      : order.shipments.find((s) => !s.cancelled_at);
    if (!shipment) throw new NotFoundException({ error: 'shipment_not_found' });
    const accounts = await this.repo.listCarrierAccounts(user.client_id);
    const acc = accounts.find((a) => a.carrier === shipment.carrier);
    const secret = acc
      ? await this.repo.loadCarrierAccountSecret(user.client_id, String(acc.id))
      : { id: 'simulated', carrier: shipment.carrier as CarrierId, token: '', shop_id: '', extra: {}, test_mode: true };
    const adapter = getCarrierAdapter(secret!.carrier);
    const result = await adapter.cancel(secret!, shipment.tracking_code);
    await this.repo.cancelShipmentRow(shipment.id);
    return { ok: result.ok, simulated: result.simulated, order: await this.repo.getOrder(user.client_id, order.id) };
  }

  async handleWebhook(carrier: CarrierId, body: Record<string, unknown>) {
    const tracking = this.extractTracking(carrier, body);
    const rawStatus = this.extractRawStatus(carrier, body);
    if (!tracking) {
      this.log.warn(`webhook ${carrier} missing tracking`);
      return { ok: false, error: 'missing_tracking' };
    }
    const mapped = mapCarrierStatus(carrier, rawStatus);
    const row = await this.repo.findShipmentByTracking(tracking);
    if (!row) return { ok: true, ignored: true, tracking };
    await this.repo.updateShipmentStatus(String(row.id), mapped ?? String(rawStatus), String(rawStatus));
    if (mapped && String(row.order_status) !== mapped) {
      try {
        await this.repo.changeStatus(String(row.order_client_id), String(row.oid), mapped, 'webhook', `Webhook ${carrier}: ${rawStatus}`);
      } catch (err) {
        this.log.warn(`webhook ${carrier} status ${rawStatus} -> ${mapped} skipped: ${err instanceof Error ? err.message : 'error'}`);
      }
    }
    return { ok: true, tracking, mapped };
  }

  private extractTracking(carrier: CarrierId, body: Record<string, unknown>): string {
    const data = (body.data || body.DATA || body.order || {}) as Record<string, unknown>;
    const raw =
      body.OrderCode || body.order_code || body.tracking_code || body.label || body.label_id ||
      body.ORDER_NUMBER || data.ORDER_NUMBER || data.order_code || data.label || data.OrderCode;
    return String(raw ?? '').trim();
  }

  private extractRawStatus(carrier: CarrierId, body: Record<string, unknown>): string {
    const data = (body.data || body.DATA || body.order || {}) as Record<string, unknown>;
    const raw =
      body.Status || body.status || body.status_id || body.ORDER_STATUS ||
      data.Status || data.status || data.status_id || data.ORDER_STATUS;
    return raw == null ? '' : String(raw);
  }

  async importCod(user: PortalJwtPayload, csvText: string, meta: { carrier?: string; period?: string; filename?: string }) {
    this.requireManager(user);
    return this.repo.importCod(user.client_id, meta.carrier ?? '', meta.period ?? '', meta.filename ?? 'upload.csv', csvText, user.email);
  }

  async listCod(user: PortalJwtPayload) {
    return { statements: await this.repo.listCod(user.client_id) };
  }

  async getCod(user: PortalJwtPayload, id: string) {
    const statement = await this.repo.getCodStatement(user.client_id, id);
    if (!statement) throw new NotFoundException({ error: 'statement_not_found' });
    return { statement };
  }

  async recordPayout(user: PortalJwtPayload, body: { tracking_code?: string; order_code?: string; actual_cod?: number; fee_vnd?: number; payout_vnd?: number; carrier?: string }) {
    this.requireManager(user);
    return this.repo.recordCodPayout(user.client_id, {
      tracking_code: body.tracking_code, order_code: body.order_code,
      actual_cod: Number(body.actual_cod) || 0, fee_vnd: Number(body.fee_vnd) || 0,
      payout_vnd: Number(body.payout_vnd) || 0, carrier: body.carrier,
    }, user.email);
  }

  async salesReport(user: PortalJwtPayload, range: string) {
    const r = range === 'today' || range === '7d' || range === '30d' || range === 'month' ? range : '7d';
    return this.repo.salesReport(user.client_id, r, this.staffAssignee(user));
  }
}
