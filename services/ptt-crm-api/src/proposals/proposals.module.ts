import { Module, forwardRef } from '@nestjs/common';
import { OpsModule } from '../ops/ops.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffProposalsViewGuard,
  StaffProposalsWriteGuard,
} from './guards/staff-proposals.guard';
import { ProposalsController } from './proposals.controller';
import { ProposalsSqliteRepository } from './proposals-sqlite.repository';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [StaffAuthModule, forwardRef(() => OpsModule), forwardRef(() => ServiceLifecycleModule)],
  controllers: [ProposalsController],
  providers: [
    ProposalsService,
    ProposalsSqliteRepository,
    StaffProposalsViewGuard,
    StaffProposalsWriteGuard,
  ],
})
export class ProposalsModule {}
