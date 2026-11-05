import { ConflictException, Injectable } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import type {
  CmktApprovalPackageRow,
  CmktApprovalPackageSnapshot,
  CmktItemRow,
} from './content-marketing.types';
import type { CmktAssetRightRow } from '../content-os-portfolio/content-os-portfolio.types';

@Injectable()
export class ApprovalPackageService {
  constructor(private readonly repo: ContentMarketingRepository) {}

  buildSnapshot(item: CmktItemRow, rights: CmktAssetRightRow[]): CmktApprovalPackageSnapshot {
    const brief = item.brief_json ?? {};
    return {
      body_json: item.body_json,
      brief_json: brief,
      media: item.media_json ?? {},
      rights,
      disclaimer: brief.disclaimer ?? null,
    };
  }

  async createSentOnSubmit(item: CmktItemRow, actorEmail: string): Promise<CmktApprovalPackageRow> {
    const rights = await this.repo.listAssetRights(item.id);
    return this.repo.insertApprovalPackage({
      item_id: item.id,
      snapshot_json: this.buildSnapshot(item, rights),
      status: 'Sent',
      created_by: actorEmail,
    });
  }

  async assertBodyNotLocked(itemId: number, forceVersion: boolean): Promise<void> {
    const latest = await this.repo.getLatestApprovalPackage(itemId);
    if (latest?.status === 'Sent' && forceVersion !== true) {
      throw new ConflictException({ error: 'package_locked' });
    }
  }

  async supersedeLatestSent(itemId: number): Promise<void> {
    const latest = await this.repo.getLatestApprovalPackage(itemId);
    if (latest?.status !== 'Sent') return;
    await this.repo.updateApprovalPackageStatus(latest.id, 'Superseded');
  }
}
