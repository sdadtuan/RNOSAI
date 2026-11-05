import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from '../crm-config/guards/staff-crm-config.guard';
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

function mapBrandError(err: unknown): never {
  const code = err instanceof Error ? err.message : 'unknown';
  if (code === 'hero_in_use') {
    throw new ConflictException({ error: code });
  }
  if (code === 'hero_not_found') {
    throw new NotFoundException({ error: code });
  }
  if (code === 'invalid_image' || code === 'file_too_large' || code === 'file_required') {
    throw new BadRequestException({ error: code });
  }
  throw err;
}

@Controller('api/v1/admin/brand')
@UseGuards(StaffOrInternalKeyGuard)
export class BrandAdminController {
  constructor(private readonly brand: BrandService) {}

  @Get()
  @UseGuards(StaffCrmConfigViewGuard)
  getAdmin(@Req() req: Request) {
    return this.brand.getAdmin(publicBase(req));
  }

  @Post('logo')
  @UseGuards(StaffCrmConfigConfigureGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2_000_000 },
    }),
  )
  async uploadLogo(@Req() req: Request, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException({ error: 'file_required' });
    }
    try {
      return await this.brand.replaceLogo(
        {
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.size,
          originalname: file.originalname,
        },
        publicBase(req),
      );
    } catch (err) {
      mapBrandError(err);
    }
  }

  @Post('heroes')
  @UseGuards(StaffCrmConfigConfigureGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8_000_000 },
    }),
  )
  async uploadHero(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException({ error: 'file_required' });
    }
    try {
      return await this.brand.addHero({
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      });
    } catch (err) {
      mapBrandError(err);
    }
  }

  @Patch('heroes/:id')
  @UseGuards(StaffCrmConfigConfigureGuard)
  async activateHero(@Req() req: Request, @Param('id') id: string, @Body() body: { active?: boolean }) {
    if (!body.active) {
      throw new BadRequestException({ error: 'active_required' });
    }
    try {
      return await this.brand.activateHero(id, publicBase(req));
    } catch (err) {
      mapBrandError(err);
    }
  }

  @Delete('heroes/:id')
  @UseGuards(StaffCrmConfigConfigureGuard)
  @HttpCode(204)
  async deleteHero(@Param('id') id: string) {
    try {
      await this.brand.deleteHero(id);
    } catch (err) {
      mapBrandError(err);
    }
  }
}
