import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdProjectViewGuard } from '../guards/staff-vd-project.guard';
import { VdAssetSearchService } from './vd-asset-search.service';

@Controller('api/v1/vd/assets')
@UseGuards(StaffOrInternalKeyGuard, StaffVdProjectViewGuard)
export class VdAssetController {
  constructor(private readonly searchService: VdAssetSearchService) {}

  @Get('search')
  search(
    @Query('lifecycle_id') lifecycleRaw?: string,
    @Query('project_id') projectRaw?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const lifecycleId = Number(lifecycleRaw);
    if (!Number.isInteger(lifecycleId) || lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    const projectId =
      projectRaw != null && String(projectRaw).trim() !== ''
        ? Number(projectRaw)
        : undefined;
    const limit =
      limitRaw != null && String(limitRaw).trim() !== '' ? Number(limitRaw) : undefined;
    return this.searchService.search({ lifecycleId, projectId, kind, q, limit });
  }
}
