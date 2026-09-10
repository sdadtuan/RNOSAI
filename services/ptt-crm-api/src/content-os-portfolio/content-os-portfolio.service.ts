import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentItemService } from '../content-marketing/content-item.service';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import type {
  CmktCalendarSlotRow,
  CmktIdeaRow,
  CmktItemRow,
  CmktReviewQueueItem,
} from '../content-marketing/content-marketing.types';
import { ContentWorkflowService } from '../content-marketing/content-workflow.service';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import {
  CONTENT_REQUEST_SOURCES,
  emptyPortfolioCommandCenter,
  type ContentRequestRow,
  type ContentRequestSource,
  type PortfolioCommandCenter,
  type PortfolioCommandScope,
} from './content-os-portfolio.types';
import { formatContentItemCode, formatContentRequestCode, requestCompleteness } from './content-os-portfolio.util';

const PORTFOLIO_LIFECYCLE_CAP = 20;

function currentIsoWeekRange(now = new Date()): { from: string; to: string } {
  const day = now.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysFromMonday, 0, 0, 0, 0),
  );
  const sunday = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999),
  );
  return { from: monday.toISOString(), to: sunday.toISOString() };
}

@Injectable()
export class ContentOsPortfolioService {
  constructor(
    private readonly repo: ContentOsPortfolioRepository,
    private readonly workflow: ContentWorkflowService,
    private readonly marketingRepo: ContentMarketingRepository,
    private readonly items: ContentItemService,
  ) {}

  async getCommandCenter(scope: PortfolioCommandScope): Promise<PortfolioCommandCenter> {
    const staffId = scope.staffId ?? 0;
    if (!(staffId > 0)) {
      return emptyPortfolioCommandCenter();
    }
    const lifecycleIds = await this.repo.listScopedLifecycleIds(staffId);
    if (!lifecycleIds.length) {
      return emptyPortfolioCommandCenter();
    }
    return this.repo.aggregateCommand(lifecycleIds);
  }

  async listApprovals(scope: { staffId: number }): Promise<{ items: CmktReviewQueueItem[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    const items: CmktReviewQueueItem[] = [];
    for (const id of ids) {
      try {
        const result = await this.workflow.listReviewQueue(id, {});
        items.push(...(result.items ?? []));
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    return { items };
  }

  async listPublications(scope: {
    staffId: number;
    from?: string;
    to?: string;
  }): Promise<{ slots: CmktCalendarSlotRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    const week = currentIsoWeekRange();
    const range = {
      from: scope.from?.trim() || week.from,
      to: scope.to?.trim() || week.to,
    };
    const slots: CmktCalendarSlotRow[] = [];
    for (const id of ids) {
      try {
        const rows = await this.marketingRepo.listCalendarSlots(id, range);
        slots.push(...(rows ?? []));
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    return { slots };
  }

  async listRequests(scope: { staffId: number }): Promise<{ items: ContentRequestRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    if (!ids.length) return { items: [] };
    let items: ContentRequestRow[] = [];
    try {
      items = (await this.repo.listRequests(ids)) ?? [];
    } catch {
      items = [];
    }
    const ideas = await this.listUnconvertedIdeaItems(ids);
    return { items: [...items, ...ideas] };
  }

  async createRequest(input: {
    lifecycleId: number;
    actor: string;
    body: Record<string, unknown>;
  }): Promise<ContentRequestRow> {
    if (!Number.isFinite(input.lifecycleId) || input.lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    const deliverable_ask = String(input.body.deliverable_ask ?? '').trim();
    if (!deliverable_ask) {
      throw new BadRequestException({ error: 'deliverable_ask_required' });
    }
    const source = this.parseRequestSource(input.body.source);
    const client_label = String(input.body.client_label ?? '').trim();
    const brand_label = String(input.body.brand_label ?? '').trim();
    const objective = String(input.body.objective ?? '').trim();
    const due_at = String(input.body.due_at ?? '').trim() || null;
    const priority = String(input.body.priority ?? '').trim() || 'Standard';
    const completeness = requestCompleteness({
      client: client_label,
      brand: brand_label,
      deliverable: deliverable_ask,
      objective,
      due: due_at ?? '',
      source,
    });
    const now = new Date();
    const seq = await this.repo.nextRequestSeq(now);
    const display_code = formatContentRequestCode(now, seq);
    return this.repo.insertRequest({
      lifecycle_id: input.lifecycleId,
      display_code,
      source,
      requester_email: input.actor,
      client_label,
      brand_label,
      deliverable_ask,
      objective,
      due_at,
      priority,
      completeness,
      triage_status: 'Submitted',
      created_by: input.actor,
    });
  }

  async convertRequest(input: {
    requestId: number;
    actor: string;
    body: Record<string, unknown>;
  }): Promise<{ request: ContentRequestRow; item: CmktItemRow & { request_id: number; display_code: string } }> {
    const request = await this.repo.getRequestById(input.requestId);
    if (!request) {
      throw new NotFoundException({ error: 'request_not_found', id: input.requestId });
    }
    if (request.triage_status !== 'Accepted') {
      throw new BadRequestException({ error: 'request_not_accepted', status: request.triage_status });
    }
    const channel = String(input.body.channel ?? 'facebook').trim() || 'facebook';
    const format = String(input.body.format ?? 'social_post').trim() || 'social_post';
    const item = await this.items.createItem(
      request.lifecycle_id,
      { title: request.deliverable_ask, channel, format },
      input.actor,
    );
    const now = new Date();
    const seq = await this.repo.nextItemSeq(now);
    const display_code = formatContentItemCode(now, seq);
    const linked = await this.repo.updateItemRequestLink(item.id, {
      request_id: request.id,
      display_code,
    });
    const converted = await this.repo.updateRequestStatus(request.id, 'Converted');
    return {
      request: converted,
      item: { ...item, request_id: linked.request_id, display_code: linked.display_code },
    };
  }

  private parseRequestSource(raw: unknown): ContentRequestSource {
    if (raw === undefined) return 'account';
    const source = String(raw).trim();
    if ((CONTENT_REQUEST_SOURCES as readonly string[]).includes(source)) {
      return source as ContentRequestSource;
    }
    throw new BadRequestException({ error: 'invalid_source', source });
  }

  private async scopedLifecycleIds(staffId: number): Promise<number[]> {
    if (!(staffId > 0)) return [];
    const ids = await this.repo.listScopedLifecycleIds(staffId);
    return ids.slice(0, PORTFOLIO_LIFECYCLE_CAP);
  }

  private async listUnconvertedIdeaItems(ids: number[]): Promise<ContentRequestRow[]> {
    const items: ContentRequestRow[] = [];
    for (const id of ids) {
      try {
        const ideas = await this.marketingRepo.listIdeas(id, {});
        for (const idea of ideas ?? []) {
          if (idea.status === 'converted' || idea.status === 'archived') continue;
          items.push(this.ideaToRequestRow(idea));
        }
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    return items;
  }

  private ideaToRequestRow(idea: CmktIdeaRow): ContentRequestRow {
    return {
      id: idea.id,
      lifecycle_id: idea.lifecycle_id,
      display_code: `IDEA-${idea.id}`,
      kind: 'idea',
      source: 'idea',
      requester_email: idea.created_by ?? '',
      client_label: '',
      brand_label: '',
      deliverable_ask: idea.title,
      objective: idea.target_goal ?? '',
      due_at: null,
      priority: '',
      risk_level: '',
      completeness: 0,
      effort_h: null,
      tier: null,
      triage_status: idea.status,
      idea_id: idea.id,
      created_by: idea.created_by ?? '',
      created_at: idea.created_at ?? '',
      updated_at: idea.updated_at ?? '',
    };
  }
}
