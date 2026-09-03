import { Controller, Get, Param } from '@nestjs/common';
import { IwrExternalService } from './iwr-external.service';

@Controller('api/crm/iwr/public')
export class IwrPublicController {
  constructor(private readonly external: IwrExternalService) {}

  @Get('shares/:token')
  async viewShare(@Param('token') token: string) {
    return this.external.viewPublicShare(token);
  }
}
