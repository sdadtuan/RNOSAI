import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReProjectsAccountingRepository } from './re-projects-accounting.repository';
import {
  AccountingDeps,
  aiProjectFinanceQuery,
  applyPredictedRisksToRegister,
  buildAccountingExportSheets,
  computeAccountingDashboard,
  deleteCashFlowLine,
  forecastFinancialOutlook,
  importCashFlowCsv,
  listCashFlowLines,
  predictFinancialRisks,
  saveCashFlowLine,
  syncBudgetFromPlans,
  syncRevenueFromInventory,
} from './re-projects-accounting.util';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import {
  AccountingAiAskBody,
  ApplyPredictedRisksBody,
  ImportCashFlowBody,
  SaveCashFlowBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsAccountingService {
  private readonly deps: AccountingDeps;

  constructor(
    private readonly accounting: ReProjectsAccountingRepository,
    private readonly projects: ReProjectsPgRepository,
  ) {
    this.deps = { accounting, projects };
  }

  private async ensureProject(projectId: number): Promise<void> {
    if (!await this.projects.fetchProject(projectId)) {
      throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    }
  }

  async dashboard(projectId: number) {
    await this.ensureProject(projectId);
    return computeAccountingDashboard(this.deps, projectId);
  }

  async listCashFlow(
    projectId: number,
    filters: { flow_type?: string; category?: string; status?: string },
  ) {
    await this.ensureProject(projectId);
    return { lines: await listCashFlowLines(this.deps, projectId, filters) };
  }

  async createCashFlow(projectId: number, body: SaveCashFlowBody, createdBy = '') {
    await this.ensureProject(projectId);
    try {
      return await saveCashFlowLine(this.deps, projectId, body, { createdBy, ts: this.accounting.nowTs() });
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateCashFlow(projectId: number, lineId: number, body: SaveCashFlowBody, createdBy = '') {
    await this.ensureProject(projectId);
    try {
      return await saveCashFlowLine(this.deps, projectId, body, {
        lineId,
        createdBy,
        ts: this.accounting.nowTs(),
      });
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async removeCashFlow(projectId: number, lineId: number) {
    await this.ensureProject(projectId);
    await deleteCashFlowLine(this.deps, projectId, lineId);
    return { ok: true };
  }

  async importCashFlow(projectId: number, body: ImportCashFlowBody, createdBy = '') {
    await this.ensureProject(projectId);
    const csvText = String(body.csv ?? '');
    if (!csvText.trim()) {
      throw new BadRequestException({ error: 'Thiếu nội dung CSV.' });
    }
    return importCashFlowCsv(this.deps, projectId, csvText, {
      createdBy,
      ts: this.accounting.nowTs(),
    });
  }

  async syncFromPlans(projectId: number) {
    try {
      return await syncBudgetFromPlans(this.deps, projectId, this.accounting.nowTs());
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async syncInventoryRevenue(projectId: number, createdBy = '') {
    try {
      return await syncRevenueFromInventory(this.deps, projectId, {
        ts: this.accounting.nowTs(),
        createdBy,
      });
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async aiAsk(projectId: number, body: AccountingAiAskBody) {
    await this.ensureProject(projectId);
    const question = String(body.question ?? body.q ?? '').trim();
    if (!question) {
      throw new BadRequestException({ error: 'Thiếu câu hỏi.' });
    }
    try {
      return aiProjectFinanceQuery(this.deps, question, {
        reProjectId: projectId,
        ts: this.accounting.nowTs(),
      });
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async exportBundle(projectId: number) {
    try {
      const sheets = await buildAccountingExportSheets(this.deps, projectId);
      const proj = await this.projects.fetchProject(projectId);
      const code = String(proj?.code ?? `du-an-${projectId}`).trim() || `du-an-${projectId}`;
      const stamp = new Date().toISOString().slice(0, 10);
      return {
        filename: `ke-toan-${code}-${stamp}`.replace(/\s+/g, '-'),
        format: 'json',
        sheets,
      };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async riskPredictions(projectId: number) {
    try {
      return await predictFinancialRisks(this.deps, projectId);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async forecast(projectId: number, monthsAheadRaw?: string) {
    let monthsAhead = 3;
    if (monthsAheadRaw != null) {
      const parsed = Number(monthsAheadRaw);
      if (Number.isFinite(parsed)) {
        monthsAhead = Math.max(1, Math.min(12, Math.trunc(parsed)));
      }
    }
    try {
      return await forecastFinancialOutlook(this.deps, projectId, { monthsAhead });
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async applyRiskPredictions(projectId: number, body: ApplyPredictedRisksBody) {
    try {
      const codes = Array.isArray(body.codes) ? body.codes.map(String) : undefined;
      return await applyPredictedRisksToRegister(this.deps, projectId, {
        codes,
        ts: this.accounting.nowTs(),
      });
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }
}
