import { Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffProposalsWriteGuard } from './guards/staff-proposals.guard';
import { QuotePublicService } from './quote-public.service';

@Controller('api/crm/proposals')
@UseGuards(StaffOrInternalKeyGuard, StaffProposalsWriteGuard)
export class QuoteShareController {
  constructor(private readonly quotes: QuotePublicService) {}

  @Post(':id/share')
  mint(@Param('id', ParseIntPipe) id: number) {
    return this.quotes.mintShare(id);
  }
}
