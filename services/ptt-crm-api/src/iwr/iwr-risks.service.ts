import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CsdNotificationsRepository } from '../csd/csd-notifications.repository';
import { IwrRisksRepository } from './iwr-distribution.repository';
import { IwrReportsRepository } from './iwr-reports.repository';
import type { IwrActor, IwrRiskRow } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function inferSeverity(title: string, body: string): IwrRiskRow['severity'] {
  const text = `${title} ${body}`.toLowerCase();
  if (/critical|khẩn cấp|urgent/i.test(text)) return 'critical';
  if (/high|cao/i.test(text)) return 'high';
  if (/low|thấp/i.test(text)) return 'low';
  return 'medium';
}

@Injectable()
export class IwrRisksService {
  constructor(
    private readonly risks: IwrRisksRepository,
    private readonly reports: IwrReportsRepository,
    private readonly notify: CsdNotificationsRepository,
  ) {}

  async list(_actor: IwrActor): Promise<{ items: IwrRiskRow[] }> {
    const items = await this.risks.listOpen();
    return { items };
  }

  async createFromBlocker(actor: IwrActor, reportId: string, itemId: string): Promise<IwrRiskRow> {
    const report = await this.reports.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_not_author' });
    }

    const items = await this.reports.listItems(reportId);
    const item = items.find((it) => it.id === itemId);
    if (!item || item.section_key !== 'blocked') {
      throw new NotFoundException({ error: 'iwr_item_not_found' });
    }

    const severity = inferSeverity(item.title, item.body);
    const row = await this.risks.insert({
      report_id: reportId,
      item_id: itemId,
      title: item.title || 'Blocker',
      severity,
      owner_staff_id: report.reviewer_staff_id,
    });

    if (severity === 'critical') {
      const targets = new Set<number>();
      if (row.owner_staff_id) targets.add(row.owner_staff_id);
      if (report.reviewer_staff_id) targets.add(report.reviewer_staff_id);
      for (const staffId of targets) {
        await this.notify.insert({
          staff_id: staffId,
          event_key: 'iwr_risk_critical',
          title_vi: 'Rủi ro nghiêm trọng từ BC nội bộ',
          body_vi: row.title.slice(0, 200),
          entity_type: 'iwr_risk',
          entity_id: row.id,
          severity: 'critical',
        });
      }
    }

    return row;
  }

  async close(actor: IwrActor, id: string): Promise<IwrRiskRow> {
    const row = await this.risks.getById(id);
    if (!row) throw new NotFoundException({ error: 'iwr_risk_not_found' });
    if (row.owner_staff_id !== actor.staffId && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const updated = await this.risks.updateStatus(id, 'closed');
    if (!updated) throw new NotFoundException({ error: 'iwr_risk_not_found' });
    return updated;
  }

  async assign(actor: IwrActor, id: string, ownerStaffId: number): Promise<IwrRiskRow> {
    if (!hasIwrCap(actor, 'manage') && !hasIwrCap(actor, 'review')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }
    const updated = await this.risks.updateStatus(id, 'mitigating', ownerStaffId);
    if (!updated) throw new NotFoundException({ error: 'iwr_risk_not_found' });
    return updated;
  }
}
