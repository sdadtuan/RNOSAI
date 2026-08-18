import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { B2bLeadScopeService } from './b2b-lead-scope.service';
import { B2bProjectsController } from './b2b-projects.controller';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { B2bProjectsService } from './b2b-projects.service';
import {
  StaffB2bProjectsManageGuard,
  StaffB2bProjectsViewGuard,
} from './guards/staff-b2b-projects.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [B2bProjectsController],
  providers: [
    B2bProjectsService,
    B2bProjectsRepository,
    B2bLeadScopeService,
    StaffB2bProjectsViewGuard,
    StaffB2bProjectsManageGuard,
  ],
  exports: [B2bProjectsService, B2bProjectsRepository, B2bLeadScopeService],
})
export class B2bProjectsModule {}
