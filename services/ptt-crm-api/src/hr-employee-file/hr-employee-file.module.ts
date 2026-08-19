import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrDocsDownloadGuard,
  StaffHrDocsEditGuard,
  StaffHrDocsViewGuard,
} from './guards/staff-hr-docs.guard';
import {
  StaffHrEmployeeFileViewGuard,
  StaffHrEmployeeFileWriteGuard,
} from './guards/staff-hr-employee-file.guard';
import { HrDocWalletController } from './hr-doc-wallet.controller';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrDocWalletService } from './hr-doc-wallet.service';
import { HrDocWalletStorageService } from './hr-doc-wallet.storage';
import { HrEmployeeFileController } from './hr-employee-file.controller';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrEmployeeFileService } from './hr-employee-file.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [HrEmployeeFileController, HrDocWalletController],
  providers: [
    HrEmployeeFileRepository,
    HrDocWalletRepository,
    HrDocWalletStorageService,
    HrEmployeeFileService,
    HrDocWalletService,
    HrEmployeeFileEnabledGuard,
    StaffHrEmployeeFileViewGuard,
    StaffHrEmployeeFileWriteGuard,
    StaffHrDocsViewGuard,
    StaffHrDocsEditGuard,
    StaffHrDocsDownloadGuard,
  ],
  exports: [HrEmployeeFileRepository, HrEmployeeFileService, HrDocWalletRepository, HrDocWalletService],
})
export class HrEmployeeFileModule {}
