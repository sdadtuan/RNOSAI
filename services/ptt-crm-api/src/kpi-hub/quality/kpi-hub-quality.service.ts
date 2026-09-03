import { Injectable, NotFoundException } from '@nestjs/common';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import {
  KPI_HUB_ERROR_CODES,
  type AssignQualityIssueBody,
  type CreateQualityTicketBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubQualityService {
  async getOverview() {
    return withDbFallback(async () => null, () => ({
      score: 92,
      score_label: '92/100',
      rules_passed: 5,
      rules_total: 7,
      warning_count: 3,
      critical_count: 1,
      trend: [
        { date: '2026-08-28', score: 88 },
        { date: '2026-08-29', score: 89 },
        { date: '2026-08-30', score: 90 },
        { date: '2026-08-31', score: 91 },
        { date: '2026-09-01', score: 90 },
        { date: '2026-09-02', score: 91 },
        { date: '2026-09-03', score: 92 },
        { date: '2026-09-04', score: 92 },
      ],
      freshness: kpiHubMemory.sources.map((s) => ({
        id: s.id,
        name: s.name,
        system: s.system,
        status: s.status,
        last_success_at: s.last_success_at,
        sla_minutes: s.sla_minutes,
      })),
      rules: kpiHubMemory.qualityRules,
      issues_open: kpiHubMemory.qualityIssues.filter((i) => i.status !== 'RESOLVED').length,
    }));
  }

  async runCheck(staffId: number) {
    const finishedAt = new Date().toISOString();
    kpiHubMemory.activity.unshift({
      id: `act-${Date.now()}`,
      action: 'QUALITY_RUN',
      entity_type: 'quality',
      entity_label: 'Chạy kiểm tra DQ — 92/100',
      actor_name: 'Hệ thống',
      created_at: finishedAt,
    });
    return {
      run_id: `run-${Date.now()}`,
      started_at: finishedAt,
      finished_at: finishedAt,
      score: 92,
      rules_passed: 5,
      rules_total: 7,
      issues_created: 0,
      triggered_by: staffId,
    };
  }

  async getIssue(id: string) {
    const issue = kpiHubMemory.qualityIssues.find((i) => i.id === id);
    if (!issue) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    return issue;
  }

  async assign(id: string, body: AssignQualityIssueBody) {
    const idx = kpiHubMemory.qualityIssues.findIndex((i) => i.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    kpiHubMemory.qualityIssues[idx] = {
      ...kpiHubMemory.qualityIssues[idx],
      status: 'ASSIGNED',
      assignee: { id: body.assignee_id, name: 'Nguyễn Thị Lan', email: 'data.steward@ptt.vn' },
    };
    return kpiHubMemory.qualityIssues[idx];
  }

  async createTicket(id: string, body: CreateQualityTicketBody) {
    const idx = kpiHubMemory.qualityIssues.findIndex((i) => i.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    const ticketRef = `IWR-${Math.floor(Math.random() * 9000) + 1000}`;
    kpiHubMemory.qualityIssues[idx] = {
      ...kpiHubMemory.qualityIssues[idx],
      ticket_ref: ticketRef,
      status: 'ASSIGNED',
    };
    return {
      issue_id: id,
      ticket_ref: ticketRef,
      title: body.title ?? kpiHubMemory.qualityIssues[idx].title,
      priority: body.priority ?? 'MEDIUM',
      url: `/crm/iwr/tickets/${ticketRef}`,
    };
  }
}
