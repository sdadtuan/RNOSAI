import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentMarketingService } from './content-marketing.service';
import {
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/service-lifecycle/:lifecycleId/content-marketing')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentMarketingController {
  constructor(
    private readonly contentMarketing: ContentMarketingService,
    private readonly ideas: ContentIdeaService,
    private readonly items: ContentItemService,
  ) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.contentMarketing.getContext(lifecycleId);
  }

  @Get('ideas')
  listIdeas(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('pillar_id') pillarId?: string,
  ) {
    return this.ideas.listIdeas(lifecycleId, {
      status: status || undefined,
      pillar_id: pillarId != null && pillarId !== '' ? Number(pillarId) : undefined,
    });
  }

  @Post('ideas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.createIdea(lifecycleId, body, actorEmail(req));
  }

  @Patch('ideas/:ideaId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ideas.patchIdea(lifecycleId, ideaId, body);
  }

  @Post('ideas/:ideaId/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  convertIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.convertIdea(lifecycleId, ideaId, body, actorEmail(req));
  }

  @Get('items')
  listItems(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('format') format?: string,
    @Query('assignee') assignee?: string,
  ) {
    return this.items.listItems(lifecycleId, {
      status: status || undefined,
      format: format || undefined,
      assignee: assignee != null && assignee !== '' ? Number(assignee) : undefined,
    });
  }

  @Get('items/:itemId')
  getItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.getItem(lifecycleId, itemId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.createItem(lifecycleId, body, actorEmail(req));
  }

  @Patch('items/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.patchItem(lifecycleId, itemId, body, actorEmail(req));
  }
}
