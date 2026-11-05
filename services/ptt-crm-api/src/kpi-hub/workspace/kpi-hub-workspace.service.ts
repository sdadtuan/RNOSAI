import { ConflictException, Injectable } from '@nestjs/common';
import { KPI_HUB_ERROR_CODES, type HubWorkspaceRow, type PatchHubWorkspaceBody } from '../kpi-hub.types';
import { KpiHubWorkspaceRepository } from './kpi-hub-workspace.repository';

@Injectable()
export class KpiHubWorkspaceService {
  constructor(private readonly repo: KpiHubWorkspaceRepository) {}

  async get(): Promise<HubWorkspaceRow & { system_status: Record<string, unknown> }> {
    await this.repo.ensureSeed();
    const ws = await this.repo.get();
    return {
      ...ws,
      system_status: {
        connectors_online: 6,
        connectors_total: 7,
        last_quality_score: 92,
        pending_alerts: 3,
        dictionary_active: 20,
      },
    };
  }

  async patch(body: PatchHubWorkspaceBody, rowVersion: number) {
    if (rowVersion <= 0) {
      const current = await this.repo.get();
      rowVersion = current.row_version;
    }
    const updated = await this.repo.patch(body, rowVersion);
    if (!updated) {
      throw new ConflictException({ error: KPI_HUB_ERROR_CODES.VERSION_CONFLICT });
    }
    return updated;
  }
}
