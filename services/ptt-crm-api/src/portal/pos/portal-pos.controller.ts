import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PortalJwtGuard, PortalUser } from '../portal-jwt.guard';
import { PortalJwtPayload } from '../portal-jwt.util';
import { PortalPosService } from './portal-pos.service';
import type { OrderInput, ProductInput } from './portal-pos.repository';

@Controller('api/portal/pos')
@UseGuards(PortalJwtGuard)
export class PortalPosController {
  constructor(private readonly pos: PortalPosService) {}

  @Get('warehouse')
  warehouse(@PortalUser() user: PortalJwtPayload) {
    return this.pos.warehouse(user);
  }

  @Get('categories')
  categories(@PortalUser() user: PortalJwtPayload) {
    return this.pos.categories(user);
  }

  @Post('categories')
  upsertCategory(@PortalUser() user: PortalJwtPayload, @Body() body: { id?: string; name?: string; sort_order?: number }) {
    return this.pos.upsertCategory(user, body ?? {});
  }

  @Delete('categories/:id')
  deleteCategory(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    return this.pos.deleteCategory(user, id);
  }

  @Get('products')
  products(
    @PortalUser() user: PortalJwtPayload,
    @Query('q') q?: string,
    @Query('category_id') category_id?: string,
    @Query('active') active?: string,
    @Query('page_id') page_id?: string,
    @Query('low_stock') low_stock?: string,
  ) {
    return this.pos.products(user, { q, category_id, active, page_id, low_stock });
  }

  @Get('products/:id')
  product(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    return this.pos.product(user, id);
  }

  @Post('products')
  createProduct(@PortalUser() user: PortalJwtPayload, @Body() body: ProductInput) {
    return this.pos.createProduct(user, body ?? ({} as ProductInput));
  }

  @Patch('products/:id')
  updateProduct(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: ProductInput) {
    return this.pos.updateProduct(user, id, body ?? ({} as ProductInput));
  }

  @Post('products/:id/active')
  setActive(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { active?: boolean }) {
    return this.pos.setProductActive(user, id, body?.active !== false);
  }

  @Post('products/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2_000_000 } }))
  importProducts(
    @PortalUser() user: PortalJwtPayload,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body() body: { csv?: string; page_id?: string },
  ) {
    const csv = file?.buffer ? file.buffer.toString('utf8') : String(body?.csv ?? '');
    return this.pos.importProducts(user, csv, body?.page_id ?? '');
  }

  @Post('stock/move')
  moveStock(
    @PortalUser() user: PortalJwtPayload,
    @Body() body: { variant_id?: string; kind?: string; qty?: number; note?: string },
  ) {
    return this.pos.moveStock(user, body ?? {});
  }

  @Get('stock/ledger')
  ledger(@PortalUser() user: PortalJwtPayload, @Query('variant_id') variantId?: string) {
    return this.pos.ledger(user, variantId);
  }

  @Get('orders')
  orders(
    @PortalUser() user: PortalJwtPayload,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page_id') page_id?: string,
    @Query('staff') staff?: string,
    @Query('source') source?: string,
    @Query('carrier') carrier?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.pos.orders(user, { status, q, page_id, staff, source, carrier, from, to, limit, offset });
  }

  @Get('orders/:id')
  order(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    return this.pos.order(user, id);
  }

  @Post('orders')
  createOrder(@PortalUser() user: PortalJwtPayload, @Body() body: OrderInput & { confirm?: boolean }) {
    return this.pos.createOrder(user, body ?? ({ items: [] } as OrderInput));
  }

  @Patch('orders/:id')
  updateOrder(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: Partial<OrderInput>) {
    return this.pos.updateOrder(user, id, body ?? {});
  }

  @Post('orders/:id/status')
  changeStatus(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { status?: string; note?: string },
  ) {
    return this.pos.changeStatus(user, id, String(body?.status ?? ''), String(body?.note ?? ''));
  }

  @Post('orders/:id/quote')
  quote(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { account_id?: string; carrier?: string; service_code?: string },
  ) {
    return this.pos.quote(user, id, body ?? {});
  }

  @Post('orders/:id/ship')
  ship(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { account_id?: string; carrier?: string; service_code?: string; service_name?: string },
  ) {
    return this.pos.ship(user, id, body ?? {});
  }

  @Post('orders/:id/cancel-shipment')
  cancelShipment(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { shipment_id?: string },
  ) {
    return this.pos.cancelShipment(user, id, body?.shipment_id);
  }

  @Get('customers')
  customers(@PortalUser() user: PortalJwtPayload, @Query('q') q?: string) {
    return this.pos.customers(user, q);
  }

  @Get('customers/by-phone')
  customerByPhone(@PortalUser() user: PortalJwtPayload, @Query('phone') phone?: string) {
    return this.pos.customer(user, String(phone ?? ''));
  }

  @Get('customers/:phone')
  customer(@PortalUser() user: PortalJwtPayload, @Param('phone') phone: string) {
    return this.pos.customer(user, phone);
  }

  @Post('customers/:phone/blacklist')
  blacklist(
    @PortalUser() user: PortalJwtPayload,
    @Param('phone') phone: string,
    @Body() body: { blacklist?: boolean; notes?: string },
  ) {
    return this.pos.setBlacklist(user, phone, body?.blacklist !== false, body?.notes);
  }

  @Get('warning')
  warning(@PortalUser() user: PortalJwtPayload, @Query('phone') phone?: string) {
    return this.pos.customerWarning(user, String(phone ?? ''));
  }

  @Get('carriers')
  carriers(@PortalUser() user: PortalJwtPayload) {
    return this.pos.carriers(user);
  }

  @Post('carriers')
  upsertCarrier(
    @PortalUser() user: PortalJwtPayload,
    @Body() body: {
      id?: string; carrier?: string; label?: string; shop_id?: string;
      extra?: Record<string, unknown>; test_mode?: boolean; active?: boolean; token?: string;
    },
  ) {
    return this.pos.upsertCarrier(user, body ?? {});
  }

  @Get('cod')
  listCod(@PortalUser() user: PortalJwtPayload) {
    return this.pos.listCod(user);
  }

  @Get('cod/:id')
  getCod(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    return this.pos.getCod(user, id);
  }

  @Post('cod/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2_000_000 } }))
  importCod(
    @PortalUser() user: PortalJwtPayload,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body() body: { csv?: string; carrier?: string; period?: string },
  ) {
    const csv = file?.buffer ? file.buffer.toString('utf8') : String(body?.csv ?? '');
    return this.pos.importCod(user, csv, { carrier: body?.carrier, period: body?.period, filename: file?.originalname });
  }

  @Post('cod/payout')
  payout(
    @PortalUser() user: PortalJwtPayload,
    @Body() body: { tracking_code?: string; order_code?: string; actual_cod?: number; fee_vnd?: number; payout_vnd?: number; carrier?: string },
  ) {
    return this.pos.recordPayout(user, body ?? {});
  }

  @Get('reports/sales')
  sales(@PortalUser() user: PortalJwtPayload, @Query('range') range?: string) {
    return this.pos.salesReport(user, String(range ?? '7d'));
  }
}

/** Carrier webhooks are unauthenticated (carriers cannot hold a portal JWT). */
@Controller('api/portal/pos/webhooks')
export class PortalPosWebhookController {
  constructor(private readonly pos: PortalPosService) {}

  @Post('ghn')
  ghn(@Body() body: Record<string, unknown>) {
    return this.pos.handleWebhook('ghn', body ?? {});
  }

  @Post('ghtk')
  ghtk(@Body() body: Record<string, unknown>) {
    return this.pos.handleWebhook('ghtk', body ?? {});
  }

  @Post('vtp')
  vtp(@Body() body: Record<string, unknown>) {
    return this.pos.handleWebhook('vtp', body ?? {});
  }
}
