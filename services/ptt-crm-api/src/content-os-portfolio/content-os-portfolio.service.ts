import { Injectable } from '@nestjs/common';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import type { CmktCalendarSlotRow, CmktReviewQueueItem } from '../content-marketing/content-marketing.types';
import { ContentWorkflowService } from '../content-marketing/content-workflow.service';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import {
  emptyPortfolioCommandCenter,
  type PortfolioCommandCenter,
  type PortfolioCommandScope,
} from './content-os-portfolio.types';

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

  private async scopedLifecycleIds(staffId: number): Promise<number[]> {
    if (!(staffId > 0)) return [];
    const ids = await this.repo.listScopedLifecycleIds(staffId);
    return ids.slice(0, PORTFOLIO_LIFECYCLE_CAP);
  }
}
