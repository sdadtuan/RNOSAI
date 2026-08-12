import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffSpcEditGuard,
  StaffSpcPublishGuard,
  StaffSpcViewGuard,
} from './guards/staff-spc.guard';
import { SpcAdminController } from './spc-admin.controller';
import { SpcController } from './spc.controller';
import { SpcPgRepository } from './spc-pg.repository';
import { SpcService } from './spc.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [SpcController, SpcAdminController],
  providers: [
    SpcService,
    SpcPgRepository,
    StaffSpcViewGuard,
    StaffSpcEditGuard,
    StaffSpcPublishGuard,
  ],
  exports: [SpcService, SpcPgRepository],
})
export class SpcModule {}
