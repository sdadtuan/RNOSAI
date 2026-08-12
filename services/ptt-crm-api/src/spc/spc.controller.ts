import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffSpcViewGuard } from './guards/staff-spc.guard';
import { SpcService } from './spc.service';

@Controller('api/spc')
@UseGuards(StaffOrInternalKeyGuard, StaffSpcViewGuard)
export class SpcController {
  constructor(private readonly spc: SpcService) {}

  @Get('portfolio')
  getPortfolio() {
    return this.spc.getPortfolio(true);
  }

  @Get('quote-catalog')
  getQuoteCatalog(@Query('service_slug') serviceSlug?: string) {
    return this.spc.getQuoteCatalog(serviceSlug);
  }

  @Get('families/:dvCode')
  getFamily(@Param('dvCode') dvCode: string) {
    return this.spc.getFamily(dvCode, true);
  }

  @Get('offers/:skuCode')
  getOffer(@Param('skuCode') skuCode: string) {
    return this.spc.getOffer(skuCode, true);
  }
}
