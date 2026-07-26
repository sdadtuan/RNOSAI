import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiTimelineController, CustomerTimelineController } from './customer-timeline.controller';
import { CustomerTimelineRepository } from './customer-timeline.repository';
import { CustomerTimelineService } from './customer-timeline.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [CustomerTimelineController, AiTimelineController],
  providers: [CustomerTimelineRepository, CustomerTimelineService],
  exports: [CustomerTimelineRepository, CustomerTimelineService],
})
export class CustomerTimelineModule {}
