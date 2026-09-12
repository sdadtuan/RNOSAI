import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { throwDisabled } from './msos-errors.util';
import { MsosRepository } from './msos.repository';
import type { MsosHealthDto } from './msos.types';

@Injectable()
export class MsosService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MsosRepository,
  ) {}

  assertEnabled(): void {
    if (!this.config.mediaOsEnabled) {
      throwDisabled();
    }
  }

  getHealth(): MsosHealthDto {
    return {
      ok: true,
      reseller: this.config.mediaOsReseller,
      connector_write: this.config.mediaOsConnectorWrite,
    };
  }
}
