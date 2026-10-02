import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { P13PricingActivateGuard, P13PricingEditGuard, P13PricingViewGuard } from '../p13-caps.guard';
import { P13EnabledGuard } from '../p13-enabled.guard';
import { P13PricingService, type PricingPatch, type PricingPreviewBody } from './pricing.service';

type StaffRequest = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/p13/pricing')
@UseGuards(P13EnabledGuard, StaffOrInternalKeyGuard)
export class P13PricingController {
  constructor(
    private readonly pricing: P13PricingService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('versions')
  @UseGuards(P13PricingViewGuard)
  async versions() {
    return { versions: await this.pricing.list() };
  }

  @Post('versions')
  @UseGuards(P13PricingEditGuard)
  create(@Req() req: StaffRequest) {
    return this.pricing.createDraft(actorOf(req));
  }

  @Get('versions/:id')
  @UseGuards(P13PricingViewGuard)
  async version(@Param('id') id: string, @Req() req: StaffRequest) {
    const access = await this.access(req);
    return this.pricing.get(id, access.cost);
  }

  @Patch('versions/:id')
  @UseGuards(P13PricingEditGuard)
  async patch(@Param('id') id: string, @Body() body: PricingPatch, @Req() req: StaffRequest) {
    const access = await this.access(req);
    return this.pricing.patch(id, body, access.actor, access.cost);
  }

  @Post('versions/:id/clone')
  @UseGuards(P13PricingEditGuard)
  clone(@Param('id') id: string, @Req() req: StaffRequest) {
    return this.pricing.clone(id, actorOf(req));
  }

  @Post('versions/:id/activate')
  @UseGuards(P13PricingActivateGuard)
  async activate(
    @Param('id') id: string,
    @Body() body: { effective_from?: string; inversion_ack?: boolean; inversion_ack_note?: string },
    @Req() req: StaffRequest,
  ) {
    const access = await this.access(req);
    return this.pricing.activate(id, body, access.actor, access.cost);
  }

  @Get('matrix')
  @UseGuards(P13PricingViewGuard)
  matrix(@Query('version_id') versionId?: string) {
    return this.pricing.matrix(versionId);
  }

  @Post('preview')
  @UseGuards(P13PricingViewGuard)
  async preview(@Body() body: PricingPreviewBody, @Req() req: StaffRequest) {
    const access = await this.access(req);
    if (body.params_override && !access.edit) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'p13_pricing', action: 'edit_draft' });
    }
    return this.pricing.preview(body, access.cost);
  }

  private async access(req: StaffRequest): Promise<{ cost: boolean; edit: boolean; actor: string }> {
    if (req.staffAuthVia === 'internal') return { cost: true, edit: true, actor: 'internal' };
    if (!req.staffUser) return { cost: false, edit: false, actor: 'staff' };
    const me = await this.staffAuth.me(req.staffUser);
    return {
      cost: this.staffAuth.hasCap(me.caps, 'p13_pricing', 'cost.view'),
      edit: this.staffAuth.hasCap(me.caps, 'p13_pricing', 'edit_draft'),
      actor: req.staffUser.email || req.staffUser.sub || 'staff',
    };
  }
}

function actorOf(req: StaffRequest): string {
  return req.staffUser?.email || req.staffUser?.sub || 'internal';
}
