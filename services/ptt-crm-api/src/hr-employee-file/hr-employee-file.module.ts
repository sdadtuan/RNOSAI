import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrInsuranceEditGuard,
  StaffHrInsuranceViewGuard,
} from './guards/staff-hr-insurance.guard';
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
import { HrInsuranceController } from './hr-insurance.controller';
import { HrInsuranceRepository } from './hr-insurance.repository';
import { HrInsuranceService } from './hr-insurance.service';
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
  controllers: [HrEmployeeFileController, HrDocWalletController, HrLaborContractController, HrInsuranceController],
  providers: [
    HrEmployeeFileRepository,
    HrDocWalletRepository,
    HrDocWalletStorageService,
    HrLaborContractRepository,
    HrInsuranceRepository,
    HrEmployeeFileService,
    HrDocWalletService,
    HrLaborContractService,
    HrInsuranceService,
    HrEmployeeFileEnabledGuard,
    StaffHrEmployeeFileViewGuard,
    StaffHrEmployeeFileWriteGuard,
    StaffHrContractViewGuard,
    StaffHrContractEditGuard,
    StaffHrInsuranceViewGuard,
    StaffHrInsuranceEditGuard,
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
    HrInsuranceRepository,
    HrInsuranceService,
  ],
})
export class HrEmployeeFileModule {}
