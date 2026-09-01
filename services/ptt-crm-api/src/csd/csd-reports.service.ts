import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { bumpReportVersion, CsdReportsRepository } from './csd-reports.repository';
import {
  CreateCsdReportInput,
  CsdActor,
  CsdReportRow,
  CsdReportSendLogRow,
  SendCsdReportInput,
} from './csd.types';

function emptySections(keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, { body: '' }]));
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

  async submitReview(
    actor: CsdActor,
    id: string,
    approverStaffId?: number,
  ): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }

    if (!report.requires_approval) {
      return this.repo.updateReportStatus(id, 'approved', {
        approver_staff_id: approverStaffId ?? actor.staffId,
        updated_by_staff_id: actor.staffId,
      });
    }

    return this.repo.updateReportStatus(id, 'in_review', {
      approver_staff_id: approverStaffId,
      updated_by_staff_id: actor.staffId,
    });
  }

  async approve(actor: CsdActor, id: string): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }
    if (report.requires_approval && !['in_review', 'changes_requested', 'draft'].includes(report.status)) {
      throw new ConflictException({ error: 'report_not_in_review', status: report.status });
    }

    return this.repo.updateReportStatus(id, 'approved', {
      approver_staff_id: actor.staffId,
      updated_by_staff_id: actor.staffId,
    });
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
    const nextVersion = bumpReportVersion(report.current_version);

    return this.repo.createRevisedVersion(
      id,
      nextVersion,
      actor.staffId,
      current?.sections_json ?? {},
    );
  }
}
