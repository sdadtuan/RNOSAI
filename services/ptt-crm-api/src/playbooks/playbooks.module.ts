import { Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { PlaybooksController } from './playbooks.controller';
import { PlaybooksRepository } from './playbooks.repository';
import { PlaybooksService } from './playbooks.service';

@Module({
  imports: [ConfigModule, StaffAuthModule, AiIntelligenceModule],
  controllers: [PlaybooksController],
  providers: [PlaybooksRepository, PlaybooksService],
  exports: [PlaybooksService, PlaybooksRepository],
})
export class PlaybooksModule {}
