import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from '../../crm-config/guards/staff-crm-config.guard';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { ResearchAiProvidersService } from './ai-providers.service';
import type {
  CreateResearchAiCredentialBody,
  CreateResearchAiModelBody,
  CreateResearchAiProviderBody,
  PatchResearchAiCredentialBody,
  PatchResearchAiModelBody,
  PatchResearchAiProviderBody,
} from './ai-providers.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload };

function staffId(req: StaffReq): number | null {
  const raw = req.staffUser?.sub;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

@Controller('api/v1/research/admin/ai-providers')
export class ResearchAiProvidersController {
  constructor(private readonly ai: ResearchAiProvidersService) {}

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  list() {
    return this.ai.listProviders().then((providers) => ({ providers }));
  }

  @Post()
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  create(@Body() body: CreateResearchAiProviderBody) {
    return this.ai.createProvider(body);
  }

  @Patch(':id')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patch(@Param('id', ParseIntPipe) id: number, @Body() body: PatchResearchAiProviderBody) {
    return this.ai.patchProvider(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ai.deleteProvider(id);
  }

  @Get(':id/models')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listModels(@Param('id', ParseIntPipe) id: number) {
    return this.ai.listModels(id).then((models) => ({ models }));
  }

  @Post(':id/models')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createModel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateResearchAiModelBody,
  ) {
    return this.ai.createModel(id, body);
  }

  @Get(':id/credentials')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listCredentials(@Param('id', ParseIntPipe) id: number) {
    return this.ai.listCredentials(id).then((credentials) => ({ credentials }));
  }

  @Post(':id/credentials')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createCredential(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateResearchAiCredentialBody,
  ) {
    return this.ai.createCredential(id, body, staffId(req));
  }

  @Post(':id/test')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  test(@Param('id', ParseIntPipe) id: number, @Body() body: { model_id?: string }) {
    return this.ai.testProvider(id, body?.model_id);
  }
}

@Controller('api/v1/research/admin')
export class ResearchAiModelsCredentialsController {
  constructor(private readonly ai: ResearchAiProvidersService) {}

  @Patch('ai-models/:modelId')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patchModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Body() body: PatchResearchAiModelBody,
  ) {
    return this.ai.patchModel(modelId, body);
  }

  @Delete('ai-models/:modelId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteModel(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.ai.deleteModel(modelId);
  }

  @Patch('ai-credentials/:credId')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patchCredential(
    @Req() req: StaffReq,
    @Param('credId', ParseIntPipe) credId: number,
    @Body() body: PatchResearchAiCredentialBody,
  ) {
    return this.ai.patchCredential(credId, body, staffId(req));
  }

  @Delete('ai-credentials/:credId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteCredential(@Req() req: StaffReq, @Param('credId', ParseIntPipe) credId: number) {
    return this.ai.deleteCredential(credId, staffId(req));
  }
}
