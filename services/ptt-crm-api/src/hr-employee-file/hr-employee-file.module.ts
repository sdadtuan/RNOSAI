import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrContractEditGuard,
  StaffHrContractViewGuard,
} from './guards/staff-hr-contract.guard';
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
import { HrLaborContractController } from './hr-labor-contract.controller';
import { HrLaborContractRepository } from './hr-labor-contract.repository';
import { HrLaborContractService } from './hr-labor-contract.service';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrDocWalletService } from './hr-doc-wallet.service';
import { HrDocWalletStorageService } from './hr-doc-wallet.storage';
import { HrEmployeeFileController } from './hr-employee-file.controller';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrEmployeeFileService } from './hr-employee-file.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [HrEmployeeFileController, HrDocWalletController, HrLaborContractController],
  providers: [
    HrEmployeeFileRepository,
    HrDocWalletRepository,
    HrDocWalletStorageService,
    HrLaborContractRepository,
    HrEmployeeFileService,
    HrDocWalletService,
    HrLaborContractService,
    HrEmployeeFileEnabledGuard,
    StaffHrEmployeeFileViewGuard,
    StaffHrEmployeeFileWriteGuard,
    StaffHrContractViewGuard,
    StaffHrContractEditGuard,
    StaffHrDocsViewGuard,
    StaffHrDocsEditGuard,
    StaffHrDocsDownloadGuard,
  ],
  exports: [
    HrEmployeeFileRepository,
    HrEmployeeFileService,
    HrDocWalletRepository,
    HrDocWalletService,
    HrLaborContractRepository,
    HrLaborContractService,
  ],
})
export class HrEmployeeFileModule {}
