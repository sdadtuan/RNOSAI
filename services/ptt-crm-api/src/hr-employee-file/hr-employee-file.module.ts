import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrEmployeeFileViewGuard,
  StaffHrEmployeeFileWriteGuard,
} from './guards/staff-hr-employee-file.guard';
import { HrEmployeeFileController } from './hr-employee-file.controller';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrEmployeeFileService } from './hr-employee-file.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [HrEmployeeFileController],
  providers: [
    HrEmployeeFileRepository,
    HrEmployeeFileService,
    HrEmployeeFileEnabledGuard,
    StaffHrEmployeeFileViewGuard,
    StaffHrEmployeeFileWriteGuard,
  ],
  exports: [HrEmployeeFileRepository, HrEmployeeFileService],
})
export class HrEmployeeFileModule {}
