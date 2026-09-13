import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { readImageSopFlags } from './cp-image-sop.flags';
import { isImgIntent } from './cp-image-sop-intents.util';
import type { ImgIntent, ImgQcProfile } from './cp-image-sop.types';
import { CpImageSopService } from './cp-image-sop.service';
import {
  RequireImgSection,
  StaffImgGuard,
} from './guards/staff-img.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/cp/image')
@UseGuards(StaffImgGuard)
export class CpImageController {
  constructor(
    private readonly service: CpImageSopService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('flags')
  @RequireImgSection('crm_img', 'view')
  flags() {
    return this.service.flags();
  }

  @Get('dashboard/kpis')
  @RequireImgSection('crm_img', 'view')
  dashboardKpis() {
    this.service.assertEnabled();
    return this.service.dashboardKpis();
  }

  @Get('operations/board')
  @RequireImgSection('crm_img', 'view')
  operationsBoard() {
    this.service.assertEnabled();
    return this.service.operationsBoard();
  }

  @Get('jobs')
  @RequireImgSection('crm_img', 'view')
  listJobs() {
    this.service.assertEnabled();
    return this.service.listJobs();
  }

  @Post('jobs/draft')
  @RequireImgSection('crm_img.render', 'execute')
  async draftJob(@Req() req: StaffReq, @Body() body: Record<string, unknown>) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    const intent = parseIntent(body.intent);
    return this.service.draftJob(
      {
        agency_client_id: Number(body.agency_client_id),
        service_lifecycle_id: nullableString(body.service_lifecycle_id),
        sop_version_id: requiredString(body.sop_version_id, 'sop_version_id_required'),
        intent,
        variants: Number(body.variants ?? 2),
        creative_direction: String(body.creative_direction ?? ''),
        idempotency_key: requiredString(body.idempotency_key, 'idempotency_key_required'),
      },
      staffId,
    );
  }

  @Post('jobs/:id/submit')
  @RequireImgSection('crm_img.render', 'execute')
  async submitJob(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: { confirm?: boolean },
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.submitJob(id, body?.confirm === true, staffId);
  }

  @Post('jobs/:id/explore')
  @RequireImgSection('crm_img.render', 'execute')
  async explore(@Req() req: StaffReq, @Param('id') id: string) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.explore(id, staffId);
  }

  @Post('jobs/:id/select')
  @RequireImgSection('crm_img.gate1', 'execute')
  async selectWinner(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: { winner_asset_id?: string },
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    const assetId = requiredString(body.winner_asset_id, 'winner_asset_id_required');
    await this.service.selectWinner(id, assetId, staffId);
    return { ok: true };
  }

  @Post('jobs/:id/refine')
  @RequireImgSection('crm_img.render', 'execute')
  async refine(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: { mode?: 'weave' | 'overlay' | 'comfy' },
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.refine(id, body.mode ?? 'overlay', staffId);
  }

  @Post('jobs/:id/upscale')
  @RequireImgSection('crm_img.render', 'execute')
  async upscale(@Req() req: StaffReq, @Param('id') id: string) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    await this.service.upscale(id, staffId);
    return { ok: true };
  }

  @Post('jobs/:id/pack')
  @RequireImgSection('crm_img.render', 'execute')
  async pack(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: { ratios?: Array<'1:1' | '4:5' | '9:16' | '16:9'> },
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.pack(id, body.ratios ?? ['1:1', '4:5', '9:16', '16:9'], staffId);
  }

  @Get('assets')
  @RequireImgSection('crm_img', 'view')
  listAssets() {
    this.service.assertEnabled();
    return this.service.listImageAssets();
  }

  @Get('assets/:id/provenance')
  @RequireImgSection('crm_img', 'view')
  assetProvenance(@Param('id') id: string) {
    this.service.assertEnabled();
    return this.service.assetProvenance(id);
  }

  @Get('sops')
  @RequireImgSection('crm_img', 'view')
  listSops() {
    this.service.assertEnabled();
    return this.service.listSops();
  }

  @Post('sops')
  @RequireImgSection('crm_img.sop', 'edit')
  async createSop(@Req() req: StaffReq, @Body() body: Record<string, unknown>) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.createSop(
      {
        code: requiredString(body.code, 'code_required'),
        name: requiredString(body.name, 'name_required'),
        category: requiredString(body.category, 'category_required'),
        data_class: requiredString(body.data_class, 'data_class_required'),
        outcome: String(body.outcome ?? ''),
      },
      staffId,
    );
  }

  @Post('sops/:id/versions')
  @RequireImgSection('crm_img.sop', 'edit')
  async saveVersion(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    return this.service.saveVersion(
      id,
      {
        version: requiredString(body.version, 'version_required'),
        manifest_json: objectValue(body.manifest_json),
        creative_genome: objectValue(body.creative_genome),
        prompt_package_id: nullableString(body.prompt_package_id),
      },
      staffId,
    );
  }

  @Get('brand/:kitId/graph')
  @RequireImgSection('crm_img', 'view')
  brandGraph(@Param('kitId') kitId: string) {
    this.service.assertEnabled();
    return this.service.getBrandGraph(kitId);
  }

  @Get('intents')
  @RequireImgSection('crm_img', 'view')
  listIntents() {
    this.service.assertEnabled();
    return this.service.listIntents();
  }

  @Get('recipes/preview')
  @RequireImgSection('crm_img', 'view')
  previewRecipe(@Query() query: Record<string, unknown>) {
    this.service.assertEnabled();
    return this.service.previewRouter({
      intent: parseIntent(query.intent),
      data_class: String(query.data_class ?? 'INTERNAL'),
    });
  }

  @Get('providers/router/preview')
  @RequireImgSection('crm_img', 'view')
  previewRouter(@Query() query: Record<string, unknown>) {
    this.service.assertEnabled();
    return this.service.previewRouter({
      intent: parseIntent(query.intent ?? 'hero_lifestyle'),
      data_class: String(query.data_class ?? 'INTERNAL'),
    });
  }

  @Get('finops/summary')
  @RequireImgSection('crm_img.finance', 'view')
  finopsSummary() {
    this.service.assertEnabled();
    return this.service.finopsSummary();
  }

  @Get('governance/audit')
  @RequireImgSection('crm_img.manage', 'manage')
  governanceAudit() {
    this.service.assertEnabled();
    return this.service.governanceAudit();
  }

  @Post('gates/:projectId/:n')
  @RequireImgSection('crm_img.gate1', 'execute')
  async passGate(
    @Req() req: StaffReq,
    @Param('projectId') projectId: string,
    @Param('n') n: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.service.assertEnabled();
    const staffId = await this.resolveStaffId(req);
    const gateNum = Number(n) as 1 | 2 | 3;
    await this.service.passGate(projectId, gateNum, staffId, objectValue(body.checklist));
    return { ok: true };
  }

  private async resolveStaffId(req: StaffReq): Promise<number> {
    if (req.staffAuthVia === 'internal') return 0;
    if (!req.staffUser) return 0;
    const id = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return id ?? 0;
  }
}

function parseIntent(raw: unknown): ImgIntent {
  const value = String(raw ?? 'hero_lifestyle');
  if (!isImgIntent(value)) {
    throw Object.assign(new Error('invalid_intent'), { status: 400 });
  }
  return value;
}

function requiredString(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw Object.assign(new Error(error), { status: 400 });
  return text;
}

function nullableString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
