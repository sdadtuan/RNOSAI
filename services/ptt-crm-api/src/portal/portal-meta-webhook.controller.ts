import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PortalMetaWebhookService } from './portal-meta-webhook.service';

/** Meta Page webhook for portal CRM inbox (no JWT). Local dev won't receive push — GET verify for App Dashboard. */
@Controller('api/portal/crm/meta')
export class PortalMetaWebhookController {
  constructor(private readonly webhooks: PortalMetaWebhookService) {}

  @Get('webhook')
  async verify(@Req() req: Request, @Res() res: Response): Promise<void> {
    const out = await this.webhooks.handleGet(req);
    res.status(out.status).type(out.contentType).send(out.body);
  }

  @Post('webhook')
  async ingest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const out = await this.webhooks.handlePost(req);
    res.status(out.status).json(out.body);
  }
}
