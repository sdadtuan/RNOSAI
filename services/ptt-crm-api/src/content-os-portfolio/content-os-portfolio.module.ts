import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingExecuteGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from '../content-marketing/guards/staff-content-marketing.guard';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ContentOsPortfolioController, ContentOsPortfolioFacebookOAuthCallbackController } from './content-os-portfolio.controller';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

@Module({
  imports: [StaffAuthModule, ContentMarketingModule],
  controllers: [ContentOsPortfolioController, ContentOsPortfolioFacebookOAuthCallbackController],
  providers: [
    ContentOsPortfolioService,
    ContentOsPortfolioRepository,
    StaffContentMarketingViewGuard,
    StaffContentMarketingWriteGuard,
    StaffContentMarketingApproveGuard,
    StaffContentMarketingExecuteGuard,
    StaffContentMarketingGenerateGuard,
  ],
})
export class ContentOsPortfolioModule {}
