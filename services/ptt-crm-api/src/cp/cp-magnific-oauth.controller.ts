import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  CpProviderConnectionsService,
  magnificSettingsRedirect,
} from './cp-provider-connections.service';

/** Public Magnific OAuth callback — no staff JWT (provider redirect). */
@Controller('api/crm/cp')
export class CpMagnificOAuthCallbackController {
  constructor(private readonly connections: CpProviderConnectionsService) {}

  @Get('provider-connections/magnific/oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const result = await this.connections.completeMagnificOAuth({ code, state });
      return res.redirect(result.redirect_url);
    } catch (err) {
      const reason = err && typeof err === 'object' && 'error' in err
        ? String((err as { error?: unknown }).error ?? 'oauth_failed')
        : 'oauth_failed';
      return res.redirect(magnificSettingsRedirect('err', reason));
    }
  }
}
