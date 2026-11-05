import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { maskSections } from './iwr-masking.util';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import { canViewIwrReport } from './iwr-visibility.util';
import { IwrW5Repository } from './iwr-w5.repository';
import type {
  CreateIwrSavedReportInput,
  IwrActor,
  IwrReportRow,
  IwrSavedReport,
  IwrSavedReportQuery,
} from './iwr.types';

const RUN_LIMIT = 5000;
const ASYNC_THRESHOLD = 100_000;

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrBuilderService {
  constructor(
    private readonly repo: IwrW5Repository,
    private readonly reports: IwrReportsRepository,
    private readonly org: IwrOrgRepository,
  ) {}

  async list(actor: IwrActor): Promise<{ items: IwrSavedReport[] }> {
    const items = await this.repo.listSavedReports(actor.staffId, hasCap(actor, 'manage'));
    return { items };
  }

  async create(actor: IwrActor, input: CreateIwrSavedReportInput): Promise<IwrSavedReport> {
    if (!hasCap(actor, 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'view' });
    }
    return this.repo.insertSavedReport({
      name_vi: input.name_vi.trim(),
      owner_staff_id: actor.staffId,
      query_json: input.query_json ?? {},
      viz: input.viz ?? 'table',
    });
  }

  async share(actor: IwrActor, id: string, staffIds: number[]): Promise<IwrSavedReport> {
    const saved = await this.repo.getSavedReport(id);
    if (!saved) throw new NotFoundException({ error: 'iwr_saved_report_not_found' });
    if (saved.owner_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    return this.repo.shareSavedReport(id, staffIds);
  }

  private async filterVisible(actor: IwrActor, rows: IwrReportRow[]): Promise<IwrReportRow[]> {
    const out: IwrReportRow[] = [];
    for (const row of rows) {
      if (
        await canViewIwrReport(actor, row, {
          isRecipient: (reportId, staffId) => this.reports.isRecipient(reportId, staffId),
          listActiveStaff: () => this.org.listActiveStaff(),
        })
      ) {
        out.push(row);
      }
    }
    return out;
  }

  private async maskRow(actor: IwrActor, row: IwrReportRow): Promise<Record<string, unknown>> {
    const fields = await this.repo.listFieldsForReport(row.id);
    const masked = maskSections(
      row.sections_json,
      fields.map((f) => ({ key: f.field_key, sensitivity: f.sensitivity })),
      actor,
    );
    return {
      id: row.id,
      title: row.title,
      template_code: row.template_code,
      author_staff_id: row.author_staff_id,
      author_name: row.author_name,
      period_start: row.period_start,
      period_end: row.period_end,
      status: row.status,
      rag: row.rag,
      sections_json: masked,
    };
  }

  async run(
    actor: IwrActor,
    id: string,
  ): Promise<{ rows: unknown[]; truncated: boolean; async_job_id?: string }> {
    const saved = await this.repo.getSavedReport(id);
    if (!saved) throw new NotFoundException({ error: 'iwr_saved_report_not_found' });
    const canRun =
      saved.owner_staff_id === actor.staffId ||
      saved.shared_staff_ids.includes(actor.staffId) ||
      hasCap(actor, 'manage');
    if (!canRun) throw new ForbiddenException({ error: 'iwr_forbidden' });

    const query = saved.query_json as IwrSavedReportQuery;
    const total = await this.repo.countBuilderQuery(query);
    if (total > ASYNC_THRESHOLD) {
      const jobId = await this.repo.queueExportJob(id, actor.staffId);
      throw new HttpException({ async_job_id: jobId, status: 'queued' }, HttpStatus.ACCEPTED);
    }

    const raw = await this.repo.runBuilderQuery(query, RUN_LIMIT);
    const visible = await this.filterVisible(actor, raw);
    const rows = await Promise.all(visible.map((r) => this.maskRow(actor, r)));
    return { rows, truncated: total > RUN_LIMIT };
  }
}
