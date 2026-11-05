import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BrandService } from './brand.service';

function publicBase(req: Request): string {
  const envBase = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (envBase) return envBase;
  const host = req.get('host');
  if (host) {
    const proto = req.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }
  return 'http://127.0.0.1:3000';
}

@Controller('api/v1/public/brand')
export class BrandPublicController {
  constructor(private readonly brand: BrandService) {}

  @Get()
  getPublic(@Req() req: Request) {
    return this.brand.getPublic(publicBase(req));
  }

  @Get('files/:kind/:name')
  async streamFile(
    @Param('kind') kind: string,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    if (kind !== 'logo' && kind !== 'hero') {
      throw new NotFoundException({ error: 'not_found' });
    }
    try {
      const file = await this.brand.readFile(kind, decodeURIComponent(name));
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(file.buffer);
    } catch {
      throw new NotFoundException({ error: 'not_found' });
    }
  }
}
