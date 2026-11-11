import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { PortalJwtGuard } from './portal-jwt.guard';

const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

@Controller('api/portal/crm/media')
@UseGuards(PortalJwtGuard)
export class PortalProductMediaController {
  @Get(':file')
  send(@Param('file') file: string, @Res() res: Response): void {
    if (!FILE.test(file)) throw new NotFoundException();
    const path = join(process.cwd(), 'data', 'portal-product-images', file);
    if (!existsSync(path)) throw new NotFoundException();
    const type = file.toLowerCase().endsWith('.png') ? 'image/png' : file.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(path).pipe(res);
  }
}
