import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffKpiHubViewGuard } from '../guards/staff-kpi-hub.guard';
import { PerformanceService } from './performance.service';
import type { PmCorrectiveAction, PmScorecardItem, PmSettings, PmViewerRole } from './performance.types';

@Controller('api/crm/kpi-hub/performance')
@UseGuards(StaffOrInternalKeyGuard, StaffKpiHubViewGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  private withIdempotency<T>(key: string | undefined, fn: () => T | Promise<T>): T | Promise<T> {
    if (key) {
      const cached = this.performance.getIdempotency(key);
      if (cached != null) return cached as T;
    }
    const result = fn();
    if (key && result && typeof (result as Promise<T>).then === 'function') {
      return (result as Promise<T>).then((value) => {
        this.performance.putIdempotency(key, value);
        return value;
      });
    }
    if (key) this.performance.putIdempotency(key, result);
    return result;
  }

  @Get('dashboard')
  dashboard() {
    return this.performance.getDashboard();
  }

  @Get('assignments')
  assignments(@Query('scope') scope?: string) {
    return this.performance.listAssignments(scope);
  }

  @Get('assignments/:id')
  getAssignment(@Param('id') id: string) {
    return this.performance.getAssignment(id);
  }

  @Post('assignments')
  createAssignment(
    @Body() body: Parameters<PerformanceService['createAssignment']>[0],
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.withIdempotency(idempotencyKey, () => this.performance.createAssignment(body));
  }

  @Post('assignments/:id/activate')
  activateAssignment(@Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.withIdempotency(idempotencyKey, () => this.performance.activateAssignment(id));
  }

  @Get('scorecards')
  scorecards() {
    return this.performance.listScorecards();
  }

  @Post('scorecards/:id/items')
  addItem(@Param('id') id: string, @Body() body: Omit<PmScorecardItem, 'id'>) {
    return this.performance.addScorecardItem(id, body);
  }

  @Get('check-ins')
  checkIns(@Query('assignment') assignmentId?: string) {
    return this.performance.listCheckIns(assignmentId);
  }

  @Post('check-ins')
  createCheckIn(
    @Body() body: Parameters<PerformanceService['createCheckIn']>[0],
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.withIdempotency(idempotencyKey, () => this.performance.createCheckIn(body));
  }

  @Post('check-ins/:id/review')
  reviewCheckIn(
    @Param('id') id: string,
    @Body() body: { to: 'approved' | 'returned' | 'escalated'; comment?: string },
  ) {
    return this.performance.reviewCheckIn(id, body);
  }

  @Post('actions')
  createAction(@Body() body: Omit<PmCorrectiveAction, 'id'>) {
    return this.performance.createAction(body);
  }

  @Post('period-close')
  closePeriod(
    @Body() body: { scorecard_id: string; period: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.withIdempotency(idempotencyKey, () => this.performance.closePeriod(body));
  }

  @Post('period-reopen')
  reopenPeriod(@Body() body: { scorecard_id: string; period: string; reason: string }) {
    return this.performance.reopenPeriod(body);
  }

  @Get('snapshots')
  snapshots(@Query('scorecard_id') scorecardId?: string, @Query('period') period?: string) {
    return this.performance.listSnapshots(scorecardId, period);
  }

  @Get('audit-logs')
  auditLogs() {
    return this.performance.listAuditLogs();
  }

  @Post('reports/export')
  exportReport(@Body() body: { actor?: string; role?: PmViewerRole }) {
    return this.performance.exportReport({ actor: body.actor ?? 'staff', role: body.role ?? 'lead' });
  }

  @Get('marketing')
  marketing() {
    return this.performance.getMarketing();
  }

  @Get('campaigns')
  campaigns() {
    return this.performance.getCampaigns();
  }

  @Get('crm-source')
  crmSource() {
    return this.performance.getCrmSource();
  }

  @Get('reports')
  reports() {
    return this.performance.getReports();
  }

  @Get('settings')
  settings() {
    return this.performance.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() body: Partial<PmSettings>) {
    return this.performance.updateSettings(body);
  }
}
