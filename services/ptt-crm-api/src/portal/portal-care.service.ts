import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AgencyRepository } from '../agency/agency.repository';
import { MetaBusinessTokenService } from '../agency/meta-business-token.service';
import { PortalClientPagesService } from '../agency/portal-client-pages.service';
import { PortalClientPage } from '../agency/portal-client-pages.types';
import { PortalClientUsersService } from '../agency/portal-client-users.service';
import { normalizeProductSpec } from './portal-product.util';
import { pullFacebookPage, sendFacebookText } from './portal-page-inbox.util';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalCareRepository, psidFromMessageThreadKey } from './portal-care.repository';
import {
  careDueAt,
  careListFilterForUser,
  filterCasesForPortalList,
  filterVisiblePages,
  nextAssignee,
  receiveDueAt,
  shouldHopCare,
  shouldHopReceive,
  staffCanViewCareCase,
  visibleAdsChannels,
} from './portal-care.util';
import { isFacebookRateOrThrottleError } from './portal-inbox-poller.util';
import { PortalInboxSyncService, type PortalInboxIngestResult } from './portal-inbox-sync.service';

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
  private readonly ingestFlight = new Set<string>();
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
    void this.ingestFacebook(user.client_id);
    const since = liveSince(sinceRaw);
    const scope = careListFilterForUser(user);
    const messages = await this.repo.messagesSince(user.client_id, since, scope);
    const inbound = messages.filter((row) => row.direction !== 'out' && row.sender_name);
    if (inbound.length) {
      await this.repo.syncCases(user.client_id);
      await this.rebalance(user.client_id);
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
    const counts = await this.repo.summary(user.client_id, careListFilterForUser(user));
    const pages = await this.visiblePages(user.client_id);
    return {
      ok: true,
      ...counts,
      pages: pages.map((page) => ({ page_id: page.page_id, page_name: page.page_name, channel: page.channel })),
    };
  }

  async desk(user: PortalJwtPayload, query: { channel?: string; page_id?: string; day?: string; label?: string; include_inactive?: string }) {
    await this.prepare(user.client_id);
    const accounts = await this.agency.listChannelAccounts(user.client_id);
    const channels = visibleAdsChannels(accounts.map((row) => row.channel));
    const selected = query.channel ? channels.find((item) => item.id === query.channel) ?? null : null;
    const pages = (await this.visiblePages(user.client_id)).filter((page) => {
      if (!selected) return true;
      return selected.pageChannels.includes(page.channel);
    });
    const pageId = query.page_id && pages.some((page) => page.page_id === query.page_id) ? query.page_id : '';
    const filter = { pageId: pageId || undefined, day: query.day, label: query.label, ...careListFilterForUser(user) };
    const includeInactive = user.role !== 'staff' && query.include_inactive === '1';
    const [leads, messages, customers, posts, products, labels, staff] = await Promise.all([
      this.repo.listCases(user.client_id, { ...filter, kind: 'lead' }),
      this.repo.listCases(user.client_id, { ...filter, kind: 'message' }),
      this.repo.listCustomers(user.client_id, filter),
      this.repo.listPosts(user.client_id, pageId || undefined),
      this.repo.listProducts(user.client_id, pageId || undefined, { includeInactive }),
      this.repo.listLabels(user.client_id),
      this.repo.listStaff(user.client_id),
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
      me: { id: user.sub, role: user.role },
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
    const row = await this.requireActor(user, caseId);
    const psid = row.kind === 'message' ? psidFromMessageThreadKey(row.page_id, row.thread_key) : '';
    const senderName = row.kind === 'message' ? row.title : '';
    const [messages, products] = await Promise.all([
      row.kind === 'message'
        ? this.repo.listMessages(user.client_id, row.page_id, { psid, senderName })
        : Promise.resolve([]),
      this.repo.listProducts(user.client_id, row.page_id),
    ]);
    return { ok: true, case: row, messages, products };
  }

  async receive(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireActor(user, caseId);
    if (row.status !== 'waiting_receive') throw new BadRequestException({ error: 'not_waiting' });
    await this.repo.markReceived(row.id);
    return { ok: true };
  }

  async assign(user: PortalJwtPayload, caseId: string, userId: string) {
    this.requireManager(user);
    const targetId = userId.trim();
    if (!targetId) throw new BadRequestException({ error: 'user_id_required' });
    const row = await this.requireCase(user, caseId);
    if (row.status === 'purchased') throw new BadRequestException({ error: 'already_purchased' });
    const target = await this.repo.findActiveClientUser(user.client_id, targetId);
    if (!target) throw new NotFoundException({ error: 'user_not_found' });
    const now = new Date();
    const receiveDue = row.status === 'waiting_receive' ? receiveDueAt(now) : null;
    await this.repo.assignManual(row.id, targetId, receiveDue);
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
    await this.repo.markPurchased(row.id);
    return { ok: true };
  }

  async stickLabel(user: PortalJwtPayload, caseId: string, name: string) {
    const row = await this.requireActor(user, caseId);
    const label = name.trim().slice(0, 40);
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const labels = row.labels.includes(label) ? row.labels.filter((item) => item !== label) : [...row.labels, label];
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
    row: { page_id: string; thread_key: string; title: string },
    body: string,
  ): Promise<void> {
    const psid = await this.customerPsid(clientId, row);
    if (!psid) throw new BadRequestException({ error: 'Chưa lấy được mã khách trên Messenger. Mở lại hội thoại rồi gửi lại.' });
    const token = (await this.meta.pageTokens()).get(row.page_id);
    if (!token) throw new BadRequestException({ error: 'Page chưa có token để gửi tin cho khách.' });
    const sent = await sendFacebookText(row.page_id, token, psid, body);
    if (!sent.ok) throw new BadRequestException({ error: sent.error });
    await this.repo.insertOutbound(clientId, row.page_id, row.title, body, sent.id, psid);
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
    await this.ownPage(user.client_id, pageId);
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
    await this.ownPage(user.client_id, pageId);
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
    await this.ownPage(user.client_id, pageId);
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
    await this.ownPage(user.client_id, pageId);
    const removed = await this.repo.deleteProduct(user.client_id, pageId, productId);
    if (!removed) throw new NotFoundException({ error: 'product_not_found' });
    return { ok: true };
  }

  async saveProductImage(user: PortalJwtPayload, file?: { buffer?: Buffer; mimetype?: string; size?: number }) {
    this.requireManager(user);
    const mime = String(file?.mimetype ?? '');
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : '';
    if (!file?.buffer?.length || !ext || (file.size ?? 0) > 2_000_000) {
      throw new BadRequestException({ error: 'image_file' });
    }
    const dir = join(process.cwd(), 'data', 'portal-product-images');
    mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    writeFileSync(join(dir, name), file.buffer);
    return { ok: true, url: `/api/portal/crm/media/${name}` };
  }

  async addLabel(user: PortalJwtPayload, name: string) {
    this.requireManager(user);
    const label = name.trim().slice(0, 40);
    if (!label) throw new BadRequestException({ error: 'label_required' });
    await this.repo.ensure();
    await this.repo.insertLabel(user.client_id, label);
    return { ok: true };
  }

  async addStaff(user: PortalJwtPayload, email: string, password: string) {
    this.requireManager(user);
    await this.repo.ensure();
    const created = await this.users.create(user.client_id, {
      email,
      password,
      role: 'staff',
      send_email: false,
    });
    return { ok: true, user: { id: created.user.id, email: created.user.email, role: created.user.role } };
  }

  async listManagedStaff(user: PortalJwtPayload) {
    this.requireManager(user);
    await this.repo.ensure();
    const staff = await this.repo.listManagedStaff(user.client_id);
    return { ok: true, staff };
  }

  async syncPage(user: PortalJwtPayload, pageId: string, body?: { reset?: boolean }) {
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'approver_only' });
    }
    await this.ownPage(user.client_id, pageId);
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
    this.requireManager(user);
    if (userId === user.sub) throw new BadRequestException({ error: 'cannot_change_self' });
    const staff = await this.repo.listManagedStaff(user.client_id);
    if (!staff.some((row) => row.id === userId)) throw new NotFoundException({ error: 'staff_not_found' });
    const updated = await this.users.update(user.client_id, userId, { active });
    return { ok: true, user: { id: updated.id, email: updated.email, active: updated.active } };
  }

  private async visiblePages(clientId: string): Promise<PortalClientPage[]> {
    const allPages = await this.pages.listForPortal(clientId);
    return filterVisiblePages(allPages);
  }

  private async prepare(clientId: string): Promise<void> {
    await this.pages.ensureStore();
    await this.repo.ensure();
    await this.ingestFacebook(clientId);
    await this.repo.syncCases(clientId);
    await this.rebalance(clientId);
  }

  private async ingestFacebook(clientId: string): Promise<void> {
    const now = Date.now();
    if (this.ingestFlight.has(clientId)) return;
    if ((this.inboxAt.get(clientId) ?? 0) > now - 30_000) return;
    this.inboxAt.set(clientId, now);
    await this.pullFacebookInbox(clientId, { fromUserDesk: true });
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

  private async rebalance(clientId: string): Promise<void> {
    let staff = (await this.repo.listStaff(clientId)).map((row) => row.id);
    if (!staff.length) {
      staff = (await this.repo.listApprovers(clientId)).map((row) => row.id);
    }
    const loads = await this.repo.openLoads(clientId);
    const now = new Date();
    for (const row of await this.repo.listHopRows(clientId)) {
      const receiveHop = shouldHopReceive(row.status, row.receive_due_at, now);
      const careHop = shouldHopCare(row.status, row.care_due_at, now);
      if (!receiveHop && !careHop) continue;
      const next = nextAssignee(staff, loads, row.assignee_user_id);
      if (!next) continue;
      if (receiveHop) await this.repo.assignReceive(row.id, next, receiveDueAt(now));
      else await this.repo.assignCare(row.id, next, careDueAt(now));
      if (row.assignee_user_id) loads[row.assignee_user_id] = Math.max(0, (loads[row.assignee_user_id] ?? 1) - 1);
      loads[next] = (loads[next] ?? 0) + 1;
    }
    for (const id of await this.repo.listUnassigned(clientId)) {
      const next = nextAssignee(staff, loads, null);
      if (!next) break;
      await this.repo.assignReceive(id, next, receiveDueAt(now));
      loads[next] = (loads[next] ?? 0) + 1;
    }
    for (const id of await this.repo.listUnassignedCare(clientId)) {
      const next = nextAssignee(staff, loads, null);
      if (!next) break;
      await this.repo.assignCare(id, next, careDueAt(now));
      loads[next] = (loads[next] ?? 0) + 1;
    }
  }

  private async requireCase(user: PortalJwtPayload, caseId: string) {
    await this.repo.ensure();
    const row = await this.repo.findCase(user.client_id, caseId);
    if (!row) throw new NotFoundException({ error: 'case_not_found' });
    return row;
  }

  private async requireActor(user: PortalJwtPayload, caseId: string) {
    const row = await this.requireCase(user, caseId);
    if (!staffCanViewCareCase(user, row.assignee_user_id)) {
      throw new ForbiddenException({ error: 'not_assignee' });
    }
    return row;
  }

  private requireManager(user: PortalJwtPayload): void {
    if (user.role === 'staff') throw new ForbiddenException({ error: 'approver_only' });
  }

  private async ownPage(clientId: string, pageId: string): Promise<void> {
    const pages = await this.pages.listForPortal(clientId);
    const page = pages.find((item) => item.page_id === pageId);
    if (!page) throw new NotFoundException({ error: 'page_not_found' });
  }
}
