import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdAdminGuard } from './staff-vd-admin.guard';
import { VdAdminService } from './vd-admin.service';

const SECRET_KEYS = new Set(['api_key', 'secret']);

export function bodyHasSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(bodyHasSecretKey);
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key)) return true;
      if (bodyHasSecretKey(nested)) return true;
    }
  }
  return false;
}

function assertNoSecrets(body: Record<string, unknown>): void {
  if (bodyHasSecretKey(body)) {
    throw new BadRequestException({ error: 'secret_not_allowed', message: 'secret_not_allowed' });
  }
}

@Controller('api/v1/vd/admin')
@UseGuards(StaffOrInternalKeyGuard, StaffVdAdminGuard)
export class VdAdminController {
  constructor(private readonly admin: VdAdminService) {}

  @Get('providers')
  listProviders() {
    return this.admin.listProviders();
  }

  @Post('providers')
  @HttpCode(201)
  createProvider(@Body() body: Record<string, unknown>) {
    assertNoSecrets(body ?? {});
    return this.admin.createProvider(body ?? {});
  }

  @Get('models')
  listModels() {
    return this.admin.listModels();
  }

  @Post('models')
  @HttpCode(201)
  createModel(@Body() body: Record<string, unknown>) {
    assertNoSecrets(body ?? {});
    return this.admin.createModel(body ?? {});
  }
}
