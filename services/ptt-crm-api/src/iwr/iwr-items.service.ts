import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ancestorIds, isOnPath } from './iwr-org.util';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import type { IwrActor, IwrItemRefKind, IwrItemRow, IwrReportRow } from './iwr.types';

const IMMUTABLE = new Set(['acknowledged', 'waived', 'archived']);
const EDITABLE = new Set(['draft', 'changes_requested']);
const REF_KINDS = new Set<IwrItemRefKind>(['csd_ticket', 'lead', 'customer', 'url', 'none']);

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function assertValidUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('bad');
    }
  } catch {
    throw new BadRequestException({ error: 'iwr_bad_evidence_url' });
  }
}

@Injectable()
export class IwrItemsService {
  constructor(
    private readonly repo: IwrReportsRepository,
    private readonly org: IwrOrgRepository,
  ) {}

  private async canView(actor: IwrActor, report: IwrReportRow): Promise<boolean> {
    if (report.author_staff_id === actor.staffId) return true;
    if (hasIwrCap(actor, 'manage') || hasIwrCap(actor, 'executive')) return true;
    if (await this.repo.isRecipient(report.id, actor.staffId)) return true;
    const nodes = await this.org.listActiveStaff();
    const ancestors = ancestorIds(report.author_staff_id, nodes);
    if (ancestors.includes(actor.staffId)) return true;
    return isOnPath(actor.staffId, report.author_staff_id, nodes);
  }

  private async load(reportId: string): Promise<IwrReportRow> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    return report;
  }

  private async assertAuthorEditable(actor: IwrActor, report: IwrReportRow): Promise<void> {
    if (report.author_staff_id !== actor.staffId && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_not_author' });
    }
    if (IMMUTABLE.has(report.status)) {
      throw new ConflictException({ error: 'iwr_immutable' });
    }
    if (!EDITABLE.has(report.status) && !hasIwrCap(actor, 'manage')) {
      throw new ConflictException({ error: 'iwr_bad_transition' });
    }
  }

  async list(actor: IwrActor, reportId: string): Promise<{ items: IwrItemRow[] }> {
    const report = await this.load(reportId);
    if (!(await this.canView(actor, report))) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const items = await this.repo.listItems(reportId);
    return { items };
  }

  async add(
    actor: IwrActor,
    reportId: string,
    input: Omit<IwrItemRow, 'id' | 'report_id'>,
  ): Promise<IwrItemRow> {
    const report = await this.load(reportId);
    await this.assertAuthorEditable(actor, report);
    const refKind = (input.ref_kind ?? 'none') as IwrItemRefKind;
    if (!REF_KINDS.has(refKind)) {
      throw new BadRequestException({ error: 'iwr_bad_ref_kind' });
    }
    assertValidUrl(input.evidence_url);
    return this.repo.insertItem({
      report_id: reportId,
      section_key: String(input.section_key ?? '').trim() || 'done',
      title: String(input.title ?? '').trim(),
      body: String(input.body ?? ''),
      ref_kind: refKind,
      ref_id: input.ref_id ? String(input.ref_id) : null,
      evidence_url: input.evidence_url ? String(input.evidence_url) : null,
      sort_order: Number(input.sort_order ?? 0) || 0,
    });
  }

  async patch(
    actor: IwrActor,
    reportId: string,
    itemId: string,
    patch: Partial<IwrItemRow>,
  ): Promise<IwrItemRow> {
    const report = await this.load(reportId);
    await this.assertAuthorEditable(actor, report);
    if (patch.ref_kind && !REF_KINDS.has(patch.ref_kind)) {
      throw new BadRequestException({ error: 'iwr_bad_ref_kind' });
    }
    if (patch.evidence_url !== undefined) assertValidUrl(patch.evidence_url);
    const row = await this.repo.updateItem(reportId, itemId, patch);
    if (!row) throw new NotFoundException({ error: 'iwr_item_not_found' });
    return row;
  }

  async remove(actor: IwrActor, reportId: string, itemId: string): Promise<{ ok: true }> {
    const report = await this.load(reportId);
    await this.assertAuthorEditable(actor, report);
    const ok = await this.repo.deleteItem(reportId, itemId);
    if (!ok) throw new NotFoundException({ error: 'iwr_item_not_found' });
    return { ok: true };
  }
}
