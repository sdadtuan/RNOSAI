import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdAuditRepository } from '../csd/csd-audit.repository';
import { CsdNotificationsRepository } from '../csd/csd-notifications.repository';
import { buildPdfSections, renderIwrReportPdf } from './iwr-export.util';
import { isOnPath, ancestorIds } from './iwr-org.util';
import { isIwrLate, isIwrWorkday, iwrPeriodForTemplate } from './iwr-period.util';
import { assertW1Recipients, defaultToStaffId, IwrPolicyError } from './iwr-recipient.util';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import { emptySectionsForCode, sectionKeysForCode } from './iwr-sections.util';
import { canTransitionIwr } from './iwr-workflow.util';
import type {
  AddIwrCommentInput,
  CreateIwrReportInput,
  IwrActor,
  IwrReportDetail,
  IwrReportRow,
  IwrRag,
  PatchIwrReportInput,
  RequestIwrChangesInput,
  SubmitIwrReportInput,
  UpdateIwrTemplateInput,
  WaiveIwrReportInput,
} from './iwr.types';

const IMMUTABLE: Set<string> = new Set(['acknowledged', 'waived', 'archived']);
const EDITABLE: Set<string> = new Set(['draft', 'changes_requested']);
const RAG_VALUES = new Set(['green', 'yellow', 'red', 'gray']);

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function extractRag(report: IwrReportRow): IwrRag | null {
  if (report.rag && RAG_VALUES.has(report.rag)) return report.rag;
  const ragSec = report.sections_json?.rag;
  if (ragSec && typeof ragSec === 'object') {
    const body = String((ragSec as { body?: string }).body ?? '').trim();
    if (RAG_VALUES.has(body)) return body as IwrRag;
  }
  return null;
}

@Injectable()
export class IwrReportsService {
  /** Test override */
  nowFn: () => Date = () => new Date();

  constructor(
    private readonly repo: IwrReportsRepository,
    private readonly org: IwrOrgRepository,
    private readonly notify: CsdNotificationsRepository,
    private readonly audit: CsdAuditRepository,
  ) {}

  private now(): Date {
    return this.nowFn();
  }

  private mapPolicyError(err: unknown): never {
    if (err instanceof IwrPolicyError) {
      throw new ForbiddenException({ error: err.error });
    }
    throw err;
  }

  private async loadDetail(id: string): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    const [recipients, comments, versions] = await Promise.all([
      this.repo.listRecipients(id),
      this.repo.listComments(id),
      this.repo.listVersions(id),
    ]);
    return { ...report, recipients, comments, versions };
  }

  private async canView(actor: IwrActor, report: IwrReportRow): Promise<boolean> {
    if (report.author_staff_id === actor.staffId) return true;
    if (hasIwrCap(actor, 'manage') || hasIwrCap(actor, 'executive')) return true;
    if (await this.repo.isRecipient(report.id, actor.staffId)) return true;
    const nodes = await this.org.listActiveStaff();
    const ancestors = ancestorIds(report.author_staff_id, nodes);
    if (ancestors.includes(actor.staffId)) return true;
    return isOnPath(actor.staffId, report.author_staff_id, nodes);
  }

  private async assertView(actor: IwrActor, report: IwrReportRow): Promise<void> {
    if (!(await this.canView(actor, report))) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
  }

  private async auditLog(
    actor: IwrActor,
    action: string,
    entityId: string,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action,
      entity_type: 'iwr_report',
      entity_id: entityId,
      after_json: after ?? null,
    });
  }

  async create(actor: IwrActor, input: CreateIwrReportInput): Promise<IwrReportDetail> {
    const template = await this.repo.getTemplateByCode(input.template_code);
    if (!template) throw new NotFoundException({ error: 'iwr_template_not_found' });

    const period =
      input.period_start && input.period_end
        ? {
            period_start: input.period_start.slice(0, 10),
            period_end: input.period_end.slice(0, 10),
            due_at: iwrPeriodForTemplate(input.template_code, this.now()).due_at,
          }
        : iwrPeriodForTemplate(input.template_code, this.now());

    if (input.template_code === 'daily_work' && !isIwrWorkday(period.period_start)) {
      throw new BadRequestException({ error: 'iwr_not_workday' });
    }

    const author = await this.org.getStaff(actor.staffId);
    if (!author) throw new ForbiddenException({ error: 'iwr_unresolved_staff' });

    const title = `${template.name_vi} ${period.period_start}`;
    const sections = emptySectionsForCode(input.template_code);

    try {
      const row = await this.repo.insertReport({
        template_id: template.id,
        title,
        author_staff_id: actor.staffId,
        reviewer_staff_id: defaultToStaffId(author),
        period_start: period.period_start,
        period_end: period.period_end,
        due_at: period.due_at,
        sections_json: sections,
      });
      await this.auditLog(actor, 'iwr.create', row.id, { status: 'draft' });
      return this.enrichViewer(actor, await this.loadDetail(row.id));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'iwr_period_exists' });
      }
      throw err;
    }
  }

  async listMine(
    actor: IwrActor,
    query: { status?: string; template_code?: string },
  ): Promise<{ items: IwrReportRow[] }> {
    const items = await this.repo.listMine(actor.staffId, query);
    return { items };
  }

  private enrichViewer(actor: IwrActor, detail: IwrReportDetail): IwrReportDetail {
    return {
      ...detail,
      viewer_is_author: detail.author_staff_id === actor.staffId,
      viewer_is_reviewer: detail.reviewer_staff_id === actor.staffId,
    };
  }

  async get(actor: IwrActor, id: string): Promise<IwrReportDetail> {
    const detail = await this.loadDetail(id);
    await this.assertView(actor, detail);
    return this.enrichViewer(actor, detail);
  }

  async patch(actor: IwrActor, id: string, input: PatchIwrReportInput): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'iwr_not_author' });
    }
    if (IMMUTABLE.has(report.status)) {
      throw new ConflictException({ error: 'iwr_immutable' });
    }
    if (!EDITABLE.has(report.status)) {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }

    if (input.rag != null && !RAG_VALUES.has(input.rag)) {
      throw new BadRequestException({ error: 'rag_required' });
    }

    const sections = input.sections_json ?? report.sections_json;
    await this.repo.updateSections(id, sections, {
      title: input.title,
      rag: input.rag,
    });

    if (input.source_report_ids) {
      await this.repo.replaceSources(id, input.source_report_ids);
    }

    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async submit(actor: IwrActor, id: string, input: SubmitIwrReportInput): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'iwr_not_author' });
    }
    if (!EDITABLE.has(report.status)) {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }

    const toStatus = report.status === 'changes_requested' ? 'supplemented' : 'submitted';
    if (!canTransitionIwr(report.status, toStatus)) {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }

    const author = await this.org.getStaff(actor.staffId);
    if (!author) throw new ForbiddenException({ error: 'iwr_unresolved_staff' });
    const nodes = await this.org.listActiveStaff();
    const toId = defaultToStaffId(author);
    const toIds = toId != null ? [toId] : [];
    const ccIds = (input.cc_staff_ids ?? []).map(Number).filter((n) => n > 0);

    try {
      assertW1Recipients({ author, actor, nodes, toIds, ccIds, bccIds: [] });
    } catch (err) {
      this.mapPolicyError(err);
    }

    if (report.template_code === 'weekly_work' || report.template_code === 'monthly_work') {
      if (!extractRag(report)) {
        throw new BadRequestException({ error: 'rag_required' });
      }
    }

    const dueAt = new Date(report.due_at);
    const late = isIwrLate(this.now(), dueAt);
    const lateReason = String(input.late_reason ?? '').trim();
    if (late && lateReason.length < 3) {
      throw new BadRequestException({ error: 'late_reason_required' });
    }

    const recipients: { staff_id: number; kind: 'to' | 'cc' }[] = [];
    if (toId != null) recipients.push({ staff_id: toId, kind: 'to' });
    for (const cc of ccIds) recipients.push({ staff_id: cc, kind: 'cc' });

    await this.repo.replaceRecipients(id, recipients);
    await this.repo.insertVersionSnapshot(
      id,
      report.version,
      toStatus,
      report.sections_json,
      actor.staffId,
    );
    await this.repo.updateStatus(id, {
      status: toStatus,
      reviewer_staff_id: toId,
      submitted_at: this.now().toISOString(),
      is_late: late,
      late_reason: late ? lateReason : null,
    });

    if (toId != null) {
      await this.notify.insert({
        staff_id: toId,
        event_key: 'iwr_report_submitted',
        title_vi: 'Báo cáo nội bộ mới',
        body_vi: `${actor.staffLabel} đã nộp ${report.title}`,
        entity_type: 'iwr_report',
        entity_id: id,
        severity: 'info',
      });
    }
    for (const cc of ccIds) {
      await this.notify.insert({
        staff_id: cc,
        event_key: 'iwr_report_cc',
        title_vi: 'Báo cáo nội bộ (Cc)',
        body_vi: `${actor.staffLabel} đã nộp ${report.title}`,
        entity_type: 'iwr_report',
        entity_id: id,
        severity: 'info',
      });
    }

    await this.auditLog(actor, 'iwr.submit', id, { status: toStatus, is_late: late });
    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async withdraw(actor: IwrActor, id: string): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'iwr_not_author' });
    }
    if (report.status !== 'submitted' && report.status !== 'supplemented') {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }
    if (report.acknowledged_at) {
      throw new ConflictException({ error: 'iwr_immutable' });
    }
    if (report.reviewer_staff_id) {
      const hasComment = await this.repo.hasReviewerComment(id, report.reviewer_staff_id);
      if (hasComment) {
        throw new ConflictException({ error: 'iwr_bad_transition' });
      }
    }

    await this.repo.updateStatus(id, {
      status: 'draft',
      submitted_at: null,
      is_late: false,
      late_reason: null,
    });
    await this.repo.replaceRecipients(id, []);
    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async acknowledge(actor: IwrActor, id: string): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    await this.assertView(actor, report);

    if (report.status !== 'submitted' && report.status !== 'supplemented') {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }

    const isReviewer = report.reviewer_staff_id === actor.staffId;
    if (!isReviewer && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_not_direct_manager' });
    }
    if (!hasIwrCap(actor, 'review') && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }

    await this.repo.updateStatus(id, {
      status: 'acknowledged',
      acknowledged_at: this.now().toISOString(),
      acknowledged_by_staff_id: actor.staffId,
    });
    await this.auditLog(actor, 'iwr.acknowledge', id, { status: 'acknowledged' });
    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async requestChanges(
    actor: IwrActor,
    id: string,
    input: RequestIwrChangesInput,
  ): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });

    const isReviewer = report.reviewer_staff_id === actor.staffId;
    if (!isReviewer && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_not_direct_manager' });
    }
    if (!hasIwrCap(actor, 'review') && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }

    const body = String(input.body_text ?? '').trim();
    if (body.length < 3) {
      throw new BadRequestException({ error: 'comment_required' });
    }

    await this.repo.insertComment({
      report_id: id,
      section_key: String(input.section_key ?? '').trim(),
      body_text: body,
      created_by_staff_id: actor.staffId,
    });
    await this.repo.updateStatus(id, { status: 'changes_requested' });

    await this.notify.insert({
      staff_id: report.author_staff_id,
      event_key: 'iwr_changes_requested',
      title_vi: 'Yêu cầu bổ sung báo cáo',
      body_vi: body.slice(0, 200),
      entity_type: 'iwr_report',
      entity_id: id,
      severity: 'warning',
    });

    await this.auditLog(actor, 'iwr.request_changes', id, { status: 'changes_requested' });
    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async waive(actor: IwrActor, id: string, input: WaiveIwrReportInput): Promise<IwrReportDetail> {
    if (!hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'manage' });
    }
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.status !== 'draft') {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }

    const reason = String(input.reason ?? '').trim();
    if (reason.length < 3) {
      throw new BadRequestException({ error: 'comment_required' });
    }

    await this.repo.updateStatus(id, {
      status: 'waived',
      waived_at: this.now().toISOString(),
      waived_by_staff_id: actor.staffId,
      waive_reason: reason,
    });

    await this.notify.insert({
      staff_id: report.author_staff_id,
      event_key: 'iwr_report_waived',
      title_vi: 'Báo cáo được miễn nộp',
      body_vi: reason.slice(0, 200),
      entity_type: 'iwr_report',
      entity_id: id,
      severity: 'info',
    });

    await this.auditLog(actor, 'iwr.waive', id, { status: 'waived' });
    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async addComment(
    actor: IwrActor,
    id: string,
    input: AddIwrCommentInput,
  ): Promise<IwrReportDetail> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    await this.assertView(actor, report);

    const body = String(input.body_text ?? '').trim();
    if (body.length < 1) {
      throw new BadRequestException({ error: 'comment_required' });
    }

    await this.repo.insertComment({
      report_id: id,
      section_key: String(input.section_key ?? '').trim(),
      body_text: body,
      created_by_staff_id: actor.staffId,
    });

    if (report.author_staff_id !== actor.staffId) {
      await this.notify.insert({
        staff_id: report.author_staff_id,
        event_key: 'iwr_comment_added',
        title_vi: 'Phản hồi báo cáo nội bộ',
        body_vi: body.slice(0, 200),
        entity_type: 'iwr_report',
        entity_id: id,
        severity: 'info',
      });
    }

    return this.enrichViewer(actor, await this.loadDetail(id));
  }

  async listComments(actor: IwrActor, id: string, sectionKey?: string) {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    await this.assertView(actor, report);
    const items = await this.repo.listComments(id, sectionKey);
    return { items };
  }

  async exportPdf(actor: IwrActor, id: string): Promise<Buffer> {
    const detail = await this.get(actor, id);
    const keys = sectionKeysForCode(
      detail.template_code as 'daily_work' | 'weekly_work' | 'monthly_work',
    );
    const buf = await renderIwrReportPdf({
      title: detail.title,
      author_name: detail.author_name ?? String(detail.author_staff_id),
      period_start: detail.period_start,
      period_end: detail.period_end,
      status: detail.status,
      sections: buildPdfSections(detail.sections_json, keys),
    });
    await this.auditLog(actor, 'iwr.export_pdf', id);
    return buf;
  }

  async listTemplates(_actor: IwrActor) {
    const items = await this.repo.listTemplates();
    return { items };
  }

  async updateTemplate(actor: IwrActor, id: string, input: UpdateIwrTemplateInput) {
    if (!hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'manage' });
    }
    const row = await this.repo.updateTemplate(id, input);
    return row;
  }
}
