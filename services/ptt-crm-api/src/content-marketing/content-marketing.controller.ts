import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffContentMarketingViewGuard } from './guards/staff-content-marketing.guard';
import { ContentMarketingService } from './content-marketing.service';

@Controller('api/crm/service-lifecycle/:lifecycleId/content-marketing')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentMarketingController {
  constructor(private readonly contentMarketing: ContentMarketingService) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.contentMarketing.getContext(lifecycleId);
  }
}
