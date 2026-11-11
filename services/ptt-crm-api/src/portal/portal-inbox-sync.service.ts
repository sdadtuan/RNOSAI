import { Injectable } from '@nestjs/common';
import { MetaBusinessTokenService } from '../agency/meta-business-token.service';
import { PortalClientPagesService } from '../agency/portal-client-pages.service';
import { PortalClientPage } from '../agency/portal-client-pages.types';
import { pullFacebookPage } from './portal-page-inbox.util';
import { PortalCareRepository } from './portal-care.repository';
import { filterVisiblePages } from './portal-care.util';
import { isFacebookRateOrThrottleError } from './portal-inbox-poller.util';

export type PortalInboxIngestResult = {
  pages: number;
  withToken: number;
  leads: number;
  messages: number;
  leadNote: string;
  messageNote: string;
  error: string;
  hadNew: boolean;
  rateLimited: boolean;
};

@Injectable()
export class PortalInboxSyncService {
  private readonly ingestFlight = new Set<string>();

  constructor(
    private readonly repo: PortalCareRepository,
    private readonly pages: PortalClientPagesService,
    private readonly meta: MetaBusinessTokenService,
  ) {}

  async pullFacebookInbox(
    clientId: string,
    opts?: { fromUserDesk?: boolean; pageIds?: string[] },
  ): Promise<PortalInboxIngestResult> {
    if (this.ingestFlight.has(clientId)) {
      return {
        pages: 0,
        withToken: 0,
        leads: 0,
        messages: 0,
        leadNote: '',
        messageNote: '',
        error: '',
        hadNew: false,
        rateLimited: false,
      };
    }
    this.ingestFlight.add(clientId);
    try {
      let pages: PortalClientPage[] = [];
      try {
        const visible = filterVisiblePages(await this.pages.listForPortal(clientId)).filter((page) => page.channel === 'facebook');
        const filterIds = opts?.pageIds?.length ? new Set(opts.pageIds) : null;
        pages = filterIds ? visible.filter((page) => filterIds.has(page.page_id)) : visible;
      } catch (err) {
        const note = err instanceof Error ? err.message : 'Không tải được danh sách Page Facebook.';
        const empty = { pages: 0, withToken: 0, leads: 0, messages: 0, leadNote: '', messageNote: '', error: note, hadNew: false, rateLimited: false };
        return empty;
      }
      if (!pages.length) {
        const empty = { pages: 0, withToken: 0, leads: 0, messages: 0, leadNote: '', messageNote: '', error: '', hadNew: false, rateLimited: false };
        return empty;
      }
      const tokens = await this.meta.pageTokens();
      let withToken = 0;
      let leads = 0;
      let messages = 0;
      let leadNote = '';
      let messageNote = '';
      let error = '';
      let hadNew = false;
      let rateLimited = false;
      for (const page of pages) {
        const token = tokens.get(page.page_id);
        if (!token) continue;
        withToken += 1;
        let pageError = '';
        try {
          const pulled = await pullFacebookPage(page.page_id, token, { mode: 'incremental' });
          leads += pulled.leads.length;
          messages += pulled.messages.length;
          hadNew ||= pulled.leads.length > 0 || pulled.messages.length > 0;
          if (!leadNote && pulled.leadError) leadNote = pulled.leadError;
          if (!messageNote && pulled.messageError) messageNote = pulled.messageError;
          for (const lead of pulled.leads) {
            await this.repo.upsertPageLead(clientId, page.page_id, lead);
          }
          for (const message of pulled.messages) {
            await this.repo.upsertPageMessage(clientId, page.page_id, message);
          }
          const graphNote = pulled.leadError || pulled.messageError || '';
          if (graphNote && isFacebookRateOrThrottleError(graphNote)) rateLimited = true;
        } catch (err) {
          const note = err instanceof Error ? err.message : 'Facebook từ chối kéo dữ liệu Page.';
          pageError = note;
          if (!error) error = note;
          if (isFacebookRateOrThrottleError(note)) rateLimited = true;
        }
        if (!opts?.fromUserDesk) {
          await this.repo.touchInboxPolled(clientId, page.page_id, pageError);
        }
      }
      if (pages.length > 0 && withToken === 0 && !error) {
        error = 'Page đã gắn nhưng Business Manager chưa có token đọc Facebook cho Page này.';
      }
      const stat = { pages: pages.length, withToken, leads, messages, leadNote, messageNote, error, hadNew, rateLimited };
      return stat;
    } finally {
      this.ingestFlight.delete(clientId);
    }
  }
}
