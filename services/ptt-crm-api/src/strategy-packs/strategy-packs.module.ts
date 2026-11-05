import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffMarketingPlansViewGuard,
  StaffMarketingPlansWriteGuard,
} from '../marketing-plans/guards/staff-marketing-plans.guard';
import { StaffStrategyPackAdminGuard } from './staff-strategy-pack-admin.guard';
import { StrategyPacksController } from './strategy-packs.controller';
import { StrategyPacksRepository } from './strategy-packs.repository';
import { StrategyPacksService } from './strategy-packs.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [StrategyPacksController],
  providers: [
    StrategyPacksRepository,
    StrategyPacksService,
    StaffStrategyPackAdminGuard,
    StaffMarketingPlansViewGuard,
    StaffMarketingPlansWriteGuard,
  ],
  exports: [StrategyPacksService],
})
export class StrategyPacksModule {}
