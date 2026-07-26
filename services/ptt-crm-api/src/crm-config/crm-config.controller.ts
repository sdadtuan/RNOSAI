import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CrmConfigService } from './crm-config.service';
import type {
  CreateCustomFieldBody,
  UpdateCustomFieldBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from './guards/staff-crm-config.guard';

@Controller('api/crm/config')
export class CrmConfigController {
  constructor(private readonly crmConfig: CrmConfigService) {}

  @Get('custom-fields')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listCustomFields(@Query('entity_type') entityType?: string) {
    return this.crmConfig.listCustomFields(entityType);
  }

  @Post('custom-fields')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createCustomField(@Body() body: CreateCustomFieldBody) {
    return this.crmConfig.createCustomField(body);
  }

  @Patch('custom-fields/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  updateCustomField(@Param('id') id: string, @Body() body: UpdateCustomFieldBody) {
    return this.crmConfig.updateCustomField(Number(id), body);
  }

  @Delete('custom-fields/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteCustomField(@Param('id') id: string) {
    return this.crmConfig.deleteCustomField(Number(id));
  }

  @Get('pipeline/sales/stages')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listSalesPipelineStages() {
    return this.crmConfig.listSalesPipelineStages();
  }

  @Put('pipeline/sales/stages')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  replaceSalesPipelineStages(@Body() body: UpdatePipelineStagesBody) {
    return this.crmConfig.replaceSalesPipelineStages(body);
  }
}
