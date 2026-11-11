import { Body, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PortalMetaInsightsService } from '../agency/portal-meta-insights.service';
import { portalCrmCareEnabled } from '../agency/portal-client-pages.util';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalJwtGuard, PortalUser } from './portal-jwt.guard';

@Controller('api/portal/crm/ad-accounts')
@UseGuards(PortalJwtGuard)
export class PortalMetaInsightsController {
  constructor(private readonly metaInsights: PortalMetaInsightsService) {}

  @Post(':accountId/sync')
  async sync(
    @PortalUser() user: PortalJwtPayload,
    @Param('accountId') accountId: string,
    @Body() body?: { since?: string; until?: string },
  ) {
    this.assertEnabled();
    this.requireManager(user);
    return this.metaInsights.syncAccount(user.client_id, accountId, body);
  }

  @Get(':accountId/insights')
  async getInsights(
    @PortalUser() user: PortalJwtPayload,
    @Param('accountId') accountId: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('level') level?: string,
  ) {
    this.assertEnabled();
    return this.metaInsights.getInsights(user.client_id, accountId, { since, until, level });
  }

  @Get(':accountId/insights/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @PortalUser() user: PortalJwtPayload,
    @Param('accountId') accountId: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('level') level?: string,
  ): Promise<string> {
    this.assertEnabled();
    return this.metaInsights.buildCsv(user.client_id, accountId, { since, until, level });
  }

  private assertEnabled(): void {
    if (!portalCrmCareEnabled()) {
      throw new NotFoundException({ error: 'module_disabled' });
    }
  }

  private requireManager(user: PortalJwtPayload): void {
    if (user.role === 'staff') throw new ForbiddenException({ error: 'approver_only' });
  }
}
