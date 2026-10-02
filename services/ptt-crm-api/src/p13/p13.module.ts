import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { P13CatalogController } from './catalog/catalog.controller';
import { P13CatalogService } from './catalog/catalog.service';
import { P13HolidaysController } from './holidays/holidays.controller';
import { P13CatalogManageGuard, P13CatalogViewGuard, P13HolidayGuard, P13PricingActivateGuard, P13PricingEditGuard, P13PricingViewGuard } from './p13-caps.guard';
import { P13EnabledGuard, P13FlagsService } from './p13-enabled.guard';
import { P13PricingController } from './pricing/pricing.controller';
import { P13PricingService } from './pricing/pricing.service';

@Module({
  imports: [StaffAuthModule, AdminAuditModule],
  controllers: [P13CatalogController, P13HolidaysController, P13PricingController],
  providers: [
    P13CatalogService,
    P13PricingService,
    P13FlagsService,
    P13EnabledGuard,
    P13CatalogViewGuard,
    P13CatalogManageGuard,
    P13HolidayGuard,
    P13PricingViewGuard,
    P13PricingEditGuard,
    P13PricingActivateGuard,
  ],
  exports: [P13FlagsService],
})
export class P13Module {}
