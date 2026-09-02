import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canTransitionReport } from './csd-report-workflow.util';
import { bumpReportVersion, CsdReportsRepository } from './csd-reports.repository';
import {
  CreateCsdReportInput,
  CsdActor,
  CsdReportDetail,
  CsdReportListQuery,
  CsdReportRow,
  CsdReportSendLogRow,
  CsdReportStatus,
  SendCsdReportInput,
  TransitionCsdReportInput,
} from './csd.types';

function emptySections(keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, { body: '' }]));
}

function hasCsdManage(actor: CsdActor): boolean {
  return actor.caps.some((c) => c.section === 'csd' && c.action === 'manage');
}

@Injectable()
export class CsdReportsService {
  constructor(private readonly repo: CsdReportsRepository) {}

  async createReport(actor: CsdActor, input: CreateCsdReportInput): Promise<CsdReportRow> {
    const template = await this.repo.getTemplateByCode(input.template_code);
    if (!template) throw new NotFoundException({ error: 'csd_report_template_not_found' });

    const periodStart = String(input.period_start ?? '').slice(0, 10);
    const periodEnd = String(input.period_end ?? '').slice(0, 10);
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      throw new BadRequestException({ error: 'invalid_period' });
    }

    const title =
      String(input.title ?? '').trim() ||
      `${template.name_vi} ${periodStart} — ${periodEnd}`;

    return this.repo.insertReport({
      template_id: template.id,
      title,
      client_account_id: input.client_account_id ?? null,
      period_start: periodStart,
      period_end: periodEnd,
      owner_staff_id: actor.staffId,
      created_by_staff_id: actor.staffId,
      sections_json: emptySections(template.sections_json),
    });
  }

  async get(_actor: CsdActor, id: string): Promise<CsdReportRow> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'csd_report_not_found' });
    return report;
  }

  async list(_actor: CsdActor, query: CsdReportListQuery): Promise<{ items: CsdReportRow[] }> {
    const items = await this.repo.listReports(query);
    return { items };
  }

  async getDetail(actor: CsdActor, id: string): Promise<CsdReportDetail> {
    const report = await this.get(actor, id);
    const [current, versions, send_logs, template] = await Promise.all([
      this.repo.getCurrentVersion(id),
      this.repo.listVersions(id),
      this.repo.listSendLogs(id),
      report.template_code ? this.repo.getTemplateByCode(report.template_code) : Promise.resolve(null),
    ]);
    return {
      ...report,
      sections_json: current?.sections_json ?? {},
      versions,
      send_logs,
      template_name_vi: template?.name_vi ?? null,
      template_sections: template?.sections_json ?? [],
    };
  }

  async transition(
    actor: CsdActor,
    id: string,
    input: TransitionCsdReportInput,
  ): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    const to = input.to;
    if (to === 'changes_requested' && String(input.comment ?? '').trim().length < 3) {
      throw new BadRequestException({ error: 'comment_required' });
    }

    const bypass = hasCsdManage(actor);
    if (to === 'approved' && report.requires_approval && !bypass) {
      throw new ForbiddenException({ error: 'csd_manage_required' });
    }
    if (!canTransitionReport(report.status, to, { requires_approval: report.requires_approval, bypass })) {
      throw new ConflictException({ error: 'invalid_status_transition', from: report.status, to });
    }

    const patch: { approver_staff_id?: number; updated_by_staff_id: number } = {
      updated_by_staff_id: actor.staffId,
    };
    if (input.approver_staff_id != null) {
      patch.approver_staff_id = input.approver_staff_id;
    } else if (to === 'approved') {
      patch.approver_staff_id = actor.staffId;
    }

    return this.repo.updateReportStatus(id, to, patch);
  }

  async submitReview(
    actor: CsdActor,
    id: string,
    approverStaffId?: number,
  ): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    const bypass = hasCsdManage(actor);
    const opts = { requires_approval: report.requires_approval, bypass };
    const to: CsdReportStatus =
      !report.requires_approval && canTransitionReport(report.status, 'approved', opts)
        ? 'approved'
        : 'in_review';
    return this.transition(actor, id, { to, approver_staff_id: approverStaffId });
  }

  async approve(actor: CsdActor, id: string): Promise<CsdReportRow> {
    return this.transition(actor, id, { to: 'approved' });
  }

  async send(actor: CsdActor, id: string, input: SendCsdReportInput): Promise<CsdReportSendLogRow> {
    const report = await this.get(actor, id);

    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_already_sent' });
    }

    if (report.requires_approval && report.status !== 'approved' && report.status !== 'scheduled') {
      throw new ConflictException({ error: 'report_not_approved', status: report.status });
    }

    const to = (input.to ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!to.length) throw new BadRequestException({ error: 'to_required' });

    await this.repo.updateReportStatus(id, 'sent', { updated_by_staff_id: actor.staffId });

    return this.repo.insertSendLog({
      report_id: id,
      version: report.current_version,
      to_json: to,
      result: 'sent',
      created_by_staff_id: actor.staffId,
    });
  }

  async updateSections(
    actor: CsdActor,
    id: string,
    sections: Record<string, unknown>,
  ): Promise<{ version: string; sections_json: Record<string, unknown> }> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }

    const version = await this.repo.updateSections(
      id,
      report.current_version,
      sections,
      actor.staffId,
    );
    return { version: version.version, sections_json: version.sections_json };
  }

  async createRevisedVersion(actor: CsdActor, id: string): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    if (report.status !== 'sent') {
      throw new ConflictException({ error: 'report_not_sent', status: report.status });
    }

    const current = await this.repo.getCurrentVersion(id);
    const nextVersion = bumpReportVersion(report.current_version, 'major');

    return this.repo.createRevisedVersion(
      id,
      nextVersion,
      actor.staffId,
      current?.sections_json ?? {},
    );
  }
}
