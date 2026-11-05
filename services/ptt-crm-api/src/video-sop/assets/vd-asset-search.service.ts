import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdAssetKind, VdAssetRepository, VdAssetRow } from './vd-asset.repository';

export type VdLibraryAssetRow = VdAssetRow & { project_title: string };
export type VdAssetSearchResult = { items: VdLibraryAssetRow[] };

const KINDS = new Set<string>(['keyframe', 'take', 'master', 'proxy', 'package']);

@Injectable()
export class VdAssetSearchService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly assets: VdAssetRepository,
  ) {}

  async search(input: {
    lifecycleId: number;
    projectId?: number;
    kind?: string;
    q?: string;
    limit?: number;
  }): Promise<VdAssetSearchResult> {
    assertCinematicEnabled(this.config);
    const lifecycleId = Number(input.lifecycleId);
    if (!Number.isInteger(lifecycleId) || lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    let kind: VdAssetKind | undefined;
    if (input.kind != null && String(input.kind).trim() !== '') {
      const k = String(input.kind).trim();
      if (!KINDS.has(k)) throw new BadRequestException({ error: 'invalid_kind' });
      kind = k as VdAssetKind;
    }
    const rows = await this.projects.listByLifecycle(lifecycleId);
    const titleById = new Map(rows.map((p) => [p.id, p.title || `Video #${p.id}`]));
    let projectIds = rows.map((p) => p.id);
    if (input.projectId != null) {
      const pid = Number(input.projectId);
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new BadRequestException({ error: 'invalid_project_id' });
      }
      if (!titleById.has(pid)) return { items: [] };
      projectIds = [pid];
    }
    const found = await this.assets.searchByProjectIds({
      projectIds,
      kind,
      q: input.q,
      limit: input.limit,
    });
    return {
      items: found.map((row) => ({
        ...row,
        project_title: titleById.get(row.project_id) ?? `Video #${row.project_id}`,
      })),
    };
  }
}
