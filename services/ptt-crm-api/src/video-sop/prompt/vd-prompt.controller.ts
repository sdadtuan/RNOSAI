import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdKeyframeEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdPromptService } from './vd-prompt.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_shot_not_found' || msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (msg === 'idempotency_key_conflict') {
    throw new ConflictException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/vd')
@UseGuards(StaffOrInternalKeyGuard)
export class VdPromptController {
  constructor(private readonly prompts: VdPromptService) {}

  @Get('projects/:id/shots')
  @UseGuards(StaffVdProjectViewGuard)
  async listShots(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.prompts.listShotsByProject(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('projects/:id/keyframes')
  @UseGuards(StaffVdProjectViewGuard)
  async listKeyframes(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.prompts.listKeyframes(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/jobs')
  @HttpCode(201)
  @UseGuards(StaffVdKeyframeEditGuard)
  async enqueueKeyframe(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    try {
      return await this.prompts.enqueueKeyframe(id, body ?? {}, idempotencyKey);
    } catch (err) {
      mapKnownError(err);
    }
  }
}
