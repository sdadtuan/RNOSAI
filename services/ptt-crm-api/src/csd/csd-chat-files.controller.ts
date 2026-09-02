import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdChatFilesService } from './csd-chat-files.service';
import type { CsdActor } from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
};

@Controller('api/crm/csd')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdChatFilesController {
  constructor(
    private readonly files: CsdChatFilesService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actor(req: AuthedReq): Promise<CsdActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      caps: me.caps,
    };
  }

  @Post('conversations/:id/files')
  @RequireCsdAction('write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 104857600 },
    }),
  )
  async upload(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const actor = await this.actor(req);
    return this.files.upload(actor, id, file);
  }

  @Get('files/:id')
  @RequireCsdAction('view')
  async download(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const actor = await this.actor(req);
    const out = await this.files.openForDownload(actor, id);
    const safeName = out.file_name.replace(/["\r\n]+/g, '_');
    res.setHeader('Content-Type', out.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return new StreamableFile(out.stream);
  }
}
