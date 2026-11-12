import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PortalClientPagesService } from '../agency/portal-client-pages.service';
import { portalCrmCareEnabled } from '../agency/portal-client-pages.util';
import { PortalCareService } from './portal-care.service';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalJwtGuard, PortalUser } from './portal-jwt.guard';

@Controller('api/portal/crm')
@UseGuards(PortalJwtGuard)
export class PortalCrmController {
  constructor(
    private readonly pages: PortalClientPagesService,
    private readonly care: PortalCareService,
  ) {}

  @Get('summary')
  summary(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    return this.care.summary(user);
  }

  @Get('channels')
  channels(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    return this.care.channels(user);
  }

  @Get('live')
  live(@PortalUser() user: PortalJwtPayload, @Query('since') since?: string) {
    this.assertEnabled();
    return this.care.live(user, since);
  }

  @Get('desk')
  desk(
    @PortalUser() user: PortalJwtPayload,
    @Query('channel') channel?: string,
    @Query('page_id') pageId?: string,
    @Query('day') day?: string,
    @Query('label') label?: string,
    @Query('include_inactive') includeInactive?: string,
    @Query('sync') sync?: string,
  ) {
    this.assertEnabled();
    return this.care.desk(user, { channel, page_id: pageId, day, label, include_inactive: includeInactive, sync });
  }

  @Get('cases/:id')
  caseDetail(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.caseDetail(user, id);
  }

  @Post('cases/:id/receive')
  receive(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.receive(user, id);
  }

  @Post('cases/:id/assign')
  assign(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { user_id?: string }) {
    this.assertEnabled();
    return this.care.assign(user, id, String(body?.user_id ?? ''));
  }

  @Post('cases/:id/care')
  careFor(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.care(user, id);
  }

  @Post('cases/:id/purchase')
  purchase(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.purchase(user, id);
  }

  @Post('cases/:id/label')
  label(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { name?: string; color?: string }) {
    this.assertEnabled();
    return this.care.stickLabel(user, id, String(body?.name ?? ''), String(body?.color ?? ''));
  }

  @Post('cases/:id/customer')
  customer(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.confirmCustomer(user, id);
  }

  @Post('cases/:id/order')
  saveOrder(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { phone?: string; address?: string; product_id?: string; size?: string; color?: string },
  ) {
    this.assertEnabled();
    return this.care.saveOrder(user, id, body ?? {});
  }

  @Post('cases/:id/close-order')
  closeOrder(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { phone?: string; address?: string }) {
    this.assertEnabled();
    return this.care.closeOrder(user, id, body ?? {});
  }

  @Post('cases/:id/reply')
  reply(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { text?: string }) {
    this.assertEnabled();
    return this.care.reply(user, id, String(body?.text ?? ''));
  }

  @Post('cases/:id/send-product')
  sendProduct(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { product_id?: string }) {
    this.assertEnabled();
    return this.care.sendProduct(user, id, String(body?.product_id ?? ''));
  }

  @Post('pages/:pageId/posts')
  addPost(@PortalUser() user: PortalJwtPayload, @Param('pageId') pageId: string, @Body() body: { body?: string }) {
    this.assertEnabled();
    return this.care.addPost(user, pageId, String(body?.body ?? ''));
  }

  @Post('pages/:pageId/products')
  addProduct(
    @PortalUser() user: PortalJwtPayload,
    @Param('pageId') pageId: string,
    @Body() body: { name?: string; detail?: string; price_vnd?: number; image_url?: string; colors?: unknown; sizes?: unknown; options?: unknown },
  ) {
    this.assertEnabled();
    return this.care.addProduct(user, pageId, body ?? {});
  }

  @Patch('pages/:pageId/products/:productId')
  updateProduct(
    @PortalUser() user: PortalJwtPayload,
    @Param('pageId') pageId: string,
    @Param('productId') productId: string,
    @Body() body: { name?: string; detail?: string; price_vnd?: number; image_url?: string; colors?: unknown; sizes?: unknown; options?: unknown; active?: boolean },
  ) {
    this.assertEnabled();
    return this.care.updateProduct(user, pageId, productId, body ?? {});
  }

  @Delete('pages/:pageId/products/:productId')
  removeProduct(@PortalUser() user: PortalJwtPayload, @Param('pageId') pageId: string, @Param('productId') productId: string) {
    this.assertEnabled();
    return this.care.removeProduct(user, pageId, productId);
  }

  @Post('product-images')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2_000_000 } }))
  uploadImage(
    @PortalUser() user: PortalJwtPayload,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    this.assertEnabled();
    return this.care.saveProductImage(user, file);
  }

  @Post('labels')
  addLabel(@PortalUser() user: PortalJwtPayload, @Body() body: { name?: string; color?: string }) {
    this.assertEnabled();
    return this.care.addLabel(user, String(body?.name ?? ''), String(body?.color ?? ''));
  }

  @Get('staff')
  listStaff(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    return this.care.listManagedStaff(user);
  }

  @Post('staff')
  addStaff(@PortalUser() user: PortalJwtPayload, @Body() body: { email?: string; password?: string }) {
    this.assertEnabled();
    return this.care.addStaff(user, String(body?.email ?? ''), String(body?.password ?? ''));
  }

  @Patch('staff/:id')
  setStaffActive(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { active?: boolean }) {
    this.assertEnabled();
    return this.care.setStaffActive(user, id, body?.active !== false);
  }

  @Get('pages')
  async listPages(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    const rows = await this.pages.listForPortal(user.client_id);
    return { ok: true, enabled: true, client_id: user.client_id, pages: rows };
  }

  @Get('pages/:pageId')
  async workspace(@PortalUser() user: PortalJwtPayload, @Param('pageId') pageId: string) {
    this.assertEnabled();
    return this.pages.workspace(user.client_id, pageId);
  }

  @Post('pages/:pageId/sync')
  async syncPage(
    @PortalUser() user: PortalJwtPayload,
    @Param('pageId') pageId: string,
    @Body() body?: { reset?: boolean },
  ) {
    this.assertEnabled();
    return this.care.syncPage(user, pageId, body ?? {});
  }

  @Post('pages/:pageId/leads')
  async createLead(
    @PortalUser() user: PortalJwtPayload,
    @Param('pageId') pageId: string,
    @Body() body: { full_name?: string; phone?: string; email?: string; campaign_name?: string },
  ) {
    this.assertEnabled();
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'approver_only' });
    }
    const lead = await this.pages.createLead(user.client_id, pageId, body ?? {});
    return { ok: true, lead };
  }

  @Post('cases/:id/read')
  markRead(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.markRead(user, id);
  }

  @Post('cases/:id/notes')
  saveNotes(@PortalUser() user: PortalJwtPayload, @Param('id') id: string, @Body() body: { notes?: string }) {
    this.assertEnabled();
    return this.care.saveNotes(user, id, String(body?.notes ?? ''));
  }

  @Post('cases/:id/create-lead')
  createLeadFromCase(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { full_name?: string; phone?: string; email?: string },
  ) {
    this.assertEnabled();
    return this.care.createLeadFromCase(user, id, body ?? {});
  }

  @Get('quick-replies')
  listQuickReplies(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    return this.care.listQuickReplies(user);
  }

  @Post('quick-replies')
  addQuickReply(
    @PortalUser() user: PortalJwtPayload,
    @Body() body: { shortcut?: string; title?: string; body?: string },
  ) {
    this.assertEnabled();
    return this.care.addQuickReply(user, body ?? {});
  }

  @Patch('quick-replies/:id')
  updateQuickReply(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { shortcut?: string; title?: string; body?: string; sort_order?: number },
  ) {
    this.assertEnabled();
    return this.care.updateQuickReply(user, id, body ?? {});
  }

  @Delete('quick-replies/:id')
  removeQuickReply(@PortalUser() user: PortalJwtPayload, @Param('id') id: string) {
    this.assertEnabled();
    return this.care.removeQuickReply(user, id);
  }

  @Post('quick-replies/reorder')
  reorderQuickReplies(@PortalUser() user: PortalJwtPayload, @Body() body: { ids?: string[] }) {
    this.assertEnabled();
    return this.care.reorderQuickReplies(user, Array.isArray(body?.ids) ? body.ids : []);
  }

  @Get('inbox-settings')
  inboxSettings(@PortalUser() user: PortalJwtPayload) {
    this.assertEnabled();
    return this.care.inboxSettings(user);
  }

  @Patch('inbox-settings')
  saveInboxSettings(
    @PortalUser() user: PortalJwtPayload,
    @Body() body: { auto_hide_phone_comments?: boolean },
  ) {
    this.assertEnabled();
    return this.care.saveInboxSettings(user, body?.auto_hide_phone_comments === true);
  }

  @Get('comments')
  comments(
    @PortalUser() user: PortalJwtPayload,
    @Query('page_id') pageId?: string,
    @Query('sync') sync?: string,
  ) {
    this.assertEnabled();
    return this.care.comments(user, { page_id: pageId, sync });
  }

  @Post('comments/:id/reply')
  replyToComment(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { text?: string; mode?: string },
  ) {
    this.assertEnabled();
    return this.care.replyToComment(user, id, body ?? {});
  }

  @Post('comments/:id/hide')
  hideComment(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { hidden?: boolean },
  ) {
    this.assertEnabled();
    return this.care.hideComment(user, id, body?.hidden !== false);
  }

  @Post('comments/:id/create-lead')
  createLeadFromComment(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: { full_name?: string; phone?: string; email?: string },
  ) {
    this.assertEnabled();
    return this.care.createLeadFromComment(user, id, body ?? {});
  }

  @Get('inbox-report')
  inboxReport(@PortalUser() user: PortalJwtPayload, @Query('range') range?: string) {
    this.assertEnabled();
    return this.care.inboxReport(user, String(range ?? 'today'));
  }

  private assertEnabled(): void {
    if (!portalCrmCareEnabled()) {
      throw new NotFoundException({ error: 'module_disabled' });
    }
  }
}
