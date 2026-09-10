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
}
