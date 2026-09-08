import { Module, forwardRef } from '@nestjs/common';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { OpsModule } from '../ops/ops.module';
import { SpcModule } from '../spc/spc.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffProposalsViewGuard,
  StaffProposalsWriteGuard,
} from './guards/staff-proposals.guard';
import { StaffQuoteGuard } from './guards/staff-quote.guard';
import { ProposalsController } from './proposals.controller';
import { ProposalsPgRepository } from './proposals-pg.repository';
import { ProposalsService } from './proposals.service';
import { QuoteBuilderService } from './quote-builder.service';
import { QuoteVersionsController } from './quote-versions.controller';
import { QuoteVersionsRepository } from './quote-versions.repository';
import {
  QT_QUOTE_QUERY,
  QuoteAuditRepository,
} from './quote-audit.repository';
import { QuoteCreateService } from './quote-create.service';
import { QuoteListService } from './quote-list.service';
import { QuoteOverviewService } from './quote-overview.service';
import {
  QT_SETTINGS_QUERY,
  QuoteSettingsRepository,
} from './quote-settings.repository';
import { QuoteSettingsService } from './quote-settings.service';

@Module({
  imports: [
    StaffAuthModule,
    SpcModule,
    forwardRef(() => OpsModule),
    forwardRef(() => ServiceLifecycleModule),
    forwardRef(() => LeadsFunnelModule),
  ],
  controllers: [ProposalsController, QuoteVersionsController],
  providers: [
    ProposalsService,
    ProposalsPgRepository,
    StaffProposalsViewGuard,
    StaffProposalsWriteGuard,
    StaffQuoteGuard,
    QuoteSettingsRepository,
    { provide: QT_SETTINGS_QUERY, useExisting: QuoteSettingsRepository },
    { provide: QT_QUOTE_QUERY, useExisting: QuoteSettingsRepository },
    QuoteSettingsService,
    QuoteAuditRepository,
    QuoteOverviewService,
    QuoteCreateService,
    QuoteListService,
    QuoteVersionsRepository,
    QuoteBuilderService,
  ],
  exports: [
    ProposalsService,
    ProposalsPgRepository,
    QuoteSettingsService,
    QuoteAuditRepository,
    QuoteOverviewService,
    QuoteCreateService,
    QuoteListService,
    QuoteVersionsRepository,
    QuoteBuilderService,
  ],
})
export class ProposalsModule {}
