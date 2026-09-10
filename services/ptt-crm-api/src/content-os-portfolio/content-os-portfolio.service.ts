import { Injectable } from '@nestjs/common';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import {
  emptyPortfolioCommandCenter,
  type PortfolioCommandCenter,
  type PortfolioCommandScope,
} from './content-os-portfolio.types';

@Injectable()
export class ContentOsPortfolioService {
  constructor(private readonly repo: ContentOsPortfolioRepository) {}

  async getCommandCenter(scope: PortfolioCommandScope): Promise<PortfolioCommandCenter> {
    const staffId = Number(scope.staffId ?? 0);
    const lifecycleIds = await this.repo.listScopedLifecycleIds(
      Number.isFinite(staffId) ? staffId : 0,
    );
    if (!lifecycleIds.length) {
      return emptyPortfolioCommandCenter();
    }
    return this.repo.aggregateCommand(lifecycleIds);
  }
}
