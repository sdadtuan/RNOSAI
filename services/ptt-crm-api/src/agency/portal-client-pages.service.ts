import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortalClientPagesRepository } from './portal-client-pages.repository';
import { AgencyRepository } from './agency.repository';
import {
  PortalClientPage,
  PortalClientPagesListResponse,
  PortalPageLead,
  PortalPageWorkspace,
} from './portal-client-pages.types';
import { normalizePortalChannel, normalizePortalPageId } from './portal-client-pages.util';
import { MetaBusinessTokenService } from './meta-business-token.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PortalClientPagesService {
  constructor(
    private readonly repo: PortalClientPagesRepository,
    private readonly businessToken: MetaBusinessTokenService,
    private readonly agency: AgencyRepository,
  ) {}

  async list(clientId: string): Promise<PortalClientPagesListResponse> {
    await this.assertClient(clientId);
    await this.assignMatchedIds(clientId);
    const pages = await this.repo.listByClient(clientId);
    return { ok: true, client_id: clientId, pages };
  }

  async add(clientId: string, body: { channel?: string; page_id?: string; page_name?: string }): Promise<PortalClientPage> {
    await this.assertClient(clientId);
    const channel = normalizePortalChannel(body.channel);
    if (!channel) throw new BadRequestException({ error: 'invalid_channel' });
    const normalizedId = normalizePortalPageId(body.page_id, channel);
    if (!normalizedId) throw new BadRequestException({ error: 'invalid_page_id' });
    const resolved = await this.resolvePage(channel, normalizedId, String(body.page_name ?? ''));
    const pageId = resolved.pageId;
    const pageName = resolved.pageName;
    const existing = await this.repo.findByChannelPage(channel, pageId);
    if (existing && existing.client_id !== clientId) {
      throw new ConflictException({ error: 'page_owned_by_other_client' });
    }
    if (existing) throw new ConflictException({ error: 'page_already_added' });
    return this.repo.insert(clientId, channel, pageId, pageName);
  }

  async update(
    clientId: string,
    rowId: string,
    body: { channel?: string; page_id?: string; page_name?: string },
  ): Promise<PortalClientPage> {
    await this.assertClient(clientId);
    if (!UUID_RE.test(rowId)) throw new BadRequestException({ error: 'invalid_page_id' });
    const current = await this.repo.findById(clientId, rowId);
    if (!current) throw new NotFoundException({ error: 'page_not_found' });
    const channel = body.channel == null ? current.channel : normalizePortalChannel(body.channel);
    if (!channel) throw new BadRequestException({ error: 'invalid_channel' });
    const normalizedId = body.page_id == null ? current.page_id : normalizePortalPageId(body.page_id, channel);
    if (!normalizedId) throw new BadRequestException({ error: 'invalid_page_id' });
    const resolved = await this.resolvePage(
      channel,
      normalizedId,
      body.page_name == null ? current.page_name : String(body.page_name),
    );
    const pageId = resolved.pageId;
    const pageName = resolved.pageName;
    const existing = await this.repo.findByChannelPage(channel, pageId);
    if (existing && existing.id !== current.id) {
      throw new ConflictException({
        error: existing.client_id === clientId ? 'page_already_added' : 'page_owned_by_other_client',
      });
    }
    try {
      const updated = await this.repo.update(clientId, rowId, { channel, pageId, pageName });
      if (!updated) throw new NotFoundException({ error: 'page_not_found' });
      return updated;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === '23505') throw new ConflictException({ error: 'page_already_added' });
      throw err;
    }
  }

  async remove(clientId: string, key: string): Promise<{ ok: true }> {
    await this.assertClient(clientId);
    const removed = UUID_RE.test(key)
      ? await this.repo.removeById(clientId, key)
      : await this.removeByPageId(clientId, key);
    if (!removed) throw new NotFoundException({ error: 'page_not_found' });
    return { ok: true };
  }

  private async resolvePage(
    channel: string,
    pageId: string,
    rawName: string,
  ): Promise<{ pageId: string; pageName: string }> {
    const typed = rawName.trim().slice(0, 255);
    if (channel !== 'facebook') return { pageId, pageName: typed };
    const pages = await this.businessToken.listPages();
    const byId = pages.find((page) => page.id === pageId);
    if (byId) return { pageId: byId.id, pageName: typed || byId.name };
    const byName = pages.filter((page) => typed && page.name.toLowerCase() === typed.toLowerCase());
    if (byName.length === 1) return { pageId: byName[0].id, pageName: byName[0].name };
    throw new BadRequestException({ error: 'page_not_in_business_token' });
  }

  private async removeByPageId(clientId: string, pageIdRaw: string): Promise<boolean> {
    const pageId = normalizePortalPageId(pageIdRaw);
    if (!pageId) throw new BadRequestException({ error: 'invalid_page_id' });
    return this.repo.remove(clientId, pageId);
  }

  async listForPortal(clientId: string): Promise<PortalClientPage[]> {
    await this.assignMatchedIds(clientId);
    return this.repo.listByClient(clientId);
  }

  async ensureStore(): Promise<void> {
    await this.repo.ensure();
  }

  private async assignMatchedIds(clientId: string): Promise<void> {
    let catalog: { pages: Array<{ id: string; name: string }>; ad_accounts: Array<{ id: string; name: string }> };
    try {
      catalog = await this.businessToken.catalog();
    } catch {
      return;
    }
    const pages = new Map(catalog.pages.map((row) => [row.id, row.name]));
    const accounts = new Map(catalog.ad_accounts.map((row) => [row.id, row.name]));
    const channels = await this.agency.listChannelAccounts(clientId);
    for (const account of channels) {
      if (account.channel !== 'meta') continue;
      const pageId = normalizePortalPageId(account.facebook_page_id, 'facebook');
      if (pageId && pages.has(pageId)) {
        await this.ensureAssigned(clientId, 'facebook', pageId, pages.get(pageId) || account.display_name || '');
      }
      const accountId = normalizePortalPageId(account.external_account_id, 'ad_account');
      if (accountId && accounts.has(accountId)) {
        await this.ensureAssigned(clientId, 'ad_account', accountId, accounts.get(accountId) || account.display_name || '');
      }
    }
  }

  private async ensureAssigned(clientId: string, channel: 'facebook' | 'ad_account', pageId: string, pageName: string): Promise<void> {
    const existing = await this.repo.findByChannelPage(channel, pageId);
    if (existing) return;
    try {
      await this.repo.insert(clientId, channel, pageId, pageName.slice(0, 255));
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code !== '23505') throw err;
    }
  }

  async workspace(clientId: string, pageIdRaw: string): Promise<PortalPageWorkspace> {
    const raw = pageIdRaw.trim();
    if (raw.toLowerCase() === 'all') {
      const accounts = await this.repo.listActiveAdAccounts(clientId);
      if (!accounts.length) {
        throw new NotFoundException({ error: 'page_not_found' });
      }
      const accountIds = accounts.map((row) => row.page_id);
      const [leads, reports, campaigns, creatives] = await Promise.all([
        this.repo.listLeadsForAdAccounts(clientId, accountIds),
        this.repo.listReports(clientId, accountIds),
        this.repo.listCampaigns(clientId, accountIds),
        this.repo.listCreatives(clientId),
      ]);
      const page: PortalClientPage = {
        id: 'all',
        client_id: clientId,
        channel: 'ad_account',
        page_id: 'all',
        page_name: 'Tất cả tài khoản',
        active: true,
        created_at: '',
      };
      return {
        ok: true,
        enabled: true,
        client_id: clientId,
        page,
        lead_store: 'portal_page_leads',
        leads,
        messages: [],
        reports,
        campaigns,
        creatives,
      };
    }

    const page = await this.requireOwnAdAccount(clientId, pageIdRaw);
    const accountIds = [page.page_id];
    const [leads, reports, campaigns, creatives] = await Promise.all([
      this.repo.listLeadsForAdAccounts(clientId, accountIds),
      this.repo.listReports(clientId, accountIds),
      this.repo.listCampaigns(clientId, accountIds),
      this.repo.listCreatives(clientId),
    ]);
    return {
      ok: true,
      enabled: true,
      client_id: clientId,
      page,
      lead_store: 'portal_page_leads',
      leads,
      messages: [],
      reports,
      campaigns,
      creatives,
    };
  }

  async createLead(
    clientId: string,
    pageIdRaw: string,
    body: { full_name?: string; phone?: string; email?: string; campaign_name?: string },
  ): Promise<PortalPageLead> {
    const page = await this.requireOwnPage(clientId, pageIdRaw);
    const fullName = String(body.full_name ?? '').trim().slice(0, 200);
    if (!fullName) throw new BadRequestException({ error: 'full_name_required' });
    return this.repo.insertLead(clientId, page.page_id, {
      full_name: fullName,
      phone: String(body.phone ?? '').trim().slice(0, 32),
      email: String(body.email ?? '').trim().slice(0, 200),
      campaign_name: String(body.campaign_name ?? '').trim().slice(0, 200),
    });
  }

  private async requireOwnPage(clientId: string, pageIdRaw: string): Promise<PortalClientPage> {
    const pageId = normalizePortalPageId(pageIdRaw);
    if (!pageId) throw new BadRequestException({ error: 'invalid_page_id' });
    const page = await this.repo.findForClient(clientId, pageId);
    if (!page || !page.active) throw new NotFoundException({ error: 'page_not_found' });
    return page;
  }

  private async requireOwnAdAccount(clientId: string, pageIdRaw: string): Promise<PortalClientPage> {
    const pageId = normalizePortalPageId(pageIdRaw, 'ad_account');
    if (!pageId) throw new BadRequestException({ error: 'invalid_page_id' });
    const page = await this.repo.findForClient(clientId, pageId, 'ad_account');
    if (!page || !page.active) throw new NotFoundException({ error: 'page_not_found' });
    return page;
  }

  private async assertClient(clientId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) {
      throw new BadRequestException({ error: 'invalid_client_id' });
    }
    const exists = await this.repo.clientExists(clientId);
    if (!exists) throw new NotFoundException({ error: 'client_not_found' });
  }
}
