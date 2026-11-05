import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from '../crm-config/guards/staff-crm-config.guard';
import { BrandAdminController } from './brand-admin.controller';
import { BrandPublicController } from './brand-public.controller';
import { BrandService } from './brand.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [BrandPublicController, BrandAdminController],
  providers: [BrandService, StaffCrmConfigViewGuard, StaffCrmConfigConfigureGuard],
  exports: [BrandService],
})
export class BrandModule {}
