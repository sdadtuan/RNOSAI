import { forwardRef, Module } from '@nestjs/common';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { DealRoomController } from './deal-room.controller';
import { DealRoomService } from './deal-room.service';
import { DealRoomEnabledGuard } from './guards/deal-room-enabled.guard';

@Module({
  imports: [
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
    forwardRef(() => CrmLeadsLegacyModule),
  ],
  controllers: [DealRoomController],
  providers: [DealRoomService, DealRoomEnabledGuard],
  exports: [DealRoomService],
})
export class DealRoomModule {}
