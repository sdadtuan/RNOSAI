import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { QuotePublicService } from './quote-public.service';
import { QuoteShareService } from './quote-share.service';

function clientMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return {
    ip: String(forwardedIp || req.ip || '').trim() || null,
    userAgent: String(req.headers['user-agent'] ?? '').trim() || null,
  };
}

@Controller('api/public/proposals')
export class QuotePublicController {
  constructor(
    private readonly quotes: QuotePublicService,
    private readonly shares: QuoteShareService,
  ) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  get(@Param('token') token: string, @Query('section') section?: string) {
    return this.quotes.getByToken(token, { section });
  }

  @Post(':token/otp')
  requestOtp(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.shares.requestOtp(token, body ?? {});
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.shares.accept(token, body ?? {}, clientMeta(req));
  }
}
