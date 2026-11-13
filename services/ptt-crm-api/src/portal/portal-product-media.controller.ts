import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';

const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

/**
 * Serve product images for <img src>. Auth is omitted on purpose: the browser
 * cannot attach the portal JWT to a plain image request, and filenames are
 * unguessable UUIDs. Only the UUID+ext pattern is accepted.
 */
@Controller('api/portal/crm/media')
export class PortalProductMediaController {
  @Get(':file')
  send(@Param('file') file: string, @Res() res: Response): void {
    if (!FILE.test(file)) throw new NotFoundException();
    const path = join(process.cwd(), 'data', 'portal-product-images', file);
    if (!existsSync(path)) throw new NotFoundException();
    const lower = file.toLowerCase();
    const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(path).pipe(res);
  }
}
