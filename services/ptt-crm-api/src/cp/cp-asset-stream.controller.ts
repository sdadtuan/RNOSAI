import { Controller, Get, Headers, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { applyAssetStreamHeaders } from './cp-asset-stream-file.util';
import { CpAssetsService } from './cp-assets.service';

@Controller('api/crm/cp')
export class CpAssetStreamController {
  constructor(private readonly assets: CpAssetsService) {}

  @Get('assets/:id/file')
  async stream(
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const out = await this.assets.openStream(id, exp, sig, range);
    applyAssetStreamHeaders(res, out);
    return out.file;
  }
}
