import { Injectable } from '@nestjs/common';
import { descendantIds, isOnPath, sameDepartment } from './iwr-org.util';
import { assertW1Recipients, defaultToStaffId } from './iwr-recipient.util';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import type { IwrActor, IwrInboxBox, IwrReportRow, IwrStaffNode, IwrTeamNode } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function deriveStatus(report: IwrReportRow | null): IwrTeamNode['derived'] {
  if (!report) return 'missing';
  if (report.status === 'waived') return 'waived';
  if (report.status === 'acknowledged') return 'acked';
  if (report.status === 'draft') return 'draft';
  if (report.is_late && (report.status === 'submitted' || report.status === 'supplemented')) {
    return 'late';
  }
  if (report.status === 'submitted' || report.status === 'supplemented') return 'submitted';
  return 'draft';
}

@Injectable()
export class IwrInboxService {
  constructor(
    private readonly repo: IwrReportsRepository,
    private readonly org: IwrOrgRepository,
  ) {}

  async list(actor: IwrActor, box: IwrInboxBox): Promise<{ items: IwrReportRow[] }> {
    const items = await this.repo.listInbox(actor.staffId, box);
    return { items };
  }

  async directory(
    actor: IwrActor,
    q: string,
    purpose: 'cc' | 'to' | 'mention',
  ): Promise<{ items: IwrStaffNode[] }> {
    const author = await this.org.getStaff(actor.staffId);
    if (!author) return { items: [] };
    const nodes = await this.org.listActiveStaff();

    if (purpose === 'to') {
      const toId = defaultToStaffId(author);
      if (toId == null) return { items: [] };
      const mgr = nodes.find((n) => n.id === toId);
      return { items: mgr ? [mgr] : [] };
    }

    const hits =
      q.trim().length > 0
        ? await this.org.searchDirectory(q, 20)
        : nodes.filter((n) => sameDepartment(author, n) && n.id !== author.id).slice(0, 20);

    const out: IwrStaffNode[] = [];
    for (const candidate of hits) {
      if (candidate.id === author.id) continue;
      if (purpose === 'mention') {
        if (sameDepartment(author, candidate) || isOnPath(author.id, candidate.id, nodes)) {
          out.push(candidate);
        }
        continue;
      }
      try {
        assertW1Recipients({
          author,
          actor,
          nodes,
          toIds: defaultToStaffId(author) != null ? [defaultToStaffId(author)!] : [],
          ccIds: [candidate.id],
          bccIds: [],
        });
        out.push(candidate);
      } catch {
        // skip disallowed Cc
      }
    }
    return { items: out.slice(0, 20) };
  }

  async team(
    actor: IwrActor,
    query: { period_start: string; period_end: string; template_code?: string },
  ): Promise<{ nodes: IwrTeamNode[] }> {
    const all = await this.org.listActiveStaff();
    let staffIds: number[];
    if (hasIwrCap(actor, 'executive') || hasIwrCap(actor, 'manage')) {
      staffIds = all.map((n) => n.id);
    } else {
      staffIds = [actor.staffId, ...descendantIds(actor.staffId, all)];
    }

    const reports = await this.repo.listForPeriod({
      period_start: query.period_start,
      period_end: query.period_end,
      template_code: query.template_code,
      author_ids: staffIds,
    });
    const byAuthor = new Map(reports.map((r) => [r.author_staff_id, r]));

    const nodes: IwrTeamNode[] = staffIds
      .map((id) => all.find((n) => n.id === id))
      .filter((n): n is IwrStaffNode => Boolean(n))
      .map((n) => {
        const report = byAuthor.get(n.id) ?? null;
        return { ...n, report, derived: deriveStatus(report) };
      });

    return { nodes };
  }
}
