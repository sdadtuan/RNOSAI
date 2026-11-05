import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { computeProductInventoryStats } from './re-projects-inventory.util';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import {
  CreateReProjectBody,
  SavePriceListBody,
  SaveProductBody,
  SaveProjectTypeBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsService {
  constructor(private readonly pg: ReProjectsPgRepository) {}

  async listTypes(includeInactive = false) {
    const types = await this.pg.listProjectTypes(includeInactive);
    const labels: Record<string, string> = {};
    for (const t of types) labels[t.code] = t.name;
    return { types, labels };
  }

  async createType(body: SaveProjectTypeBody) {
    try {
      return await this.pg.saveProjectType(body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateType(typeId: number, body: SaveProjectTypeBody) {
    try {
      return await this.pg.saveProjectType(body, typeId);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteType(typeId: number) {
    try {
      await this.pg.deleteProjectType(typeId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async listProjects(q?: string) {
    return { projects: await this.pg.listProjects(q) };
  }

  async createProject(body: CreateReProjectBody) {
    try {
      return await this.pg.createProject(body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getProject(id: number) {
    const proj = await this.pg.fetchProject(id);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return proj;
  }

  async updateProject(id: number, body: CreateReProjectBody) {
    try {
      return await this.pg.updateProject(id, body);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async deleteProject(id: number) {
    await this.pg.deleteProject(id);
    return { ok: true };
  }

  async projectSummary(id: number) {
    try {
      return await this.pg.fetchProjectSummary(id);
    } catch (e) {
      throw new NotFoundException({ error: String((e as Error).message) });
    }
  }

  async listProducts(projectId: number) {
    const products = await this.pg.listProducts(projectId);
    return { products, inventory: computeProductInventoryStats(products) };
  }

  async createProduct(projectId: number, body: SaveProductBody) {
    try {
      return await this.pg.saveProduct(projectId, body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  updateProduct(projectId: number, productId: number, body: SaveProductBody) {
    return this.pg.saveProduct(projectId, body, productId);
  }

  deleteProduct(projectId: number, productId: number) {
    return this.pg.deleteProduct(projectId, productId).then(() => ({ ok: true }));
  }

  async listZones(projectId: number) {
    return { zones: await this.pg.listProjectZones(projectId) };
  }

  async inventoryByZone(projectId: number) {
    return { zones: await this.pg.inventoryByZoneSummary(projectId) };
  }

  async priceBatches(projectId: number) {
    return {
      batches: await this.pg.listPriceBatches(projectId),
      summary: await this.pg.inventoryByPriceBatchSummary(projectId),
    };
  }

  async listPriceLists(projectId: number) {
    return {
      price_lists: await this.pg.listPriceLists(projectId),
      version_codes: await this.pg.listAllVersionCodes(projectId),
    };
  }

  async createPriceList(projectId: number, body: SavePriceListBody, createdBy = '') {
    try {
      return await this.pg.savePriceList(projectId, body, undefined, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getPriceList(projectId: number, listId: number) {
    const row = await this.pg.fetchPriceList(projectId, listId);
    if (!row) throw new NotFoundException({ error: 'Không tìm thấy bảng giá.' });
    const { items, total } = await this.pg.listPriceListItems(listId, 500);
    return { price_list: row, items, items_total: total };
  }

  async updatePriceList(projectId: number, listId: number, body: SavePriceListBody, createdBy = '') {
    try {
      return await this.pg.savePriceList(projectId, body, listId, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deletePriceList(projectId: number, listId: number) {
    try {
      await this.pg.deletePriceList(projectId, listId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }
}
