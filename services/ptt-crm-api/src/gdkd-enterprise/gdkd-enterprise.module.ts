import { Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { CskhBoardModule } from '../cskh-board/cskh-board.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { GdkdEnterpriseController } from './gdkd-enterprise.controller';
import { GdkdEnterpriseKpiService } from './gdkd-enterprise-kpi.service';

@Module({
  imports: [StaffAuthModule, CskhBoardModule, LeadsFunnelModule, AiIntelligenceModule],
  controllers: [GdkdEnterpriseController],
  providers: [GdkdEnterpriseKpiService],
  exports: [GdkdEnterpriseKpiService],
})
export class GdkdEnterpriseModule {}
