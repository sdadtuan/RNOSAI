import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { QuotePublicService } from './quote-public.service';

@Controller('api/public/proposals')
export class QuotePublicController {
  constructor(private readonly quotes: QuotePublicService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  get(@Param('token') token: string) {
    return this.quotes.getByToken(token);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.quotes.accept(token, body ?? {});
  }
}
