import { Module, forwardRef } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
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
import { QuoteCatalogService } from './quote-catalog.service';
import { QuoteConvertService } from './quote-convert.service';
import { QuotePublicController } from './quote-public.controller';
import { QuotePublicService } from './quote-public.service';
import { QuoteShareController } from './quote-share.controller';
import { QuoteApprovalStepsController } from './quote-approval-steps.controller';
import { QuoteApprovalService } from './quote-approval.service';
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
import { QuoteExpiryWorkerService } from './quote-expiry-worker.service';
import { QuoteOptionsService } from './quote-options.service';
import { QuoteStudioService } from './quote-studio.service';

@Module({
  imports: [
    StaffAuthModule,
    SpcModule,
    forwardRef(() => OpsModule),
    forwardRef(() => ServiceLifecycleModule),
    forwardRef(() => LeadsFunnelModule),
    InvoicesModule,
  ],
  controllers: [
    ProposalsController,
    QuoteVersionsController,
    QuoteApprovalStepsController,
    QuotePublicController,
    QuoteShareController,
  ],
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
    QuoteCatalogService,
    QuoteConvertService,
    QuotePublicService,
    QuoteExpiryWorkerService,
    QuoteOptionsService,
    QuoteApprovalService,
    QuoteStudioService,
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
    QuoteCatalogService,
    QuoteConvertService,
    QuotePublicService,
    QuoteOptionsService,
    QuoteApprovalService,
    QuoteStudioService,
  ],
})
export class ProposalsModule {}
