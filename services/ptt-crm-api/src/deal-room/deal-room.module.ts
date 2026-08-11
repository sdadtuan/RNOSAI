import { forwardRef, Module } from '@nestjs/common';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { OpsModule } from '../ops/ops.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { DealRoomController } from './deal-room.controller';
import { DealRoomService } from './deal-room.service';
import { DealRoomEnabledGuard } from './guards/deal-room-enabled.guard';

@Module({
  imports: [
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => ProposalsModule),
    OpsModule,
  ],
  controllers: [DealRoomController],
  providers: [DealRoomService, DealRoomEnabledGuard],
  exports: [DealRoomService],
})
export class DealRoomModule {}
