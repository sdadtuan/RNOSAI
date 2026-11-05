import { BadRequestException, Injectable } from '@nestjs/common';
import { SalesPgRepository } from './sales-pg.repository';
import {
  CreateMarketBody,
  CreatePartnerBody,
  CreateSalesPlanBody,
  CreateTrainingBody,
} from './sales.types';

@Injectable()
export class SalesService {
  constructor(private readonly repo: SalesPgRepository) {}

  summary() {
    return this.repo.fetchSummary();
  }

  async listPlans() {
    return { plans: await this.repo.listPlans() };
  }

  async createPlan(body: CreateSalesPlanBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tên kế hoạch' });
    }
    const plan = await this.repo.createPlan({ ...body, title });
    return plan;
  }

  async listPipelineCases(stage?: string) {
    return { cases: await this.repo.listPipelineCases(stage) };
  }

  async listPartners(q?: string) {
    return { partners: await this.repo.listPartners(q) };
  }

  async createPartner(body: CreatePartnerBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên đối tác' });
    }
    return this.repo.createPartner({ ...body, name });
  }

  async listTrainings() {
    return { trainings: await this.repo.listTrainings() };
  }

  async createTraining(body: CreateTrainingBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.repo.createTraining({ ...body, title });
  }

  async listMarket() {
    return { research: await this.repo.listMarketResearch() };
  }

  async createMarket(body: CreateMarketBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.repo.createMarketResearch({ ...body, title });
  }

  async listTransactions() {
    return { transactions: await this.repo.listTransactions() };
  }

  salesReport() {
    return this.repo.fetchSalesReport();
  }
}
