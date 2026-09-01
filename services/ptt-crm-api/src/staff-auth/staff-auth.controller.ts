import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { StaffAuthService } from './staff-auth.service';
import { StaffAccountService } from './staff-account.service';
import {
  StaffLoginResult,
  StaffMeResponse,
  StaffOidcExchangeBody,
  StaffRosterResponse,
  StaffSsoConfigResponse,
} from './staff-auth.types';
import type { StaffAccountBundleResponse } from './staff-account.types';
import { StaffJwtGuard, StaffUser } from './staff-jwt.guard';
import { StaffJwtPayload } from './staff-jwt.util';
import { staffClientIp, staffUserAgent } from './staff-request-meta.util';

class StaffLoginBody {
  email!: string;
  password!: string;
}

class StaffRefreshBody {
  refresh_token!: string;
}

class StaffChangePasswordBody {
  current_password?: string;
  new_password?: string;
}

@Controller('api/v1/staff/auth')
export class StaffAuthController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly account: StaffAccountService,
  ) {}

  @Get('sso/config')
  ssoConfig(): StaffSsoConfigResponse {
    return this.auth.getSsoConfig();
  }

  @Post('oidc/exchange')
  @HttpCode(HttpStatus.OK)
  exchangeOidc(
    @Req() req: Request,
    @Body() body: StaffOidcExchangeBody,
  ): Promise<StaffLoginResult> {
    return this.auth.exchangeOidc(
      {
        code: body.code ?? '',
        redirectUri: body.redirect_uri ?? '',
        codeVerifier: body.code_verifier ?? '',
      },
      {
        ip: staffClientIp(req),
        userAgent: staffUserAgent(req),
        loginMethod: 'sso',
      },
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() body: StaffLoginBody): Promise<StaffLoginResult> {
    return this.auth.login(body.email ?? '', body.password ?? '', {
      ip: staffClientIp(req),
      userAgent: staffUserAgent(req),
      loginMethod: 'nest_password',
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request, @Body() body: StaffRefreshBody): Promise<StaffLoginResult> {
    return this.auth.refresh(body.refresh_token ?? '', {
      ip: staffClientIp(req),
      userAgent: staffUserAgent(req),
      loginMethod: this.auth.getSsoConfig().mode !== 'nest' ? 'sso' : 'nest_password',
    });
  }

  @Get('me')
  @UseGuards(StaffJwtGuard)
  async me(@StaffUser() user: StaffJwtPayload): Promise<StaffMeResponse> {
    return this.account.buildProfile(user);
  }

  @Get('account')
  @UseGuards(StaffJwtGuard)
  async accountBundle(@StaffUser() user: StaffJwtPayload): Promise<StaffAccountBundleResponse> {
    return this.account.getBundle(user);
  }

  @Post('account/password')
  @UseGuards(StaffJwtGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@StaffUser() user: StaffJwtPayload, @Body() body: StaffChangePasswordBody) {
    return this.account.changePassword(
      user,
      body.current_password ?? '',
      body.new_password ?? '',
    );
  }

  @Get('account/sessions')
  @UseGuards(StaffJwtGuard)
  listSessions(@StaffUser() user: StaffJwtPayload) {
    return this.account.listSessions(user);
  }

  @Post('account/sessions/revoke-others')
  @UseGuards(StaffJwtGuard)
  @HttpCode(HttpStatus.OK)
  revokeOthers(@StaffUser() user: StaffJwtPayload) {
    return this.account.revokeOthers(user);
  }

  @Post('account/sessions/revoke-all')
  @UseGuards(StaffJwtGuard)
  @HttpCode(HttpStatus.OK)
  revokeAll(@StaffUser() user: StaffJwtPayload) {
    return this.account.revokeAll(user);
  }

  @Post('account/sessions/:id/revoke')
  @UseGuards(StaffJwtGuard)
  @HttpCode(HttpStatus.OK)
  revokeOne(@StaffUser() user: StaffJwtPayload, @Param('id') id: string) {
    return this.account.revokeOne(user, id);
  }

  @Get('account/audit')
  @UseGuards(StaffJwtGuard)
  listAudit(@StaffUser() user: StaffJwtPayload, @Query('limit') limit?: string) {
    return this.account.listAudit(user, Number(limit) || 20);
  }

  @Post('account/avatar')
  @UseGuards(StaffJwtGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1_000_000 },
    }),
  )
  uploadAvatar(@StaffUser() user: StaffJwtPayload, @UploadedFile() file?: Express.Multer.File) {
    return this.account.uploadAvatar(user, file);
  }

  @Delete('account/avatar')
  @UseGuards(StaffJwtGuard)
  deleteAvatar(@StaffUser() user: StaffJwtPayload) {
    return this.account.deleteAvatar(user);
  }

  @Get('account/avatar')
  @UseGuards(StaffJwtGuard)
  async getAvatar(@StaffUser() user: StaffJwtPayload, @Res() res: Response) {
    const out = await this.account.readAvatar(user);
    if (!out) {
      throw new NotFoundException({ error: 'avatar_not_found' });
    }
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(out.buffer);
  }

  @Get('roster')
  @UseGuards(StaffJwtGuard)
  async roster(): Promise<StaffRosterResponse> {
    return this.auth.listActiveStaff();
  }
}
