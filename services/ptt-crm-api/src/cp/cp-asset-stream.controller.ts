import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { CpAssetsService } from './cp-assets.service';

@Controller('api/crm/cp')
export class CpAssetStreamController {
  constructor(private readonly assets: CpAssetsService) {}

  @Get('assets/:id/file')
  async stream(
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const out = await this.assets.openStream(id, exp, sig);
    const safeName = out.filename.replace(/["\r\n]+/g, '_');
    res.setHeader('Content-Type', out.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return out.file;
  }
}
