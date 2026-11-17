import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AgencyRepository } from '../agency/agency.repository';
import { MetaBusinessTokenService } from '../agency/meta-business-token.service';
import { PortalClientPagesService } from '../agency/portal-client-pages.service';
import { PortalClientPage } from '../agency/portal-client-pages.types';
import { PortalClientUsersService } from '../agency/portal-client-users.service';
import { normalizeProductSpec } from './portal-product.util';
import { pullFacebookPage, sendFacebookText } from './portal-page-inbox.util';
import { PortalJwtPayload } from './portal-jwt.util';
import { assertNotViewer } from './portal-viewer.util';
import { PortalCareRepository, psidFromMessageThreadKey } from './portal-care.repository';
import { PortalCareRebalanceService } from './portal-care-rebalance.service';
import { PortalCareNotifyService } from './portal-care-notify.service';
import { parsePortalStaffInput, parsePortalStaffPatch } from './portal-staff.util';
import {
  careDueAt,
  careListFilterForUser,
  displayVnPhone,
  extractContacts,
  filterCasesForPortalList,
  filterVisiblePages,
  isPortalOwnerRole,
  pageInScope,
  receiveDueAt,
  scopePageIds,
  staffCanViewCareCase,
  visibleAdsChannels,
  type PortalPageScope,
} from './portal-care.util';

import { channelLabel, sanitizeFunnelFilter, type LeadFunnelFilter } from './portal-lead-funnel.util';
import {
  isFacebookRateOrThrottleError,
  KeyedSingleFlight,
  portalOnDemandTtlMs,
  shouldReuseFreshSync,
} from './portal-inbox-poller.util';
import { shouldPauseGraph } from './portal-graph-usage';
import { PortalInboxSyncService, type PortalInboxIngestResult } from './portal-inbox-sync.service';
import {
  commentsToAutoHide,
  hideFacebookComment,
  pullFacebookComments,
  replyFacebookComment,
} from './portal-page-comments.util';

export type { PortalInboxIngestResult } from './portal-inbox-sync.service';

function liveSince(raw?: string): Date {
  const date = new Date(String(raw ?? ''));
  const oldest = Date.now() - 24 * 60 * 60 * 1000;
  if (Number.isNaN(date.getTime())) return new Date(Date.now() - 5_000);
  if (date.getTime() < oldest) return new Date(oldest);
  if (date.getTime() > Date.now()) return new Date();
  return date;
}

@Injectable()
export class PortalCareService {
  private readonly inboxAt = new Map<string, number>();
  private readonly commentsAt = new Map<string, number>();
  private readonly ingestFlights = new KeyedSingleFlight();
  private readonly commentFlights = new KeyedSingleFlight();
  private readonly inboxStat = new Map<
    string,
    { pages: number; withToken: number; leads: number; messages: number; leadNote: string; messageNote: string; error: string }
  >();

  constructor(
    private readonly repo: PortalCareRepository,
    private readonly pages: PortalClientPagesService,
    private readonly agency: AgencyRepository,
    private readonly users: PortalClientUsersService,
    private readonly meta: MetaBusinessTokenService,
    private readonly inboxSync: PortalInboxSyncService,
    private readonly rebalancer: PortalCareRebalanceService,
    @Optional() private readonly careNotify?: PortalCareNotifyService,
  ) {}

  async channels(user: PortalJwtPayload) {
    const accounts = await this.agency.listChannelAccounts(user.client_id);
    return {
      channels: visibleAdsChannels(accounts.map((row) => row.channel)).map((item) => ({
        id: item.id,
        label: item.label,
      })),
    };
  }

  async live(user: PortalJwtPayload, sinceRaw?: string) {
    await this.repo.ensure();
    const since = liveSince(sinceRaw);
    const scope = careListFilterForUser(user, await this.pageScope(user));
    const messages = await this.repo.messagesSince(user.client_id, since, scope);
    const inbound = messages.filter((row) => row.direction !== 'out' && row.sender_name);
    if (inbound.length) {
      await this.repo.syncCases(user.client_id);
      await this.rebalancer.rebalance(user.client_id);
    }
    const touched = messages.filter((row) => row.sender_name || row.sender_psid);
    const cases = touched.length
      ? await this.repo.casesForSenders(
          user.client_id,
          touched.map((row) => ({
            page_id: row.page_id,
            sender_psid: row.sender_psid,
            sender_name: row.sender_name,
          })),
          scope,
        )
      : [];
    return {
      ok: true,
      server_time: new Date().toISOString(),
      messages,
      cases: cases.map((row) => ({
        id: row.id,
        page_id: row.page_id,
        kind: row.kind,
        title: row.title,
        assignee_user_id: row.assignee_user_id,
        assignee_email: row.assignee_email,
        status: row.status,
        labels: row.labels,
        customer_id: row.customer_id,
        receive_due_at: row.receive_due_at,
        care_due_at: row.care_due_at,
        created_at: row.created_at,
        snippet: row.snippet,
      })),
    };
  }

  async summary(user: PortalJwtPayload) {
    await this.prepare(user.client_id);
    const pageScope = await this.pageScope(user);
    const counts = await this.repo.summary(user.client_id, careListFilterForUser(user, pageScope));
    const pages = await this.visiblePagesFor(user, pageScope);
    return {
      ok: true,
      ...counts,
      pages: pages.map((page) => ({ page_id: page.page_id, page_name: page.page_name, channel: page.channel })),
      page_scope: { all: pageScope.all, count: pages.length },
    };
  }

  async desk(user: PortalJwtPayload, query: { channel?: string; page_id?: string; day?: string; label?: string; include_inactive?: string; sync?: string }) {
    await this.prepare(user.client_id);
    if (query.sync === '1' || query.sync === 'true') {
      await this.ingestFacebook(user.client_id);
    }
    const accounts = await this.agency.listChannelAccounts(user.client_id);
    const channels = visibleAdsChannels(accounts.map((row) => row.channel));
    const selected = query.channel ? channels.find((item) => item.id === query.channel) ?? null : null;
    const pageScope = await this.pageScope(user);
    const pages = (await this.visiblePagesFor(user, pageScope)).filter((page) => {
      if (!selected) return true;
      return selected.pageChannels.includes(page.channel);
    });
    const pageId = query.page_id && pages.some((page) => page.page_id === query.page_id) ? query.page_id : '';
    const filter = { pageId: pageId || undefined, day: query.day, label: query.label, ...careListFilterForUser(user, pageScope) };
    const scopedPageIds = scopePageIds(pageScope);
    const includeInactive = user.role !== 'staff' && query.include_inactive === '1';
    const [leads, messages, customers, posts, products, labels, staff, quickReplies] = await Promise.all([
      this.repo.listCases(user.client_id, { ...filter, kind: 'lead' }),
      this.repo.listCases(user.client_id, { ...filter, kind: 'message' }),
      this.repo.listCustomers(user.client_id, filter),
      this.repo.listPosts(user.client_id, pageId || undefined),
      this.repo.listProducts(user.client_id, pageId || undefined, { includeInactive }),
      this.repo.listLabels(user.client_id),
      // Only the account owner needs the staff list (manual assign); never send emails to staff/viewer.
      isPortalOwnerRole(user.role) ? this.repo.listStaff(user.client_id) : Promise.resolve([]),
      this.repo.listQuickReplies(user.client_id),
    ]);
    const pageIds = new Set(pages.map((page) => page.page_id));
    const onChannel = <T extends { page_id: string }>(rows: T[]) => rows.filter((row) => pageIds.has(row.page_id));
    return {
      ok: true,
      channels,
      channel: selected?.id ?? '',
      pages: pages.map((page) => ({ id: page.id, page_id: page.page_id, page_name: page.page_name, channel: page.channel })),
      posts: onChannel(posts),
      products: onChannel(products),
      labels,
      leads: filterCasesForPortalList(leads, user, pageIds),
      messages: filterCasesForPortalList(messages, user, pageIds),
      customers: filterCasesForPortalList(customers, user, pageIds),
      staff,
      quick_replies: quickReplies,
      me: {
        id: user.sub,
        role: user.role,
        all_pages: pageScope.all,
        page_count: scopedPageIds === undefined ? pages.length : scopedPageIds.length,
      },
      inbox:
        this.inboxStat.get(user.client_id) ?? {
          pages: pages.length,
          withToken: 0,
          leads: 0,
          messages: 0,
          leadNote: '',
          messageNote: '',
          error: '',
        },
    };
  }

  async caseDetail(user: PortalJwtPayload, caseId: string) {
    await this.prepare(user.client_id);
    const pageScope = await this.pageScope(user);
    const row = await this.requireVisibleCase(user, caseId, pageScope);
    const psid = row.kind === 'message' ? psidFromMessageThreadKey(row.page_id, row.thread_key) : '';
    const senderName = row.kind === 'message' ? row.title : '';
    const [messages, products] = await Promise.all([
      row.kind === 'message'
        ? this.repo.listMessages(user.client_id, row.page_id, { psid, senderName })
        : Promise.resolve([]),
      this.repo.listProducts(user.client_id, row.page_id),
    ]);
    const threadText = messages.map((item) => item.body).join('\n');
    const detected = extractContacts(`${row.snippet || ''}\n${row.order.phone}\n${threadText}\n${row.phone || ''}\n${row.notes || ''}`);
    const linkedLeads = await this.repo.findLeadsByPhones(
      user.client_id,
      [...detected.phones, row.order.phone, row.phone].filter(Boolean),
      scopePageIds(pageScope),
    );
    return {
      ok: true,
      case: row,
      messages,
      products,
      psid,
      detected: {
        phones: detected.phones.map(displayVnPhone),
        emails: detected.emails,
      },
      linked_leads: linkedLeads,
    };
  }

  async markRead(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireVisibleCase(user, caseId);
    // Staff opening a teammate's case on the same Page must not clear the assignee's unread flag;
    // a viewer is read-only and never clears it either.
    if (user.role === 'viewer' || !staffCanViewCareCase(user, row.assignee_user_id)) return { ok: true, skipped: true };
    await this.repo.markRead(row.id, user.sub);
    return { ok: true };
  }

  async saveNotes(user: PortalJwtPayload, caseId: string, notes: string) {
    const row = await this.requireActor(user, caseId);
    const value = String(notes ?? '').trim().slice(0, 4000);
    await this.repo.saveNotes(row.id, value);
    return { ok: true, notes: value };
  }

  async createLeadFromCase(
    user: PortalJwtPayload,
    caseId: string,
    body: { full_name?: string; phone?: string; email?: string },
  ) {
    const row = await this.requireActor(user, caseId);
    const phone = displayVnPhone(String(body.phone ?? '').trim()).slice(0, 32);
    if (!phone) throw new BadRequestException({ error: 'Cần số điện thoại để tạo Lead.' });
    const fullName = String(body.full_name ?? row.title ?? '').trim().slice(0, 200) || 'Khách hộp thư';
    const email = String(body.email ?? '').trim().slice(0, 200);
    const lead = await this.repo.insertInboxLead(user.client_id, row.page_id, {
      external_id: `inbox:${row.id}`,
      full_name: fullName,
      phone,
      email,
    });
    await this.repo.syncCases(user.client_id);
    await this.rebalancer.rebalance(user.client_id);
    return { ok: true, lead };
  }

  async listQuickReplies(user: PortalJwtPayload) {
    await this.repo.ensure();
    const items = await this.repo.listQuickReplies(user.client_id);
    return { ok: true, quick_replies: items };
  }

  async addQuickReply(user: PortalJwtPayload, body: { shortcut?: string; title?: string; body?: string }) {
    assertNotViewer(user);
    await this.repo.ensure();
    const shortcut = this.normalizeShortcut(body.shortcut);
    const text = String(body.body ?? '').trim().slice(0, 2000);
    if (!text) throw new BadRequestException({ error: 'Cần nội dung mẫu.' });
    const title = String(body.title ?? '').trim().slice(0, 80) || shortcut;
    const item = await this.repo.insertQuickReply(user.client_id, { shortcut, title, body: text });
    return { ok: true, quick_reply: item };
  }

  async updateQuickReply(
    user: PortalJwtPayload,
    id: string,
    body: { shortcut?: string; title?: string; body?: string; sort_order?: number },
  ) {
    assertNotViewer(user);
    await this.repo.ensure();
    const patch: { shortcut?: string; title?: string; body?: string; sort_order?: number } = {};
    if (body.shortcut !== undefined) patch.shortcut = this.normalizeShortcut(body.shortcut);
    if (body.title !== undefined) patch.title = String(body.title ?? '').trim().slice(0, 80);
    if (body.body !== undefined) {
      const text = String(body.body ?? '').trim().slice(0, 2000);
      if (!text) throw new BadRequestException({ error: 'Cần nội dung mẫu.' });
      patch.body = text;
    }
    if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order);
    const item = await this.repo.updateQuickReply(user.client_id, id, patch);
    if (!item) throw new NotFoundException({ error: 'quick_reply_not_found' });
    return { ok: true, quick_reply: item };
  }

  async removeQuickReply(user: PortalJwtPayload, id: string) {
    assertNotViewer(user);
    await this.repo.ensure();
    const removed = await this.repo.deleteQuickReply(user.client_id, id);
    if (!removed) throw new NotFoundException({ error: 'quick_reply_not_found' });
    return { ok: true };
  }

  private normalizeShortcut(raw: unknown): string {
    const shortcut = String(raw ?? '')
      .trim()
      .replace(/^\/+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40);
    if (!shortcut) throw new BadRequestException({ error: 'Cần phím tắt, ví dụ “chao”.' });
    return shortcut;
  }

  async receive(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.status !== 'waiting_receive') throw new BadRequestException({ error: 'not_waiting' });
    const assignTo = row.assignee_user_id ? undefined : user.sub;
    await this.repo.markReceived(row.id, assignTo);
    if (assignTo) {
      await this.careNotify?.notifyAssignment({
        clientId: user.client_id,
        caseId: row.id,
        assigneeId: assignTo,
        previousAssigneeId: null,
        reason: 'manual',
        title: row.title,
        kind: row.kind,
      });
    }
    return { ok: true, assigned: Boolean(assignTo) };
  }

  async assign(user: PortalJwtPayload, caseId: string, userId: string) {
    this.requireApprover(user);
    const targetId = userId.trim();
    const row = await this.requireCase(user, caseId);
    if (row.status === 'purchased') throw new BadRequestException({ error: 'already_purchased' });
    const previous = row.assignee_user_id ?? null;
    if (!targetId) {
      await this.repo.unassign(row.id);
      await this.careNotify?.notifyAssignment({
        clientId: user.client_id,
        caseId: row.id,
        assigneeId: null,
        previousAssigneeId: previous,
        reason: 'unassign',
        title: row.title,
        kind: row.kind,
      });
      await this.rebalancer.rebalance(user.client_id);
      return { ok: true, unassigned: true };
    }
    const target = await this.repo.findActiveClientUser(user.client_id, targetId);
    if (!target) throw new NotFoundException({ error: 'user_not_found' });
    const targetPages = await this.repo.listUserPageIds(user.client_id, targetId);
    if (!targetPages.includes(row.page_id)) {
      throw new BadRequestException({
        error: 'staff_page_not_assigned',
        message: 'Nhân viên này chưa được phân Page của hội thoại/Lead này.',
      });
    }
    const now = new Date();
    const receiveDue = row.status === 'waiting_receive' ? receiveDueAt(now) : null;
    await this.repo.assignManual(row.id, targetId, receiveDue);
    await this.careNotify?.notifyAssignment({
      clientId: user.client_id,
      caseId: row.id,
      assigneeId: targetId,
      previousAssigneeId: previous,
      reason: 'manual',
      title: row.title,
      kind: row.kind,
    });
    return { ok: true };
  }

  async care(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.status === 'purchased') throw new BadRequestException({ error: 'already_purchased' });
    await this.repo.markCaring(row.id, careDueAt(new Date()));
    return { ok: true };
  }

  async purchase(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.status === 'purchased') throw new BadRequestException({ error: 'already_purchased' });
    await this.repo.markPurchased(row.id);
    let customerId = row.customer_id;
    if (!customerId) {
      customerId = await this.repo.confirmCustomer(row);
    }
    return { ok: true, customer_id: customerId || null };
  }

  async stickLabel(user: PortalJwtPayload, caseId: string, name: string, color = '') {
    const row = await this.requireActor(user, caseId);
    const label = name.trim().slice(0, 40);
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const labels = row.labels.includes(label) ? row.labels.filter((item) => item !== label) : [...row.labels, label];
    if (!row.labels.includes(label)) {
      await this.repo.insertLabel(user.client_id, label, color);
    }
    await this.repo.setLabels(row.id, labels);
    return { ok: true, labels };
  }

  async confirmCustomer(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.kind !== 'lead' && row.kind !== 'message') throw new BadRequestException({ error: 'customer_source' });
    const customerId = await this.repo.confirmCustomer(row);
    return { ok: true, customer_id: customerId };
  }

  async saveOrder(
    user: PortalJwtPayload,
    caseId: string,
    input: { phone?: string; address?: string; product_id?: string; size?: string; color?: string },
  ) {
    const row = await this.requireActor(user, caseId);
    const draft = { ...row.order };
    if (input.phone !== undefined) draft.phone = String(input.phone).trim().slice(0, 40);
    if (input.address !== undefined) draft.address = String(input.address).trim().slice(0, 200);
    const productId = String(input.product_id ?? '').trim();
    if (productId) {
      const product = await this.repo.findProduct(user.client_id, productId);
      if (!product || product.page_id !== row.page_id) throw new NotFoundException({ error: 'product_not_found' });
      const size = String(input.size ?? '').trim().slice(0, 40);
      if (product.spec.sizes.length && !product.spec.sizes.includes(size)) {
        throw new BadRequestException({ error: 'Chọn size trước khi xác nhận sản phẩm.' });
      }
      const color = String(input.color ?? '').trim().slice(0, 40);
      if (product.spec.colors.length > 1 && !product.spec.colors.some((item) => item.name === color)) {
        throw new BadRequestException({ error: 'Chọn màu trước khi xác nhận sản phẩm.' });
      }
      draft.product_id = product.id;
      draft.product_name = product.name;
      draft.size = size;
      draft.color = product.spec.colors.length === 1 ? product.spec.colors[0].name : color;
      draft.price_vnd = product.spec.price_vnd;
    }
    await this.repo.saveOrder(row.id, draft);
    return { ok: true, order: draft };
  }

  async closeOrder(user: PortalJwtPayload, caseId: string, input: { phone?: string; address?: string }) {
    const row = await this.requireActor(user, caseId);
    const phone = String(input.phone ?? row.order.phone).trim().slice(0, 40);
    const address = String(input.address ?? row.order.address).trim().slice(0, 200);
    if (!phone || !address) throw new BadRequestException({ error: 'Cần số điện thoại và địa chỉ để chốt đơn.' });
    const draft = { ...row.order, phone, address, closed: true };
    await this.repo.saveOrder(row.id, draft);
    const customerId = phone ? await this.repo.confirmCustomer({ ...row, order: draft }) : '';
    await this.repo.markPurchased(row.id);
    return { ok: true, customer_id: customerId };
  }

  async reply(user: PortalJwtPayload, caseId: string, text: string) {
    const row = await this.requireActor(user, caseId);
    if (row.kind !== 'message') throw new BadRequestException({ error: 'message_only' });
    const body = text.trim().slice(0, 2000);
    if (!body) throw new BadRequestException({ error: 'empty' });
    await this.deliverToCustomer(user.client_id, row, body);
    return { ok: true };
  }

  async sendProduct(user: PortalJwtPayload, caseId: string, productId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.kind !== 'message') throw new BadRequestException({ error: 'message_only' });
    const product = await this.repo.findProduct(user.client_id, productId);
    if (!product || product.page_id !== row.page_id || !product.active) throw new NotFoundException({ error: 'product_not_found' });
    const spec = product.spec;
    const price = spec.price_vnd ? `${new Intl.NumberFormat('vi-VN').format(spec.price_vnd)} đ` : '';
    const lines = [
      product.name,
      price,
      spec.colors.length ? `Màu: ${spec.colors.map((item) => item.name).join(', ')}` : '',
      spec.sizes.length ? `Size: ${spec.sizes.join(', ')}` : '',
      ...spec.options.map((item) => `${item.name}: ${item.values.join(', ')}`),
      product.detail,
    ].filter(Boolean);
    await this.deliverToCustomer(user.client_id, row, lines.join('\n'));
    return { ok: true };
  }

  private async deliverToCustomer(
    clientId: string,
    row: { id: string; page_id: string; thread_key: string; title: string },
    body: string,
  ): Promise<void> {
    const psid = await this.customerPsid(clientId, row);
    if (!psid) throw new BadRequestException({ error: 'Chưa lấy được mã khách trên Messenger. Mở lại hội thoại rồi gửi lại.' });
    const token = (await this.meta.pageTokens()).get(row.page_id);
    if (!token) throw new BadRequestException({ error: 'Page chưa có token để gửi tin cho khách.' });
    const sent = await sendFacebookText(row.page_id, token, psid, body);
    if (!sent.ok) throw new BadRequestException({ error: sent.error });
    await this.repo.insertOutbound(clientId, row.page_id, row.title, body, sent.id, psid);
    await this.repo.extendSla(row.id, receiveDueAt(new Date()), careDueAt(new Date()));
  }

  private async customerPsid(clientId: string, row: { page_id: string; thread_key: string; title: string }): Promise<string> {
    const fromKey = psidFromMessageThreadKey(row.page_id, row.thread_key);
    if (fromKey) return fromKey;
    const stored = await this.repo.latestSenderPsid(clientId, row.page_id, '', row.title);
    if (stored) return stored;
    const token = (await this.meta.pageTokens()).get(row.page_id);
    if (!token) return '';
    try {
      const pulled = await pullFacebookPage(row.page_id, token, { mode: 'incremental' });
      for (const message of pulled.messages) {
        await this.repo.upsertPageMessage(clientId, row.page_id, message);
      }
      await this.repo.syncCases(clientId);
      await this.rebalancer.rebalance(clientId);
    } catch {
      return '';
    }
    const afterSync = psidFromMessageThreadKey(row.page_id, row.thread_key);
    if (afterSync) return afterSync;
    return this.repo.latestSenderPsid(clientId, row.page_id, '', row.title);
  }

  async addPost(user: PortalJwtPayload, pageId: string, body: string) {
    this.requireManager(user);
    const text = body.trim().slice(0, 4000);
    if (!text) throw new BadRequestException({ error: 'post_required' });
    await this.repo.ensure();
    await this.ownPage(user, pageId);
    await this.repo.insertPost(user.client_id, pageId, text);
    return { ok: true };
  }

  async addProduct(
    user: PortalJwtPayload,
    pageId: string,
    input: { name?: string; detail?: string; price_vnd?: number; image_url?: string; colors?: unknown; sizes?: unknown; options?: unknown },
  ) {
    this.requireManager(user);
    const name = String(input.name ?? '').trim().slice(0, 200);
    if (!name) throw new BadRequestException({ error: 'product_name_required' });
    const spec = normalizeProductSpec(input);
    if (!spec.colors.length) throw new BadRequestException({ error: 'color_image_required' });
    await this.repo.ensure();
    await this.ownPage(user, pageId);
    await this.repo.insertProduct(user.client_id, pageId, name, spec.colors[0].image, String(input.detail ?? '').trim().slice(0, 4000), spec);
    return { ok: true };
  }

  async updateProduct(
    user: PortalJwtPayload,
    pageId: string,
    productId: string,
    input: { name?: string; detail?: string; price_vnd?: number; image_url?: string; colors?: unknown; sizes?: unknown; options?: unknown; active?: boolean },
  ) {
    this.requireManager(user);
    await this.repo.ensure();
    await this.ownPage(user, pageId);
    const existing = await this.repo.findProduct(user.client_id, productId);
    if (!existing || existing.page_id !== pageId) throw new NotFoundException({ error: 'product_not_found' });
    const patch: { name?: string; detail?: string; imageUrl?: string; spec?: ReturnType<typeof normalizeProductSpec>; active?: boolean } = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim().slice(0, 200);
      if (!name) throw new BadRequestException({ error: 'product_name_required' });
      patch.name = name;
    }
    if (input.detail !== undefined) patch.detail = String(input.detail).trim().slice(0, 4000);
    if (input.active !== undefined) patch.active = Boolean(input.active);
    const specInput =
      input.price_vnd !== undefined ||
      input.colors !== undefined ||
      input.sizes !== undefined ||
      input.options !== undefined ||
      input.image_url !== undefined;
    if (specInput) {
      const spec = normalizeProductSpec({
        price_vnd: input.price_vnd ?? existing.spec.price_vnd,
        image_url: input.image_url,
        colors: input.colors ?? existing.spec.colors,
        sizes: input.sizes ?? existing.spec.sizes,
        options: input.options ?? existing.spec.options,
      });
      if (!spec.colors.length) throw new BadRequestException({ error: 'color_image_required' });
      patch.spec = spec;
      patch.imageUrl = spec.colors[0].image;
    }
    const updated = await this.repo.updateProduct(user.client_id, pageId, productId, patch);
    if (!updated && Object.keys(patch).length > 0) throw new NotFoundException({ error: 'product_not_found' });
    return { ok: true };
  }

  async removeProduct(user: PortalJwtPayload, pageId: string, productId: string) {
    this.requireManager(user);
    await this.repo.ensure();
    await this.ownPage(user, pageId);
    const removed = await this.repo.deleteProduct(user.client_id, pageId, productId);
    if (!removed) throw new NotFoundException({ error: 'product_not_found' });
    return { ok: true };
  }

  async saveProductImage(user: PortalJwtPayload, file?: { buffer?: Buffer; mimetype?: string; size?: number; originalname?: string }) {
    this.requireManager(user);
    const mime = String(file?.mimetype ?? '').toLowerCase();
    const orig = String(file?.originalname ?? '').toLowerCase();
    const ext =
      mime === 'image/png' || orig.endsWith('.png') ? 'png'
      : mime === 'image/webp' || orig.endsWith('.webp') ? 'webp'
      : mime === 'image/jpeg' || mime === 'image/jpg' || orig.endsWith('.jpg') || orig.endsWith('.jpeg') ? 'jpg'
      : '';
    if (!file?.buffer?.length || !ext || (file.size ?? 0) > 2_000_000) {
      throw new BadRequestException({ error: 'image_file' });
    }
    const dir = join(process.cwd(), 'data', 'portal-product-images');
    mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    writeFileSync(join(dir, name), file.buffer);
    return { ok: true, url: `/api/portal/crm/media/${name}` };
  }

  async addLabel(user: PortalJwtPayload, name: string, color = '') {
    this.requireManager(user);
    const label = name.trim().slice(0, 40);
    if (!label) throw new BadRequestException({ error: 'label_required' });
    await this.repo.ensure();
    await this.repo.insertLabel(user.client_id, label, color);
    const labels = await this.repo.listLabels(user.client_id);
    return { ok: true, labels };
  }

  async addStaff(
    user: PortalJwtPayload,
    body: { email?: string; password?: string; name?: string; phone?: string; role?: string; page_ids?: unknown },
  ) {
    this.requireApprover(user);
    await this.repo.ensure();
    const parsed = parsePortalStaffInput(body);
    const pageIds = body.page_ids === undefined ? [] : await this.validStaffPageIds(user.client_id, body.page_ids);
    const created = await this.users.create(user.client_id, {
      email: parsed.email,
      password: parsed.password,
      role: parsed.role,
      display_name: parsed.name,
      phone: parsed.phone,
      send_email: false,
    });
    if (body.page_ids !== undefined) {
      await this.repo.setUserPageIds(user.client_id, created.user.id, pageIds);
      if (pageIds.length) await this.rebalancer.rebalance(user.client_id);
    }
    return {
      ok: true,
      user: {
        id: created.user.id,
        email: created.user.email,
        role: created.user.role,
        display_name: created.user.display_name ?? parsed.name,
        phone: created.user.phone ?? parsed.phone,
        active: created.user.active,
        page_ids: pageIds,
      },
      ...(created.temporary_password ? { temporary_password: created.temporary_password } : {}),
    };
  }

  async listManagedStaff(user: PortalJwtPayload) {
    // Staff emails and Page assignments are owner-only (t350u).
    this.requireApprover(user);
    await this.repo.ensure();
    const [staff, pages] = await Promise.all([
      this.repo.listManagedStaff(user.client_id),
      this.allVisiblePages(user.client_id),
    ]);
    return {
      ok: true,
      staff,
      pages: pages.map((page) => ({ page_id: page.page_id, page_name: page.page_name, channel: page.channel })),
    };
  }

  async syncPage(user: PortalJwtPayload, pageId: string, body?: { reset?: boolean }) {
    assertNotViewer(user);
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'approver_only' });
    }
    await this.ownPage(user, pageId);
    await this.pages.ensureStore();
    await this.repo.ensure();
    const token = (await this.meta.pageTokens()).get(pageId);
    if (!token) {
      throw new BadRequestException({ error: 'Page chưa có token Business Manager để đồng bộ.' });
    }
    const stored = body?.reset ? { conv_after: '', form_after: '' } : await this.repo.getInboxCursors(user.client_id, pageId);
    const pulled = await pullFacebookPage(pageId, token, {
      mode: 'backfill',
      cursors: stored,
    });
    for (const lead of pulled.leads) {
      await this.repo.upsertPageLead(user.client_id, pageId, lead);
    }
    for (const message of pulled.messages) {
      await this.repo.upsertPageMessage(user.client_id, pageId, message);
    }
    const cursors = pulled.hasMore ? pulled.cursors : { conv_after: '', form_after: '' };
    await this.repo.saveInboxCursors(user.client_id, pageId, cursors);
    await this.repo.syncCases(user.client_id);
    await this.rebalancer.rebalance(user.client_id);
    this.inboxAt.delete(user.client_id);
    return {
      ok: true,
      page_id: pageId,
      leads: pulled.leads.length,
      messages: pulled.messages.length,
      hops: pulled.hops,
      has_more: pulled.hasMore,
      cursors,
      lead_error: pulled.leadError,
      message_error: pulled.messageError,
    };
  }

  async setStaffActive(user: PortalJwtPayload, userId: string, active: boolean) {
    this.requireApprover(user);
    if (userId === user.sub) throw new BadRequestException({ error: 'cannot_change_self' });
    const staff = await this.repo.listManagedStaff(user.client_id);
    if (!staff.some((row) => row.id === userId)) throw new NotFoundException({ error: 'staff_not_found' });
    const updated = await this.users.update(user.client_id, userId, { active });
    if (!active) {
      await this.repo.releaseOpenCasesForUser(user.client_id, userId);
      await this.rebalancer.rebalance(user.client_id);
    }
    return { ok: true, user: { id: updated.id, email: updated.email, active: updated.active } };
  }



  async updateStaff(
    user: PortalJwtPayload,
    userId: string,
    body: {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      active?: boolean;
      reset_password?: boolean;
      password?: string;
      page_ids?: unknown;
    },
  ) {
    this.requireApprover(user);
    if (userId === user.sub) {
      throw new BadRequestException({
        error: 'cannot_change_self',
        message: 'Không thể sửa hoặc xóa chính bạn.',
      });
    }
    await this.repo.ensure();
    const staff = await this.repo.listManagedStaff(user.client_id);
    const target = staff.find((row) => row.id === userId);
    if (!target) throw new NotFoundException({ error: 'staff_not_found' });

    const parsed = parsePortalStaffPatch(body);
    const wantsActive = typeof body.active === 'boolean';
    const wantsProfile =
      parsed.name !== undefined ||
      parsed.email !== undefined ||
      parsed.phone !== undefined ||
      parsed.role !== undefined;
    const wantsReset = parsed.reset_password;
    const wantsPages = body.page_ids !== undefined;
    const pageIds = wantsPages ? await this.validStaffPageIds(user.client_id, body.page_ids) : [];

    if (!wantsActive && !wantsProfile && !wantsReset && !wantsPages) {
      throw new BadRequestException({ error: 'no_updates' });
    }

    let released = 0;
    if (wantsProfile || wantsActive) {
      await this.users.update(user.client_id, userId, {
        ...(parsed.name !== undefined ? { display_name: parsed.name } : {}),
        ...(parsed.email !== undefined ? { email: parsed.email } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
        ...(parsed.role !== undefined ? { role: parsed.role } : {}),
        ...(wantsActive ? { active: body.active } : {}),
      });
      if (wantsActive && body.active === false) {
        released = await this.repo.releaseOpenCasesForUser(user.client_id, userId);
        await this.rebalancer.rebalance(user.client_id);
      }
    }

    if (wantsPages) {
      await this.repo.setUserPageIds(user.client_id, userId, pageIds);
      // Releases cases this person holds on Pages they no longer have, then reassigns per Page.
      await this.rebalancer.rebalance(user.client_id);
    }

    let temporaryPassword: string | undefined;
    if (wantsReset) {
      const reset = await this.users.resetPassword(user.client_id, userId, {
        ...(parsed.password ? { password: parsed.password } : {}),
        send_email: false,
      });
      temporaryPassword = reset.temporary_password;
    }

    const fresh = (await this.repo.listManagedStaff(user.client_id)).find((row) => row.id === userId);
    return {
      ok: true,
      user: fresh ?? {
        id: userId,
        email: parsed.email ?? target.email,
        role: parsed.role ?? target.role,
        display_name: parsed.name ?? target.display_name,
        phone: parsed.phone ?? target.phone,
        active: wantsActive ? Boolean(body.active) : target.active,
        page_ids: wantsPages ? pageIds : target.page_ids,
      },
      ...(temporaryPassword ? { temporary_password: temporaryPassword } : {}),
      ...(released ? { released } : {}),
    };
  }

  /** Safe removal: release open cases to the auto-assign queue, then soft-delete (keep history). */
  async removeStaff(user: PortalJwtPayload, userId: string) {
    this.requireApprover(user);
    if (userId === user.sub) {
      throw new BadRequestException({
        error: 'cannot_change_self',
        message: 'Không thể sửa hoặc xóa chính bạn.',
      });
    }
    await this.repo.ensure();
    const staff = await this.repo.listManagedStaff(user.client_id);
    const target = staff.find((row) => row.id === userId);
    if (!target) throw new NotFoundException({ error: 'staff_not_found' });

    await this.users.update(user.client_id, userId, { active: false });
    const released = await this.repo.releaseOpenCasesForUser(user.client_id, userId);
    await this.users.softDelete(user.client_id, userId);
    await this.rebalancer.rebalance(user.client_id);
    return {
      ok: true,
      deleted: true,
      released,
      user: { id: target.id, email: target.email },
    };
  }


  async reorderQuickReplies(user: PortalJwtPayload, ids: string[]) {
    assertNotViewer(user);
    await this.repo.ensure();
    const clean = ids.map((id) => String(id).trim()).filter(Boolean);
    if (!clean.length) throw new BadRequestException({ error: 'ids_required' });
    await this.repo.reorderQuickReplies(user.client_id, clean);
    const items = await this.repo.listQuickReplies(user.client_id);
    return { ok: true, quick_replies: items };
  }

  async inboxSettings(user: PortalJwtPayload) {
    await this.repo.ensure();
    const settings = await this.repo.getInboxSettings(user.client_id);
    return { ok: true, ...settings };
  }

  async saveInboxSettings(user: PortalJwtPayload, autoHide: boolean) {
    this.requireManager(user);
    await this.repo.ensure();
    const settings = await this.repo.saveInboxSettings(user.client_id, Boolean(autoHide), user.email);
    return { ok: true, ...settings };
  }

  async comments(
    user: PortalJwtPayload,
    query: { page_id?: string; sync?: string },
  ) {
    await this.prepare(user.client_id);
    // Viewer is read-only: never let it trigger a Graph pull or the auto-hide pass; serve cached rows.
    if ((query.sync === '1' || query.sync === 'true') && user.role !== 'viewer') {
      await this.ingestComments(user.client_id);
    }
    const pageId = String(query.page_id ?? '').trim();
    const pageScope = await this.pageScope(user);
    const scoped = scopePageIds(pageScope);
    const [posts, comments, sync, settings] = await Promise.all([
      this.repo.listFbPosts(user.client_id, pageId || undefined, scoped),
      this.repo.listComments(user.client_id, pageId || undefined, scoped),
      this.repo.getCommentSyncState(user.client_id),
      this.repo.getInboxSettings(user.client_id),
    ]);
    const pages = await this.visiblePagesFor(user, pageScope);
    const pageIds = new Set(pages.map((page) => page.page_id));
    return {
      ok: true,
      posts: posts.filter((row) => pageIds.has(row.page_id)),
      comments: comments.filter((row) => pageIds.has(row.page_id)),
      pages: pages.map((page) => ({ page_id: page.page_id, page_name: page.page_name })),
      page_scope: { all: pageScope.all, count: pages.length },
      permission_error: sync.permission_error,
      error: sync.last_error,
      last_synced_at: sync.last_synced_at,
      settings,
    };
  }

  private async ingestComments(clientId: string): Promise<void> {
    if (shouldPauseGraph()) return;
    const ttl = portalOnDemandTtlMs();
    if (shouldReuseFreshSync(this.commentsAt.get(clientId), Date.now(), ttl)) return;
    await this.commentFlights.run(clientId, async () => {
      if (shouldPauseGraph()) return;
      if (shouldReuseFreshSync(this.commentsAt.get(clientId), Date.now(), ttl)) return;
      const pages = (await this.visiblePages(clientId)).filter((page) => page.channel === 'facebook');
      const tokens = await this.meta.pageTokens();
      const settings = await this.repo.getInboxSettings(clientId);
      let permissionError = '';
      let lastError = '';
      for (const page of pages) {
        const token = tokens.get(page.page_id);
        if (!token) continue;
        if (shouldPauseGraph()) break;
        const pulled = await pullFacebookComments(page.page_id, token);
        if (pulled.permissionError && !permissionError) permissionError = pulled.permissionError;
        if (pulled.error && !pulled.permissionError && !lastError) lastError = pulled.error;
        for (const post of pulled.posts) {
          await this.repo.upsertFbPost(clientId, post);
        }
        for (const comment of pulled.comments) {
          await this.repo.upsertPageComment(clientId, comment);
        }
        // Auto-hide only when the client setting is ON. Default is OFF.
        // Guarded by Graph backoff. Do not invoke this path in live tests against real comments.
        if (settings.auto_hide_phone_comments) {
          for (const comment of commentsToAutoHide(pulled.comments)) {
            if (shouldPauseGraph()) break;
            const hidden = await hideFacebookComment(comment.comment_id, token, true);
            if (hidden.ok) await this.repo.markCommentHidden(clientId, comment.comment_id, true);
            else if (hidden.error && !lastError) lastError = hidden.error;
            if (hidden.permissionNeeded && !permissionError) {
              permissionError =
                'Token chưa có quyền ẩn bình luận (pages_manage_engagement). Tắt tự ẩn hoặc xin quyền này trên Meta App.';
            }
          }
        }
      }
      if (pages.length > 0 && pages.every((page) => !tokens.get(page.page_id)) && !lastError) {
        lastError = this.meta.getLastPageTokenError() || 'Page đã gắn nhưng chưa có token để đọc bình luận.';
      }
      await this.repo.saveCommentSyncState(clientId, {
        last_error: lastError,
        permission_error: permissionError,
        synced: true,
      });
      this.commentsAt.set(clientId, Date.now());
    });
  }

  async replyToComment(
    user: PortalJwtPayload,
    commentId: string,
    input: { text?: string; mode?: string },
  ) {
    const row = await this.requireComment(user, commentId);
    const text = String(input.text ?? '').trim().slice(0, 2000);
    if (!text) throw new BadRequestException({ error: 'Cần nội dung trả lời.' });
    const mode = input.mode === 'private' ? 'private' : 'public';
    const token = (await this.meta.pageTokens()).get(row.page_id);
    if (!token) throw new BadRequestException({ error: 'Page chưa có token để trả lời bình luận.' });
    const sent = await replyFacebookComment(row.comment_id, token, text, mode);
    if (!sent.ok) throw new BadRequestException({ error: sent.error, permission: sent.permissionNeeded });
    await this.repo.markCommentReplied(user.client_id, row.comment_id);
    return { ok: true, id: sent.id, mode };
  }

  async hideComment(user: PortalJwtPayload, commentId: string, hidden: boolean) {
    const row = await this.requireComment(user, commentId);
    const token = (await this.meta.pageTokens()).get(row.page_id);
    if (!token) throw new BadRequestException({ error: 'Page chưa có token để ẩn bình luận.' });
    const result = await hideFacebookComment(row.comment_id, token, hidden);
    if (!result.ok) throw new BadRequestException({ error: result.error, permission: result.permissionNeeded });
    await this.repo.markCommentHidden(user.client_id, row.comment_id, hidden);
    return { ok: true, is_hidden: hidden };
  }

  async createLeadFromComment(
    user: PortalJwtPayload,
    commentId: string,
    body: { full_name?: string; phone?: string; email?: string },
  ) {
    const row = await this.requireComment(user, commentId);
    const phone = displayVnPhone(String(body.phone ?? '').trim()).slice(0, 32);
    if (!phone) throw new BadRequestException({ error: 'Cần số điện thoại để tạo Lead.' });
    const fullName = String(body.full_name ?? row.from_name ?? '').trim().slice(0, 200) || 'Khách bình luận';
    const email = String(body.email ?? '').trim().slice(0, 200);
    const lead = await this.repo.insertInboxLead(user.client_id, row.page_id, {
      external_id: `comment:${row.comment_id}`,
      full_name: fullName,
      phone,
      email,
    });
    await this.repo.syncCases(user.client_id);
    await this.rebalancer.rebalance(user.client_id);
    return { ok: true, lead };
  }

  async inboxReport(user: PortalJwtPayload, range: string) {
    await this.repo.ensure();
    const days = range === '7d' || range === '7' ? 7 : 1;
    const start = this.rangeStart(days);
    const report = await this.repo.inboxReport(user.client_id, start, careListFilterForUser(user, await this.pageScope(user)));
    // Use every stored Page (including inactive) so the report can show names, not raw ids.
    const allPages = await this.pages.listForPortal(user.client_id);
    const names = new Map(allPages.map((page) => [page.page_id, String(page.page_name || '').trim()]));
    const pageLabel = (pageId: string, stored?: string) => {
      const name = (stored || names.get(pageId) || '').trim();
      if (name && name !== pageId && !/^\d{8,}$/.test(name)) return name;
      const tail = String(pageId || '').slice(-4);
      return tail ? `Page …${tail}` : 'Page';
    };
    return {
      ok: true,
      range: days === 7 ? '7d' : 'today',
      range_start: start.toISOString(),
      by_page: report.by_page.map((row) => ({ ...row, page_name: pageLabel(row.page_id) })),
      by_staff: report.by_staff,
    };
  }


  async leadFunnel(user: PortalJwtPayload, query: LeadFunnelFilter) {
    await this.repo.ensure();
    const filter = sanitizeFunnelFilter(query);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const report = await this.repo.leadFunnel(user.client_id, filter, {
      ...careListFilterForUser(user, await this.pageScope(user)),
      today,
    });
    const allPages = await this.pages.listForPortal(user.client_id);
    const names = new Map(allPages.map((page) => [page.page_id, String(page.page_name || '').trim()]));
    const pageLabel = (pageId: string) => {
      const name = (names.get(pageId) || '').trim();
      if (name && name !== pageId) return name;
      return pageId || 'Page';
    };
    return {
      ok: true,
      from: filter.from || '',
      to: filter.to || '',
      kpis: report.kpis,
      by_page: report.by_page.map((row) => ({ ...row, label: pageLabel(row.id) || row.label })),
      by_channel: report.by_channel.map((row) => ({ ...row, label: channelLabel(row.id) || row.label })),
      by_form: report.by_form,
      by_staff: report.by_staff,
    };
  }

  private rangeStart(days: number): Date {
    const now = new Date();
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const startLocal = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate(), 0, 0, 0, 0);
    if (days > 1) startLocal.setDate(startLocal.getDate() - (days - 1));
    // interpret that wall-clock as Asia/Ho_Chi_Minh (UTC+7)
    return new Date(startLocal.getTime() - (tzNow.getTime() - now.getTime()));
  }

  private async requireComment(user: PortalJwtPayload, commentId: string) {
    await this.repo.ensure();
    const row = await this.repo.findComment(user.client_id, commentId.trim());
    if (!row) throw new NotFoundException({ error: 'comment_not_found' });
    const pages = await this.visiblePagesFor(user);
    if (!pages.some((page) => page.page_id === row.page_id)) {
      // Out of the user's Page scope: same answer as a missing id (no existence leak).
      throw new NotFoundException({ error: 'comment_not_found' });
    }
    // requireComment is only used by comment actions (reply/hide/create-lead): viewer is read-only.
    assertNotViewer(user);
    return row;
  }

  /** Active inbox Pages of the tenant (ad accounts excluded). */
  private async allVisiblePages(clientId: string): Promise<PortalClientPage[]> {
    const allPages = await this.pages.listForPortal(clientId);
    return filterVisiblePages(allPages);
  }

  /** Back-compat alias used by background ingest paths (tenant-wide, not user-scoped). */
  private async visiblePages(clientId: string): Promise<PortalClientPage[]> {
    return this.allVisiblePages(clientId);
  }

  /**
   * Shared Page scope (t350u): approver sees every Page; staff and viewer only the Pages
   * assigned to them in portal_staff_pages (intersected with the tenant's active Pages).
   * A staff/viewer account with no assigned Page gets an empty scope and sees nothing.
   */
  async pageScope(user: PortalJwtPayload): Promise<PortalPageScope> {
    if (isPortalOwnerRole(user.role)) return { all: true };
    const [assigned, pages] = await Promise.all([
      this.repo.listUserPageIds(user.client_id, user.sub),
      this.allVisiblePages(user.client_id),
    ]);
    const active = new Set(pages.map((page) => page.page_id));
    return { all: false, pageIds: assigned.filter((id) => active.has(id)) };
  }

  /** Pages the user may see (inbox Pages only). */
  async visiblePagesFor(user: PortalJwtPayload, scope?: PortalPageScope): Promise<PortalClientPage[]> {
    const pageScope = scope ?? (await this.pageScope(user));
    const pages = await this.allVisiblePages(user.client_id);
    return pages.filter((page) => pageInScope(pageScope, page.page_id));
  }

  /** Raw tenant pages (incl. ad accounts) filtered to the user's scope; approver gets all. */
  async pagesForUser(user: PortalJwtPayload): Promise<PortalClientPage[]> {
    const rows = await this.pages.listForPortal(user.client_id);
    const scope = await this.pageScope(user);
    return scope.all ? rows : rows.filter((page) => pageInScope(scope, page.page_id));
  }

  /** pages/:pageId guard: `all` only for the approver; otherwise the Page must be in scope (else 404). */
  async assertWorkspaceVisible(user: PortalJwtPayload, pageId: string): Promise<void> {
    if (isPortalOwnerRole(user.role)) return;
    const raw = String(pageId ?? '').trim();
    const scope = await this.pageScope(user);
    if (raw.toLowerCase() === 'all' || !pageInScope(scope, raw)) {
      throw new NotFoundException({ error: 'page_not_found' });
    }
  }

  private async validStaffPageIds(clientId: string, raw: unknown): Promise<string[]> {
    if (!Array.isArray(raw)) {
      throw new BadRequestException({ error: 'invalid_page_ids', message: 'Danh sách Page không hợp lệ.' });
    }
    const wanted = [...new Set(raw.map((id) => String(id ?? '').trim()).filter(Boolean))];
    if (!wanted.length) return [];
    const pages = await this.allVisiblePages(clientId);
    const known = new Set(pages.map((page) => page.page_id));
    const unknown = wanted.filter((id) => !known.has(id));
    if (unknown.length) {
      throw new BadRequestException({
        error: 'page_not_found',
        message: 'Có Page không thuộc tài khoản hoặc đã tắt.',
        page_ids: unknown,
      });
    }
    return wanted;
  }

  private async prepare(clientId: string): Promise<void> {
    await this.pages.ensureStore();
    await this.repo.ensure();
    await this.repo.syncCases(clientId);
    await this.rebalancer.rebalance(clientId);
  }

  private async ingestFacebook(clientId: string): Promise<void> {
    if (shouldPauseGraph()) return;
    const ttl = portalOnDemandTtlMs();
    if (shouldReuseFreshSync(this.inboxAt.get(clientId), Date.now(), ttl)) return;
    await this.ingestFlights.run(clientId, async () => {
      if (shouldPauseGraph()) return;
      if (shouldReuseFreshSync(this.inboxAt.get(clientId), Date.now(), ttl)) return;
      await this.pullFacebookInbox(clientId, { fromUserDesk: true });
      await this.rebalancer.rebalance(clientId);
      this.inboxAt.set(clientId, Date.now());
    });
  }

  /** Background poller — no 30s user throttle; optional explicit page list from DB. */
  async pullFacebookInbox(
    clientId: string,
    opts?: { fromUserDesk?: boolean; pageIds?: string[] },
  ): Promise<PortalInboxIngestResult> {
    const stat = await this.inboxSync.pullFacebookInbox(clientId, opts);
    this.inboxStat.set(clientId, stat);
    return stat;
  }

  private async requireCase(user: PortalJwtPayload, caseId: string) {
    await this.repo.ensure();
    const id = String(caseId ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new NotFoundException({ error: 'case_not_found' });
    }
    const row = await this.repo.findCase(user.client_id, id);
    if (!row) throw new NotFoundException({ error: 'case_not_found' });
    return row;
  }

  /** Case must be on a Page in the user's scope; otherwise 404 (no existence leak). */
  private async requireVisibleCase(user: PortalJwtPayload, caseId: string, scope?: PortalPageScope) {
    const row = await this.requireCase(user, caseId);
    const pageScope = scope ?? (await this.pageScope(user));
    if (!pageInScope(pageScope, row.page_id)) {
      throw new NotFoundException({ error: 'case_not_found' });
    }
    return row;
  }

  private async requireActor(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireVisibleCase(user, caseId);
    assertNotViewer(user);
    if (!staffCanViewCareCase(user, row.assignee_user_id)) {
      throw new ForbiddenException({ error: 'not_assignee' });
    }
    return row;
  }

  private requireManager(user: PortalJwtPayload): void {
    assertNotViewer(user);
    if (user.role === 'staff') throw new ForbiddenException({ error: 'approver_only' });
  }

  /** Staff account mutations: approver or admin only. Viewers may list, not change. */
  private requireApprover(user: PortalJwtPayload): void {
    assertNotViewer(user);
    // Portal JWT roles are approver | viewer | staff (no admin). Only approver may mutate staff.
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'approver_only' });
    }
  }

  private async ownPage(user: PortalJwtPayload, pageId: string): Promise<void> {
    const pages = await this.pages.listForPortal(user.client_id);
    const page = pages.find((item) => item.page_id === pageId);
    if (!page) throw new NotFoundException({ error: 'page_not_found' });
    if (!isPortalOwnerRole(user.role) && !pageInScope(await this.pageScope(user), pageId)) {
      throw new NotFoundException({ error: 'page_not_found' });
    }
  }
}
