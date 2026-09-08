import { Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { RequireQuoteSection, StaffQuoteGuard } from './guards/staff-quote.guard';
import { QuoteShareService } from './quote-share.service';

@Controller('api/crm/proposals')
@UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)
export class QuoteShareController {
  constructor(private readonly shares: QuoteShareService) {}

  @Post(':id/share')
  @RequireQuoteSection('crm_quote.publish', 'execute')
  mint(@Param('id', ParseIntPipe) id: number) {
    return this.shares.mintShare(id);
  }

  @Post(':id/share/revoke')
  @RequireQuoteSection('crm_quote.publish', 'execute')
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.shares.revokeShare(id);
  }
}
