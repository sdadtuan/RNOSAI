import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CpWeaveService } from './cp-weave.service';

@Controller('api/crm/cp')
export class CpWeaveIngestController {
  constructor(private readonly weave: CpWeaveService) {}

  @Post('weave-ingest/hook')
  ingestHook(
    @Headers('x-ptt-weave-sign') signature: string | undefined,
    @Body() body: { key?: string } | string,
  ) {
    const raw = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    return this.weave.ingestHook(raw, signature);
  }
}
