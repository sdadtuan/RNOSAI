import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import {
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from '../content-marketing/guards/staff-content-marketing.guard';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ContentOsPortfolioController } from './content-os-portfolio.controller';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

@Module({
  imports: [StaffAuthModule, ContentMarketingModule],
  controllers: [ContentOsPortfolioController],
  providers: [
    ContentOsPortfolioService,
    ContentOsPortfolioRepository,
    StaffContentMarketingViewGuard,
    StaffContentMarketingWriteGuard,
  ],
})
export class ContentOsPortfolioModule {}
