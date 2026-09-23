import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import {
  StaffMarketingPlansViewGuard,
  StaffMarketingPlansWriteGuard,
} from '../marketing-plans/guards/staff-marketing-plans.guard';
import { StaffStrategyPackAdminGuard } from './staff-strategy-pack-admin.guard';
import { StrategyPacksService } from './strategy-packs.service';

@Controller()
@UseGuards(StaffOrInternalKeyGuard)
export class StrategyPacksController {
  constructor(private readonly packs: StrategyPacksService) {}

  @Get('api/crm/strategy-packs')
  @UseGuards(StaffMarketingPlansViewGuard)
  list() {
    return this.packs.listAdmin();
  }

  @Patch('api/crm/strategy-packs/:kind/:key')
  @UseGuards(StaffStrategyPackAdminGuard)
  update(
    @Param('kind') kind: string,
    @Param('key') key: string,
    @Body() body: { defaults_json?: Record<string, unknown>; is_active?: boolean; name_vi?: string },
  ) {
    const packKind = kind === 'service' ? 'service' : 'industry';
    return this.packs.updateAdmin(packKind, key, body ?? {});
  }

  @Get('api/crm/marketing-plans/:id/growth-sections')
  @UseGuards(StaffMarketingPlansViewGuard)
  read(@Param('id', ParseIntPipe) id: number) {
    return this.packs.sectionsRead(id);
  }

  @Put('api/crm/marketing-plans/:id/growth-sections')
  @UseGuards(StaffMarketingPlansWriteGuard)
  upsert(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { patch?: Record<string, unknown>; dry_run?: boolean },
  ) {
    return this.packs.sectionsUpsert({
      planId: id,
      patch: body?.patch ?? {},
      dryRun: Boolean(body?.dry_run),
      humanApproved: true,
      actor: 'staff',
    });
  }

  @Patch('api/crm/marketing-plans/:id/pack-keys')
  @UseGuards(StaffMarketingPlansWriteGuard)
  packKeys(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { industry_pack_key?: string | null; service_pack_key?: string | null },
  ) {
    return this.packs.setPlanPackKeys(id, body ?? {});
  }

  @Post('api/crm/marketing-plans/:id/generate-draft')
  @UseGuards(StaffMarketingPlansWriteGuard)
  generate(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      lifecycle_id?: number | null;
      insight_id?: number | null;
      industry_pack_key?: string | null;
      service_pack_key?: string | null;
      overwrite_mode?: string;
      dry_run?: boolean;
      persist?: boolean;
    },
  ) {
    return this.packs.generateDraft({
      planId: id,
      lifecycleId: body?.lifecycle_id ?? null,
      insightId: body?.insight_id ?? null,
      industryPackKey: body?.industry_pack_key ?? null,
      servicePackKey: body?.service_pack_key ?? null,
      overwriteMode: body?.overwrite_mode ?? 'fill_empty_only',
      dryRun: body?.dry_run !== false,
      persist: body?.persist === true,
      humanApproved: true,
      actor: 'staff',
    });
  }
}
