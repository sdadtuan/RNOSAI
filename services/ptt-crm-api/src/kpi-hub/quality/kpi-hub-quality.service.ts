import { Injectable, NotFoundException } from '@nestjs/common';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import { KpiHubQualityRunnerService } from './kpi-hub-quality-runner.service';
import {
  KPI_HUB_ERROR_CODES,
  type AssignQualityIssueBody,
  type CreateQualityTicketBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubQualityService {
  constructor(private readonly runner: KpiHubQualityRunnerService) {}

  async getOverview() {
    this.runner.ensureSeedRules();
    const latestRun = kpiHubMemory.qualityRuns[0];
    const score = latestRun?.score ?? 92;
    return withDbFallback(async () => null, () => ({
      score,
      score_label: `${score}/100`,
      rules_passed: latestRun?.rules_passed ?? 12,
      rules_total: latestRun?.rules_total ?? kpiHubMemory.qualityRules.filter((r) => r.enabled).length,
      warning_count: kpiHubMemory.qualityIssues.filter((i) => i.severity === 'WARNING' && i.status !== 'RESOLVED').length,
      critical_count: kpiHubMemory.qualityIssues.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length,
      trend: [
        { date: '2026-08-28', score: 88 },
        { date: '2026-08-29', score: 89 },
        { date: '2026-08-30', score: 90 },
        { date: '2026-08-31', score: 91 },
        { date: '2026-09-01', score: 90 },
        { date: '2026-09-02', score: 91 },
        { date: '2026-09-03', score: 92 },
        { date: '2026-09-04', score },
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
      last_run: latestRun ?? null,
    }));
  }

  async runCheck(staffId: number) {
    const result = this.runner.runAll(staffId);
    kpiHubMemory.activity.unshift({
      id: `act-${Date.now()}`,
      action: 'QUALITY_RUN',
      entity_type: 'quality',
      entity_label: `Chạy kiểm tra DQ — ${result.score}/100`,
      actor_name: 'Hệ thống',
      created_at: result.finished_at,
    });
    return {
      run_id: result.id,
      started_at: result.started_at,
      finished_at: result.finished_at,
      score: result.score,
      rules_passed: result.rules_passed,
      rules_total: result.rules_total,
      issues_created: result.issues_created,
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
    kpiHubMemory.activity.unshift({
      id: `act-${Date.now()}`,
      action: 'QUALITY_ASSIGN',
      entity_type: 'quality_issue',
      entity_label: kpiHubMemory.qualityIssues[idx].title,
      actor_name: 'Data Steward',
      created_at: new Date().toISOString(),
    });
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
    kpiHubMemory.activity.unshift({
      id: `act-${Date.now()}`,
      action: 'QUALITY_TICKET',
      entity_type: 'quality_issue',
      entity_label: `${ticketRef} — ${kpiHubMemory.qualityIssues[idx].title}`,
      actor_name: 'Hệ thống',
      created_at: new Date().toISOString(),
    });
    return {
      issue_id: id,
      ticket_ref: ticketRef,
      title: body.title ?? kpiHubMemory.qualityIssues[idx].title,
      priority: body.priority ?? 'MEDIUM',
      url: `/crm/iwr/tickets/${ticketRef}`,
      integration: 'IWR_STUB',
    };
  }
}
