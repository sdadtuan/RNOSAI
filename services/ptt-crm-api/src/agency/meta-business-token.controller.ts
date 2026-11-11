import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAgencyViewGuard } from './guards/staff-agency-view.guard';
import { StaffAgencyWriteGuard } from './guards/staff-agency-write.guard';
import { MetaBusinessTokenService } from './meta-business-token.service';

@Controller('api/v1/agency/meta-business-token')
@UseGuards(StaffOrInternalKeyGuard, StaffAgencyViewGuard)
export class MetaBusinessTokenController {
  constructor(private readonly tokens: MetaBusinessTokenService) {}

  @Get()
  status() {
    return this.tokens.status();
  }

  @Get('pages')
  pages() {
    return this.tokens.catalog();
  }

  @Put()
  @UseGuards(StaffAgencyWriteGuard)
  save(@Body() body: { access_token?: string }) {
    return this.tokens.save(String(body?.access_token ?? ''));
  }
}
