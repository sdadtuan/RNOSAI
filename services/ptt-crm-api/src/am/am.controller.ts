import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  AmAccountsService,
  type AmAccountsListQuery,
  type AmCreateAccountBody,
  type AmMergeAccountBody,
  type AmPatchAccountBody,
  type AmTransferBody,
} from './am-accounts.service';
import { AmDashboardService } from './am-dashboard.service';
import { AmHealthService, type AmHealthOverrideBody } from './am-health.service';
import { AmPlansService, type AmCreatePlanInput } from './am-plans.service';
import { AmSearchService } from './am-search.service';
import { AmNotificationsService } from './am-notifications.service';
import { AmSettingsService, type AmPublishSettingsBody } from './am-settings.service';
import {
  AmTasksService,
  type AmCreateTaskInput,
  type AmEscalateTaskInput,
  type AmResolveTaskInput,
  type AmTasksListQuery,
  type AmWaitingClientInput,
} from './am-tasks.service';
import { AmViewsService, type AmCreateViewBody } from './am-views.service';
import {
  AmOnboardingService,
  type AmCreateTemplateBody,
  type AmGoLiveBody,
  type AmHandoverChecklist,
  type AmHandoverListQuery,
  type AmOnboardingCaseListQuery,
  type AmPatchCaseBody,
  type AmPatchTemplateBody,
} from './am-onboarding.service';
import { AmContractsService, type AmContractsListQuery } from './am-contracts.service';
import {
  AmRenewalsService,
  type AmPatchRenewalBody,
  type AmRenewalsListQuery,
  type AmStartRenewalBody,
} from './am-renewals.service';
import { AmRenewalWorker } from './am-renewal.worker';
import {
  AmInteractionsService,
  type AmCreateInteractionInput,
  type AmInteractionsListQuery,
  type AmPatchInteractionInput,
} from './am-interactions.service';
import {
  AmRisksService,
  type AmCloseRecoveryInput,
  type AmCreateRecoveryInput,
  type AmCreateRiskInput,
  type AmRisksListQuery,
} from './am-risks.service';
import {
  AmOpportunitiesService,
  type AmCreateOpportunityInput,
  type AmOpportunitiesListQuery,
  type AmPatchOpportunityInput,
} from './am-opportunities.service';
import { AmReportsService } from './am-reports.service';
import { AmFinanceService } from './am-finance.service';
import {
  AmFeedbackService,
  type AmCreateFeedbackInput,
  type AmCreateSurveyInput,
  type AmFeedbackListQuery,
  type AmFollowupInput,
} from './am-feedback.service';
import {
  AmFieldsService,
  type AmCreateFieldInput,
  type AmFieldValuesBody,
  type AmPatchFieldInput,
} from './am-fields.service';
import {
  AmSlaPoliciesService,
  type AmCreateSlaInput,
  type AmPatchSlaInput,
} from './am-sla-policies.service';
import { AmAiService, type AmAiDraftBody, type AmAiFeedbackBody } from './am-ai.service';
import { RequireAmAction, StaffAmGuard } from './guards/staff-am.guard';
import type { AmScope } from './am.types';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/am')
@UseGuards(StaffOrInternalKeyGuard, StaffAmGuard)
export class AmController {
  constructor(
    private readonly dashboard: AmDashboardService,
    private readonly tasks: AmTasksService,
    private readonly accounts: AmAccountsService,
    private readonly plans: AmPlansService,
    private readonly searchService: AmSearchService,
    private readonly health: AmHealthService,
    private readonly settings: AmSettingsService,
    private readonly notifications: AmNotificationsService,
    private readonly views: AmViewsService,
    private readonly onboarding: AmOnboardingService,
    private readonly contracts: AmContractsService,
    private readonly renewals: AmRenewalsService,
    private readonly renewalWorker: AmRenewalWorker,
    private readonly interactions: AmInteractionsService,
    private readonly risks: AmRisksService,
    private readonly opportunities: AmOpportunitiesService,
    private readonly reports: AmReportsService,
    private readonly finance: AmFinanceService,
    private readonly feedback: AmFeedbackService,
    private readonly fields: AmFieldsService,
    private readonly slaPolicies: AmSlaPoliciesService,
    private readonly ai: AmAiService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorStaffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  private async actorCaps(req: AuthedReq): Promise<StaffSectionCap[]> {
    if (req.staffAuthVia === 'internal' || !req.staffUser) return [];
    return (await this.staffAuth.me(req.staffUser)).caps;
  }

  @Get('command-center')
  @RequireAmAction('view')
  commandCenter(@Req() req: AuthedReq, @Query() q: { from?: string; to?: string; scope?: AmScope }) {
    return this.dashboard.get(req, q);
  }

  @Get('search')
  @RequireAmAction('view')
  search(@Req() req: AuthedReq, @Query() q: { q?: string; scope?: AmScope }) {
    return this.searchService.search(req, q);
  }

  @Get('settings')
  @RequireAmAction('view')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  @RequireAmAction('manage')
  async putSettings(@Req() req: AuthedReq, @Body() body: AmPublishSettingsBody) {
    return this.settings.publish(body ?? ({} as AmPublishSettingsBody), await this.actorStaffId(req));
  }

  @Get('notifications')
  @RequireAmAction('view')
  async listNotifications(@Req() req: AuthedReq) {
    return this.notifications.list(await this.actorStaffId(req));
  }

  @Post('notifications/:id/read')
  @RequireAmAction('view')
  async markNotificationRead(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.notifications.markRead(id, await this.actorStaffId(req));
  }

  @Get('health')
  @RequireAmAction('view')
  listHealth(
    @Req() req: AuthedReq,
    @Query() q: { scope?: AmScope; from?: string; to?: string },
  ) {
    return this.health.center(req, q);
  }

  @Get('health/:agencyClientId')
  @RequireAmAction('view')
  getHealth(@Req() req: AuthedReq, @Param('agencyClientId') agencyClientId: string) {
    return this.health.detail(req, agencyClientId);
  }

  @Post('health/recompute')
  @RequireAmAction('manage')
  async recomputeHealth(@Req() req: AuthedReq, @Body() body?: { as_of?: string }) {
    return this.health.recompute({
      asOf: body?.as_of,
      actorStaffId: await this.actorStaffId(req),
    });
  }

  @Post('health/:agencyClientId/override')
  @RequireAmAction('manage')
  async overrideHealth(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmHealthOverrideBody,
  ) {
    return this.health.override(req, agencyClientId, body ?? {}, await this.actorStaffId(req));
  }

  @Get('tasks')
  @RequireAmAction('view')
  listTasks(@Req() req: AuthedReq, @Query() q: AmTasksListQuery) {
    return this.tasks.list(req, q);
  }

  @Post('tasks')
  @RequireAmAction('edit')
  async createTask(@Req() req: AuthedReq, @Body() body: AmCreateTaskInput) {
    return this.tasks.create(body, await this.actorStaffId(req));
  }

  @Post('tasks/dismiss')
  @RequireAmAction('edit')
  async dismissTask(
    @Req() req: AuthedReq,
    @Body() body: { source: string; source_ref: string },
  ) {
    return this.tasks.dismiss(body, await this.actorStaffId(req));
  }

  @Post('tasks/accept-bulk')
  @RequireAmAction('edit')
  async acceptTasksBulk(@Req() req: AuthedReq, @Body() body: { ids?: string[] }) {
    return this.tasks.acceptBulk(req, body ?? {}, await this.actorStaffId(req));
  }

  @Post('tasks/:id/accept')
  @RequireAmAction('edit')
  async acceptTask(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tasks.accept(id, await this.actorStaffId(req));
  }

  @Get('tasks/:id')
  @RequireAmAction('view')
  getTask(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tasks.view(req, id);
  }

  @Post('tasks/:id/waiting-client')
  @RequireAmAction('edit')
  async waitingClientTask(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmWaitingClientInput,
  ) {
    return this.tasks.waitingClient(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('tasks/:id/resolve')
  @RequireAmAction('edit')
  async resolveTask(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AmResolveTaskInput) {
    return this.tasks.resolve(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('tasks/:id/escalate')
  @RequireAmAction('edit')
  async escalateTask(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmEscalateTaskInput,
  ) {
    return this.tasks.escalate(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('accounts')
  @RequireAmAction('view')
  async listAccounts(@Req() req: AuthedReq, @Query() q: AmAccountsListQuery) {
    return this.accounts.list(req, q);
  }

  @Post('accounts')
  @RequireAmAction('edit')
  async createAccount(@Req() req: AuthedReq, @Body() body: AmCreateAccountBody) {
    return this.accounts.createAccount(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia,
    });
  }

  @Post('accounts/transfer')
  @RequireAmAction('assign')
  async transferAccounts(@Req() req: AuthedReq, @Body() body: AmTransferBody) {
    return this.accounts.transfer(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Get('accounts/:agencyClientId')
  @RequireAmAction('view')
  async getAccount(@Req() req: AuthedReq, @Param('agencyClientId') agencyClientId: string) {
    return this.accounts.get(req, agencyClientId);
  }

  @Patch('accounts/:agencyClientId')
  @RequireAmAction('edit')
  async patchAccount(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmPatchAccountBody,
  ) {
    return this.accounts.patch(req, agencyClientId, body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Post('accounts/:agencyClientId/merge')
  @RequireAmAction('manage')
  async mergeAccount(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmMergeAccountBody,
  ) {
    return this.accounts.merge(req, agencyClientId, body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
      via: req.staffAuthVia === 'internal' ? 'internal' : 'jwt',
    });
  }

  @Get('views')
  @RequireAmAction('view')
  async listViews(@Req() req: AuthedReq) {
    return this.views.list(await this.actorStaffId(req));
  }

  @Post('views')
  @RequireAmAction('view')
  async createView(@Req() req: AuthedReq, @Body() body: AmCreateViewBody) {
    return this.views.create(body, {
      staffId: await this.actorStaffId(req),
      caps: await this.actorCaps(req),
    });
  }

  @Post('plans')
  @RequireAmAction('edit')
  async createPlan(@Req() req: AuthedReq, @Body() body: AmCreatePlanInput) {
    const caps = await this.actorCaps(req);
    const manage =
      req.staffAuthVia === 'internal' ||
      caps.some((cap) => cap.section === 'crm_am' && cap.action === 'manage');
    return this.plans.create(body, await this.actorStaffId(req), { manage });
  }

  @Get('risks')
  @RequireAmAction('view')
  listRisks(@Req() req: AuthedReq, @Query() q: AmRisksListQuery) {
    return this.risks.listRisks(req, q);
  }

  @Post('risks')
  @RequireAmAction('edit')
  async createRisk(@Req() req: AuthedReq, @Body() body: AmCreateRiskInput) {
    return this.risks.createRisk(req, body ?? {}, await this.actorStaffId(req));
  }

  @Get('recovery-plans')
  @RequireAmAction('view')
  listRecoveryPlans(@Req() req: AuthedReq, @Query() q: AmRisksListQuery) {
    return this.risks.listRecovery(req, q);
  }

  @Post('recovery-plans')
  @RequireAmAction('edit')
  async createRecoveryPlan(@Req() req: AuthedReq, @Body() body: AmCreateRecoveryInput) {
    return this.risks.createRecovery(req, body ?? {}, await this.actorStaffId(req));
  }

  @Post('recovery-plans/:id/close')
  @RequireAmAction('edit')
  async closeRecoveryPlan(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmCloseRecoveryInput,
  ) {
    return this.risks.close(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('handovers')
  @RequireAmAction('view')
  listHandovers(@Req() req: AuthedReq, @Query() q: AmHandoverListQuery) {
    return this.onboarding.list(req, q);
  }

  @Get('handovers/:id')
  @RequireAmAction('view')
  getHandover(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.onboarding.get(req, id);
  }

  @Post('handovers/:id/accept')
  @RequireAmAction('edit')
  async acceptHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { checklist?: AmHandoverChecklist },
  ) {
    return this.onboarding.accept(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('handovers/:id/reject')
  @RequireAmAction('edit')
  async rejectHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.onboarding.reject(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('handovers/:id/needs-info')
  @RequireAmAction('edit')
  async needsInfoHandover(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.onboarding.needsInfo(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('onboarding-cases')
  @RequireAmAction('view')
  listOnboardingCases(@Req() req: AuthedReq, @Query() q: AmOnboardingCaseListQuery) {
    return this.onboarding.listCases(req, q);
  }

  @Get('onboarding-cases/:id')
  @RequireAmAction('view')
  getOnboardingCase(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.onboarding.getCase(req, id);
  }

  @Patch('onboarding-cases/:id')
  @RequireAmAction('edit')
  patchOnboardingCase(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AmPatchCaseBody) {
    return this.onboarding.patchCase(req, id, body ?? {});
  }

  @Post('onboarding-cases/:id/go-live')
  @RequireAmAction('edit')
  async goLiveOnboardingCase(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AmGoLiveBody) {
    return this.onboarding.goLive(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('onboarding-templates')
  @RequireAmAction('view')
  listOnboardingTemplates(@Req() req: AuthedReq) {
    return this.onboarding.listTemplates(req);
  }

  @Post('onboarding-templates')
  @RequireAmAction('manage')
  createOnboardingTemplate(@Req() req: AuthedReq, @Body() body: AmCreateTemplateBody) {
    return this.onboarding.createTemplate(req, body ?? {});
  }

  @Patch('onboarding-templates/:id')
  @RequireAmAction('manage')
  patchOnboardingTemplate(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmPatchTemplateBody,
  ) {
    return this.onboarding.patchTemplate(req, id, body ?? {});
  }

  @Post('onboarding-templates/:id/clone')
  @RequireAmAction('manage')
  cloneOnboardingTemplate(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.onboarding.cloneTemplate(req, id);
  }

  @Post('onboarding-templates/:id/publish')
  @RequireAmAction('manage')
  publishOnboardingTemplate(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.onboarding.publishTemplate(req, id);
  }

  @Get('contracts')
  @RequireAmAction('view')
  listContracts(@Req() req: AuthedReq, @Query() q: AmContractsListQuery) {
    return this.contracts.list(req, q);
  }

  @Get('contracts/:id')
  @RequireAmAction('view')
  getContract(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.contracts.get(req, id);
  }

  @Get('renewals')
  @RequireAmAction('view')
  listRenewals(@Req() req: AuthedReq, @Query() q: AmRenewalsListQuery) {
    return this.renewals.list(req, q);
  }

  @Post('renewals/window-job')
  @RequireAmAction('manage')
  runRenewalWindowJob(@Body() body?: { as_of?: string }) {
    return this.renewalWorker.run({ asOf: body?.as_of });
  }

  @Post('renewals')
  @RequireAmAction('edit')
  async startRenewal(@Req() req: AuthedReq, @Body() body: AmStartRenewalBody) {
    return this.renewals.start(req, body ?? {}, await this.actorStaffId(req));
  }

  @Get('renewals/:id')
  @RequireAmAction('view')
  getRenewal(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.renewals.get(req, id);
  }

  @Patch('renewals/:id')
  @RequireAmAction('edit')
  async patchRenewal(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AmPatchRenewalBody) {
    return this.renewals.patch(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('opportunities')
  @RequireAmAction('view')
  listOpportunities(@Req() req: AuthedReq, @Query() q: AmOpportunitiesListQuery) {
    return this.opportunities.list(req, q);
  }

  @Post('opportunities')
  @RequireAmAction('edit')
  async createOpportunity(@Req() req: AuthedReq, @Body() body: AmCreateOpportunityInput) {
    return this.opportunities.create(req, body ?? {}, await this.actorStaffId(req));
  }

  @Patch('opportunities/:id')
  @RequireAmAction('edit')
  async patchOpportunity(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmPatchOpportunityInput,
  ) {
    return this.opportunities.patch(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('reports/retention')
  @RequireAmAction('view')
  reportsRetention(
    @Req() req: AuthedReq,
    @Query() q: { from?: string; to?: string; scope?: AmScope },
  ) {
    return this.reports.retention(req, q);
  }

  @Get('finance/:agencyClientId')
  @RequireAmAction('view')
  getFinance(@Req() req: AuthedReq, @Param('agencyClientId') agencyClientId: string) {
    return this.finance.get(req, agencyClientId);
  }

  @Get('feedback')
  @RequireAmAction('view')
  listFeedback(@Req() req: AuthedReq, @Query() q: AmFeedbackListQuery) {
    return this.feedback.list(req, q);
  }

  @Post('feedback')
  @RequireAmAction('edit')
  async createFeedback(@Req() req: AuthedReq, @Body() body: AmCreateFeedbackInput) {
    return this.feedback.create(req, body ?? {}, await this.actorStaffId(req));
  }

  @Post('feedback/:id/followup')
  @RequireAmAction('edit')
  async followupFeedback(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmFollowupInput,
  ) {
    return this.feedback.followup(req, id, await this.actorStaffId(req), body ?? {});
  }

  @Get('surveys')
  @RequireAmAction('view')
  listSurveys(@Req() req: AuthedReq) {
    return this.feedback.listSurveys(req);
  }

  @Post('surveys')
  @RequireAmAction('edit')
  async createSurvey(@Req() req: AuthedReq, @Body() body: AmCreateSurveyInput) {
    return this.feedback.createSurvey(req, body ?? {}, await this.actorStaffId(req));
  }

  @Get('fields')
  @RequireAmAction('view')
  listFields(@Query() q: { industry?: string }) {
    return this.fields.list(q.industry);
  }

  @Post('fields')
  @RequireAmAction('manage')
  async createField(@Req() req: AuthedReq, @Body() body: AmCreateFieldInput) {
    return this.fields.create(body ?? {}, await this.actorStaffId(req));
  }

  @Patch('fields/:id')
  @RequireAmAction('manage')
  async patchField(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AmPatchFieldInput) {
    return this.fields.patch(id, body ?? {}, await this.actorStaffId(req));
  }

  @Post('fields/:id/publish')
  @RequireAmAction('manage')
  async publishField(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.fields.publish(id, await this.actorStaffId(req));
  }

  @Get('field-values/:agencyClientId')
  @RequireAmAction('view')
  getFieldValues(@Req() req: AuthedReq, @Param('agencyClientId') agencyClientId: string) {
    return this.fields.getValues(req, agencyClientId);
  }

  @Put('field-values/:agencyClientId')
  @RequireAmAction('edit')
  putFieldValues(
    @Req() req: AuthedReq,
    @Param('agencyClientId') agencyClientId: string,
    @Body() body: AmFieldValuesBody,
  ) {
    return this.fields.putValues(req, agencyClientId, body ?? {});
  }

  @Get('sla-policies')
  @RequireAmAction('view')
  listSlaPolicies() {
    return this.slaPolicies.list();
  }

  @Post('sla-policies')
  @RequireAmAction('manage')
  async createSlaPolicy(@Req() req: AuthedReq, @Body() body: AmCreateSlaInput) {
    return this.slaPolicies.create(body ?? {}, await this.actorStaffId(req));
  }

  @Patch('sla-policies/:id')
  @RequireAmAction('manage')
  async patchSlaPolicy(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmPatchSlaInput,
  ) {
    return this.slaPolicies.patch(id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('interactions')
  @RequireAmAction('view')
  listInteractions(@Req() req: AuthedReq, @Query() q: AmInteractionsListQuery) {
    return this.interactions.list(req, q);
  }

  @Post('interactions')
  @RequireAmAction('edit')
  async createInteraction(@Req() req: AuthedReq, @Body() body: AmCreateInteractionInput) {
    return this.interactions.create(req, body ?? {}, await this.actorStaffId(req));
  }

  @Patch('interactions/:id')
  @RequireAmAction('edit')
  async patchInteraction(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: AmPatchInteractionInput,
  ) {
    return this.interactions.patch(req, id, body ?? {}, await this.actorStaffId(req));
  }

  @Get('ai/status')
  @RequireAmAction('view')
  getAiStatus() {
    return this.ai.status();
  }

  @Post('ai/draft')
  @RequireAmAction('view')
  async createAiDraft(@Req() req: AuthedReq, @Body() body: AmAiDraftBody) {
    return this.ai.draft(req, body ?? {}, await this.actorStaffId(req));
  }

  @Post('ai/feedback')
  @RequireAmAction('view')
  async createAiFeedback(@Req() req: AuthedReq, @Body() body: AmAiFeedbackBody) {
    return this.ai.feedback(req, body ?? {}, await this.actorStaffId(req));
  }
}
