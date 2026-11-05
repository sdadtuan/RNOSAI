import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { catalogTs } from '../catalog/catalog-slug.util';
import { computeKpiBoardStats } from './re-projects-inventory.util';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import {
  RefreshLeadsNewKpiBody,
  SaveBudgetLineBody,
  SaveKpiBody,
  SaveRiskBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsKpiBudgetService {
  constructor(private readonly pg: ReProjectsPgRepository) {}

  private async assertProject(id: number): Promise<void> {
    if (!await this.pg.fetchProject(id)) {
      throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    }
  }

  async listKpiMetrics(reOnly = true) {
    return { metrics: await this.pg.listCrmKpiMetrics(reOnly) };
  }

  async listKpis(projectId: number) {
    const kpis = await this.pg.listKpis(projectId);
    return { kpis, board: computeKpiBoardStats(kpis) };
  }

  async createKpi(projectId: number, body: SaveKpiBody) {
    try {
      return await this.pg.saveKpi(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateKpi(projectId: number, kpiId: number, body: SaveKpiBody) {
    try {
      return await this.pg.saveKpi(projectId, body as Record<string, unknown>, kpiId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteKpi(projectId: number, kpiId: number) {
    await this.pg.deleteKpi(projectId, kpiId);
    return { ok: true };
  }

  async syncKpisToStaff(projectId: number) {
    await this.assertProject(projectId);
    return this.pg.syncProjectKpisToStaff(projectId, catalogTs());
  }

  async pullKpisFromStaff(projectId: number) {
    await this.assertProject(projectId);
    return this.pg.pullProjectKpisFromStaff(projectId, catalogTs());
  }

  async refreshLeadsNewKpi(projectId: number, body: RefreshLeadsNewKpiBody = {}) {
    await this.assertProject(projectId);
    return this.pg.refreshProjectReLeadsNewKpi(projectId, {
      periodMonth: body.period_month,
      ts: catalogTs(),
    });
  }

  async listRisks(projectId: number) {
    return { risks: await this.pg.listRisks(projectId) };
  }

  async createRisk(projectId: number, body: SaveRiskBody) {
    try {
      return await this.pg.saveRisk(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateRisk(projectId: number, riskId: number, body: SaveRiskBody) {
    try {
      return await this.pg.saveRisk(projectId, body as Record<string, unknown>, riskId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteRisk(projectId: number, riskId: number) {
    await this.pg.deleteRisk(projectId, riskId);
    return { ok: true };
  }

  async listBudget(projectId: number) {
    return { lines: await this.pg.listBudgetLines(projectId) };
  }

  async createBudgetLine(projectId: number, body: SaveBudgetLineBody) {
    try {
      return await this.pg.saveBudgetLine(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateBudgetLine(projectId: number, lineId: number, body: SaveBudgetLineBody) {
    try {
      return await this.pg.saveBudgetLine(projectId, body as Record<string, unknown>, lineId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteBudgetLine(projectId: number, lineId: number) {
    await this.pg.deleteBudgetLine(projectId, lineId);
    return { ok: true };
  }
}
