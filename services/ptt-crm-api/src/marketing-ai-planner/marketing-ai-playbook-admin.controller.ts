import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAiAdminGuard } from '../ai-intelligence/guards/staff-ai-admin.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffMarketingAiPlannerApproveGuard,
  StaffMarketingAiPlannerGenerateGuard,
  StaffMarketingAiPlaybookAdminViewGuard,
  StaffMarketingAiPlaybookStaffApproveGuard,
} from './guards/staff-marketing-ai-planner.guard';
import {
  MktAiPlaybookAdminService,
  type ActivateVersionBody,
  type DecideVersionBody,
} from './mkt-ai-playbook-admin.service';
import type { MktAiServicePolicyPatch } from './mkt-ai-service-policy.repository';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller()
export class MarketingAiPlaybookAdminController {
  constructor(
    private readonly admin: MktAiPlaybookAdminService,
    private readonly playbooks: MarketingAiPlaybookService,
  ) {}

  /** Legacy disk catalog — kept for DevOps smoke (WS-P4-08) */
  @Get('api/v1/admin/mkt-ai/playbooks/catalog-disk')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  listDiskCatalog() {
    return this.playbooks.listAdminCatalog();
  }

  @Get('api/v1/admin/mkt-ai/playbooks')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookAdminViewGuard)
  listPlaybooks() {
    return this.admin.listCatalog();
  }

  @Get('api/v1/admin/mkt-ai/playbooks/:slug')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookAdminViewGuard)
  getPlaybook(@Param('slug') slug: string) {
    return this.admin.getSlugDetail(slug);
  }

  @Patch('api/v1/admin/mkt-ai/playbooks/:slug/policy')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerApproveGuard)
  patchPolicy(
    @Param('slug') slug: string,
    @Body() body: MktAiServicePolicyPatch,
    @Req() req: Request,
  ) {
    return this.admin.patchPolicy(slug, body, actorEmail(req));
  }

  @Post('api/v1/admin/mkt-ai/playbooks/:slug/learn')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerGenerateGuard)
  enqueueLearn(
    @Param('slug') slug: string,
    @Body() body: { exclude_lifecycle_ids?: number[] },
    @Req() req: Request,
  ) {
    const exclude = Array.isArray(body?.exclude_lifecycle_ids)
      ? body.exclude_lifecycle_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    return this.admin.enqueueLearn(slug, actorEmail(req), exclude);
  }

  @Get('api/v1/admin/mkt-ai/playbooks/:slug/learn/:jobId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookAdminViewGuard)
  getLearnJob(@Param('slug') slug: string, @Param('jobId', ParseIntPipe) jobId: number) {
    return this.admin.getLearnJob(slug, jobId);
  }

  @Patch('api/v1/admin/mkt-ai/playbooks/versions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerGenerateGuard)
  patchVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { document_json: Record<string, unknown> },
  ) {
    return this.admin.patchVersionDocument(id, body?.document_json ?? {});
  }

  @Post('api/v1/admin/mkt-ai/playbooks/versions/:id/submit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerGenerateGuard)
  submitVersion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.admin.submitVersion(id, actorEmail(req));
  }

  @Post('api/v1/admin/mkt-ai/playbooks/versions/:id/decide')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookStaffApproveGuard)
  decideVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DecideVersionBody,
    @Req() req: Request,
  ) {
    return this.admin.decideVersion(id, body, actorEmail(req));
  }

  @Post('api/v1/admin/mkt-ai/playbooks/versions/:id/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookStaffApproveGuard)
  activateVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActivateVersionBody,
    @Req() req: Request,
  ) {
    return this.admin.activateVersion(id, body ?? {}, actorEmail(req));
  }

  @Post('api/v1/admin/mkt-ai/playbooks/versions/:id/rollback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlaybookStaffApproveGuard)
  rollbackVersion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.admin.rollbackVersion(id, actorEmail(req));
  }
}
